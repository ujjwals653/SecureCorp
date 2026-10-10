# PKI / mini-CA

Minimal certificate authority for SecureCorp. Library module (no server of its own) imported by Auth and Backend.

```python
from pki import generate_root_ca, issue_cert, validate_cert, get_root_ca_cert

get_root_ca_cert()                      # PEM string, public only (auto-creates CA on first use)
cert = issue_cert("alice", spki_b64)    # accepts key object / PEM / DER / base64 SPKI (Web Crypto export)
validate_cert(cert)                     # True only if signed by our root CA and unexpired
```

Extras: `cert_pem_to_b64der()` / `b64der_to_cert_pem()` for the `cert` field in PROJECT_CONTEXT §7.3; `get_subject_name(cert)`; `issue_cert(..., san_dns=["localhost"], san_ips=["127.0.0.1"])` for the server TLS cert. `validate_cert` accepts PEM, base64-DER or DER and never raises (returns `False` on bad input).

## Run the standalone test
```bash
pip install -r requirements.txt
python test_pki.py
```

## Notes
- Root CA cert/key persist in `PKI_DATA_DIR` (default `./data`, gitignored). The private key never leaves the server and is never returned by `get_root_ca_cert()`.
- The CA only ever receives **public** keys; user private keys stay in the browser.
- `generate_root_ca()` overwrites any existing CA; previously issued certs stop validating.
- Auth should call `validate_cert()`; Backend/TLS wiring uses the root cert from `get_root_ca_cert()`.
