"""
SecureCorp PKI / mini-CA
========================

A minimal certificate authority for the demo. Public interface (see AGENT.md):

    generate_root_ca()                        -> (ca_cert_pem, ca_private_key_pem)
    issue_cert(subject_name, subject_pubkey)  -> cert_pem
    validate_cert(cert)                       -> bool
    get_root_ca_cert()                        -> cert_pem

Certificates are PEM strings so they travel over JSON. Helpers
`cert_pem_to_b64der` / `b64der_to_cert_pem` convert to/from the
"base64-encoded X.509 cert" form used in the `cert` field of
PROJECT_CONTEXT.md section 7.3.

Scope notes
-----------
* This module ONLY issues/validates certs. No tickets, sessions, TLS
  termination or RBAC.
* The CA only ever receives PUBLIC keys. It never generates or sees a
  user's/server's private key. The only private key in this module is the
  root CA's own signing key, stored on the server side.
"""

import base64
import datetime
import ipaddress
import os
import threading
from pathlib import Path
from typing import Optional, Tuple, Union

from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa
from cryptography.x509.oid import NameOID

# --------------------------------------------------------------------------
# Configuration (override via env vars, see .env.example)
# --------------------------------------------------------------------------
CA_COMMON_NAME = os.environ.get("PKI_CA_COMMON_NAME", "SecureCorp Root CA")
CA_ORG = os.environ.get("PKI_CA_ORG", "SecureCorp")
CA_VALIDITY_DAYS = int(os.environ.get("PKI_CA_VALIDITY_DAYS", "3650"))
LEAF_VALIDITY_DAYS = int(os.environ.get("PKI_LEAF_VALIDITY_DAYS", "365"))
CA_KEY_BITS = 3072
_CLOCK_SKEW = datetime.timedelta(minutes=5)

_lock = threading.Lock()


def _data_dir() -> Path:
    d = Path(os.environ.get("PKI_DATA_DIR", Path(__file__).parent / "data"))
    d.mkdir(parents=True, exist_ok=True)
    return d


def _ca_cert_path() -> Path:
    return _data_dir() / "root_ca_cert.pem"


def _ca_key_path() -> Path:
    return _data_dir() / "root_ca_key.pem"


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


# --------------------------------------------------------------------------
# Format helpers
# --------------------------------------------------------------------------
CertLike = Union[str, bytes, x509.Certificate]


def _load_cert(cert: CertLike) -> x509.Certificate:
    """Accept PEM str/bytes, base64 DER str/bytes, raw DER bytes, or a Certificate."""
    if isinstance(cert, x509.Certificate):
        return cert
    data = cert.encode() if isinstance(cert, str) else bytes(cert)
    data = data.strip()
    if b"-----BEGIN" in data:
        return x509.load_pem_x509_certificate(data)
    try:  # base64-encoded DER (section 7.3 form)
        return x509.load_der_x509_certificate(base64.b64decode(data, validate=True))
    except Exception:
        return x509.load_der_x509_certificate(data)  # raw DER


def cert_to_pem(cert: x509.Certificate) -> str:
    return cert.public_bytes(serialization.Encoding.PEM).decode()


def cert_pem_to_b64der(cert: CertLike) -> str:
    """PEM -> base64(DER), the form used in the `cert` JSON field (7.3)."""
    der = _load_cert(cert).public_bytes(serialization.Encoding.DER)
    return base64.b64encode(der).decode()


def b64der_to_cert_pem(b64: str) -> str:
    return cert_to_pem(_load_cert(b64))


def _load_public_key(key):
    """Accept a key object, PEM, DER, or base64 SPKI (what Web Crypto exports)."""
    if isinstance(key, (rsa.RSAPublicKey, ec.EllipticCurvePublicKey)):
        return key
    data = key.encode() if isinstance(key, str) else bytes(key)
    data = data.strip()
    if b"-----BEGIN" in data:
        pub = serialization.load_pem_public_key(data)
    else:
        try:
            der = base64.b64decode(data, validate=True)
        except Exception:
            der = data
        pub = serialization.load_der_public_key(der)
    if not isinstance(pub, (rsa.RSAPublicKey, ec.EllipticCurvePublicKey)):
        raise ValueError("Unsupported public key type (need RSA or EC P-256)")
    return pub


def _name(common_name: str) -> x509.Name:
    return x509.Name(
        [
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, CA_ORG),
            x509.NameAttribute(NameOID.COMMON_NAME, common_name),
        ]
    )


# --------------------------------------------------------------------------
# Root CA
# --------------------------------------------------------------------------
def generate_root_ca() -> Tuple[str, str]:
    """Create a new self-signed root CA and persist it to PKI_DATA_DIR.

    Returns (ca_cert_pem, ca_private_key_pem). Overwrites any existing CA,
    so previously issued certs will no longer validate.
    """
    key = rsa.generate_private_key(public_exponent=65537, key_size=CA_KEY_BITS)
    name = _name(CA_COMMON_NAME)
    now = _now()
    cert = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - _CLOCK_SKEW)
        .not_valid_after(now + datetime.timedelta(days=CA_VALIDITY_DAYS))
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True, key_cert_sign=True, crl_sign=True,
                content_commitment=False, key_encipherment=False,
                data_encipherment=False, key_agreement=False,
                encipher_only=False, decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
        .sign(key, hashes.SHA256())
    )
    cert_pem = cert_to_pem(cert)
    key_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()

    with _lock:
        _ca_cert_path().write_text(cert_pem)
        kp = _ca_key_path()
        kp.write_text(key_pem)
        try:
            os.chmod(kp, 0o600)
        except OSError:
            pass
    return cert_pem, key_pem


def _ensure_ca() -> Tuple[x509.Certificate, object]:
    """Load the root CA from disk, generating it on first use."""
    with _lock:
        exists = _ca_cert_path().exists() and _ca_key_path().exists()
    if not exists:
        generate_root_ca()
    with _lock:
        cert = x509.load_pem_x509_certificate(_ca_cert_path().read_bytes())
        key = serialization.load_pem_private_key(_ca_key_path().read_bytes(), password=None)
    return cert, key


def get_root_ca_cert() -> str:
    """Public root CA cert (PEM). Safe to share: contains no private key."""
    cert, _ = _ensure_ca()
    return cert_to_pem(cert)


# --------------------------------------------------------------------------
# Issuing
# --------------------------------------------------------------------------
def issue_cert(
    subject_name: str,
    subject_public_key,
    san_dns: Optional[list] = None,
    san_ips: Optional[list] = None,
    validity_days: Optional[int] = None,
    _not_before: Optional[datetime.datetime] = None,  # test hook (expired certs)
) -> str:
    """Issue a leaf cert for `subject_name` + `subject_public_key`, signed by the root CA.

    `subject_public_key` may be a key object, PEM, DER, or base64 SPKI.
    Returns the cert as a PEM string.

    For the server cert pass san_dns=["localhost"] and/or san_ips=["127.0.0.1"]
    so browsers can use it for TLS.
    """
    if not subject_name or not subject_name.strip():
        raise ValueError("subject_name must be non-empty")
    pub = _load_public_key(subject_public_key)
    ca_cert, ca_key = _ensure_ca()

    now = _now()
    not_before = _not_before or (now - _CLOCK_SKEW)
    days = validity_days if validity_days is not None else LEAF_VALIDITY_DAYS
    builder = (
        x509.CertificateBuilder()
        .subject_name(_name(subject_name.strip()))
        .issuer_name(ca_cert.subject)
        .public_key(pub)
        .serial_number(x509.random_serial_number())
        .not_valid_before(not_before)
        .not_valid_after(not_before + datetime.timedelta(days=days))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(pub), critical=False)
        .add_extension(
            x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_cert.public_key()),
            critical=False,
        )
    )
    sans = [x509.DNSName(d) for d in (san_dns or [])]
    sans += [x509.IPAddress(ipaddress.ip_address(i)) for i in (san_ips or [])]
    if sans:
        builder = builder.add_extension(x509.SubjectAlternativeName(sans), critical=False)

    return cert_to_pem(builder.sign(ca_key, hashes.SHA256()))


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------
def validate_cert(cert: CertLike) -> bool:
    """True iff `cert` was signed by OUR root CA and is currently within its validity.

    Checks: parses, issuer matches root subject, signature verifies against
    the root CA public key, validity window, and that a leaf is not claiming
    to be a CA. Never raises on bad input; returns False.
    """
    try:
        c = _load_cert(cert)
        root = x509.load_pem_x509_certificate(get_root_ca_cert().encode())

        if c.issuer != root.subject:
            return False

        # Cryptographic signature check against the root CA public key.
        root_pub = root.public_key()
        if isinstance(root_pub, rsa.RSAPublicKey):
            root_pub.verify(
                c.signature, c.tbs_certificate_bytes,
                padding.PKCS1v15(), c.signature_hash_algorithm,
            )
        elif isinstance(root_pub, ec.EllipticCurvePublicKey):
            root_pub.verify(
                c.signature, c.tbs_certificate_bytes,
                ec.ECDSA(c.signature_hash_algorithm),
            )
        else:
            return False

        # Expiry / not-yet-valid.
        now = _now()
        if not (c.not_valid_before_utc <= now <= c.not_valid_after_utc):
            return False

        # Only the root itself may be a CA; a leaf claiming ca=True is rejected.
        if c.fingerprint(hashes.SHA256()) != root.fingerprint(hashes.SHA256()):
            try:
                bc = c.extensions.get_extension_for_class(x509.BasicConstraints).value
                if bc.ca:
                    return False
            except x509.ExtensionNotFound:
                pass
        return True
    except (InvalidSignature, ValueError, TypeError, Exception):
        return False


# Convenience for Auth/Backend: who is the cert for?
def get_subject_name(cert: CertLike) -> str:
    """Common name of the cert subject (e.g. "alice"). Call validate_cert() first."""
    c = _load_cert(cert)
    return c.subject.get_attributes_for_oid(NameOID.COMMON_NAME)[0].value
