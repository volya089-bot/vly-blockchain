# tools/vly_keygen.py
# Offline key/address generator for VLY (Bech32 HRP "vly"), WIF export.
import hashlib
from ecdsa import SigningKey, SECP256k1
from bech32 import bech32_encode, convertbits

HRP = "vly"
WITVER = 0

def sha256(b): return hashlib.sha256(b).digest()

def ripemd160(b):
    h = hashlib.new('ripemd160'); h.update(b); return h.digest()

def to_wif(privkey_bytes, compressed=True):
    b58 = b"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    payload = b"\x80" + privkey_bytes + (b"\x01" if compressed else b"")
    chk = sha256(sha256(payload))[:4]
    data = payload + chk
    n = int.from_bytes(data, "big")
    out = bytearray()
    while n > 0:
        n, r = divmod(n, 58)
        out.append(b58[r])
    out.reverse()
    for c in data:
        if c == 0:
            out = bytearray(b"1") + out
        else:
            break
    return out.decode()

def main():
    sk = SigningKey.generate(curve=SECP256k1)
    vk = sk.get_verifying_key()
    priv = sk.to_string()

    px, py = vk.pubkey.point.x(), vk.pubkey.point.y()
    prefix = b"\x02" if (py % 2 == 0) else b"\x03"
    pub_compressed = prefix + px.to_bytes(32, "big")

    h160 = ripemd160(sha256(pub_compressed))
    data = [WITVER] + list(convertbits(h160, 8, 5, True))
    bech32_addr = bech32_encode(HRP, data)

    print("=== VLY KEYGEN (offline) ===")
    print("Public address (VLY Bech32):", bech32_addr)
    print("Private key (WIF, keep SECRET!):", to_wif(priv, True))

if __name__ == "__main__":
    main()
