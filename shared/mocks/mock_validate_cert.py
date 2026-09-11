"""
MOCK — PKI cert validation stub.

Real module: modules/pki (see modules/pki/AGENT.md)
Used by: modules/auth, during login flow, until Integration Checkpoint 1.

Swap instructions:
  Replace this import:
      from shared.mocks.mock_validate_cert import validate_cert
  with:
      from modules.pki.pki import validate_cert
  No other code should need to change if modules/pki exposes the same
  function signature described in modules/pki/AGENT.md.
"""


def validate_cert(cert) -> bool:
    """
    MOCK. Always returns True — assumes any cert presented is valid.

    Real implementation must check the cert chains back to our root CA
    and has not expired. Do not rely on this mock for anything beyond
    local development of the Auth login flow.
    """
    return True


def get_root_ca_cert():
    """
    MOCK. Returns a placeholder string standing in for the real root CA cert.

    Real implementation (modules/pki) returns an actual PEM-encoded cert.
    """
    return "MOCK-ROOT-CA-CERT-PLACEHOLDER"
