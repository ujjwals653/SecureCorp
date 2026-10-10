"""
Standalone PKI demo/test. No dependency on any other module.

Run:  python test_pki.py
(Uses a temporary data dir, so it never touches your real root CA.)

NOTE: the test generates throwaway keypairs for Alice/Bob/server only to get
public keys to certify. In the real system browsers generate their own keys
and only the PUBLIC key reaches the CA.
"""
import base64
import datetime
import os
import tempfile

os.environ["PKI_DATA_DIR"] = tempfile.mkdtemp(prefix="pki_test_")

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, rsa
from cryptography.x509.oid import NameOID

import pki

_passed = 0


def check(label, cond):
    global _passed
    print(f"  [{'PASS' if cond else 'FAIL'}] {label}")
    assert cond, label
    _passed += 1


def new_rsa_pub():
    return rsa.generate_private_key(65537, 2048).public_key()


print("== Root CA ==")
ca_pem, ca_key_pem = pki.generate_root_ca()
check("root CA cert is PEM", ca_pem.startswith("-----BEGIN CERTIFICATE-----"))
root = x509.load_pem_x509_certificate(ca_pem.encode())
check("root is self-signed", root.issuer == root.subject)
check("root has CA=true", root.extensions.get_extension_for_class(x509.BasicConstraints).value.ca)
check("get_root_ca_cert() matches generated cert", pki.get_root_ca_cert() == ca_pem)
check("public root cert contains no private key", "PRIVATE KEY" not in pki.get_root_ca_cert())

print("== Issue + validate Alice, Bob, server ==")
certs = {}
for name, kwargs in [
    ("alice", {}),
    ("bob", {}),
    ("server", {"san_dns": ["localhost"], "san_ips": ["127.0.0.1"]}),
]:
    certs[name] = pki.issue_cert(name, new_rsa_pub(), **kwargs)
    check(f"{name}: issued cert validates", pki.validate_cert(certs[name]) is True)
    check(f"{name}: subject name is '{name}'", pki.get_subject_name(certs[name]) == name)

print("== Input formats (JSON-friendly) ==")
pub = new_rsa_pub()
spki_b64 = base64.b64encode(
    pub.public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
).decode()
c = pki.issue_cert("bob", spki_b64)  # exactly what Web Crypto exports (7.3)
check("accepts base64 SPKI public key (7.3 format)", pki.validate_cert(c))
b64 = pki.cert_pem_to_b64der(c)
check("validates base64-DER cert (7.3 `cert` field)", pki.validate_cert(b64))
check("b64der -> PEM roundtrip", pki.validate_cert(pki.b64der_to_cert_pem(b64)))
ec_pub = ec.generate_private_key(ec.SECP256R1()).public_key()
check("issues for ECDH P-256 keys too", pki.validate_cert(pki.issue_cert("carol", ec_pub)))

print("== Must be rejected ==")
# Self-signed impostor claiming the same issuer name
k = rsa.generate_private_key(65537, 2048)
now = datetime.datetime.now(datetime.timezone.utc)
fake = (
    x509.CertificateBuilder()
    .subject_name(root.subject).issuer_name(root.subject)
    .public_key(k.public_key()).serial_number(1)
    .not_valid_before(now).not_valid_after(now + datetime.timedelta(days=30))
    .sign(k, hashes.SHA256())
)
check("self-signed impostor (same issuer name) rejected",
      pki.validate_cert(fake.public_bytes(serialization.Encoding.PEM).decode()) is False)

# Plain self-signed with a different name
other = (
    x509.CertificateBuilder()
    .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "mallory")]))
    .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "mallory")]))
    .public_key(k.public_key()).serial_number(2)
    .not_valid_before(now).not_valid_after(now + datetime.timedelta(days=30))
    .sign(k, hashes.SHA256())
)
check("plain self-signed cert rejected",
      pki.validate_cert(other.public_bytes(serialization.Encoding.PEM).decode()) is False)

# Tampered: change subject from alice -> admin, keep original signature
orig = x509.load_pem_x509_certificate(certs["alice"].encode())
der = bytearray(orig.public_bytes(serialization.Encoding.DER))
idx = bytes(der).find(b"alice")
der[idx:idx + 5] = b"admin"
tampered = base64.b64encode(bytes(der)).decode()
check("tampered cert (alice->admin) rejected", pki.validate_cert(tampered) is False)

# Tampered: flip a byte in the signature
der2 = bytearray(orig.public_bytes(serialization.Encoding.DER))
der2[-10] ^= 0xFF
check("tampered signature rejected",
      pki.validate_cert(base64.b64encode(bytes(der2)).decode()) is False)

# Expired
expired = pki.issue_cert("old", new_rsa_pub(), validity_days=1,
                         _not_before=now - datetime.timedelta(days=30))
check("expired cert rejected", pki.validate_cert(expired) is False)

# Cert from a different CA (same name, different key)
legit_root_pem = pki.get_root_ca_cert()
pki.generate_root_ca()  # new CA replaces the old one
check("cert from previous/other CA rejected after CA rotation",
      pki.validate_cert(certs["alice"]) is False)
check("old root != new root", pki.get_root_ca_cert() != legit_root_pem)

print("== Garbage input never raises ==")
for junk in ["", "not a cert", b"\x00\x01", None, 123]:
    check(f"junk {junk!r} -> False", pki.validate_cert(junk) is False)

print(f"\nAll {_passed} checks passed.")
