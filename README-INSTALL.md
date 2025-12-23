# VLY Blockchain – Quick Install & Patch Guide

This package turns Bitcoin Core v26.1 into **VLY** (21,000,000 supply, SHA‑256, Bech32 HRP `vly`, ports 18771/18772) and adds a **1,000,000 VLY premine at block #1**.

## Contents
- `vly.patch` — code changes (params, HRP, placeholders for genesis/premine)
- `vlycoin.conf.example` — node config
- `.github/workflows/build.yml` — CI for Linux & Windows builds
- `contrib/explorer/.env.example` — preset for BTC RPC Explorer
- `docs/treasury.md` — treasury/vesting template
- `tools/vly_keygen.py` — offline VLY address/key generator (Bech32 `vly`, WIF export)

## 0) Prereqs
- Git, toolchain for Bitcoin Core, Python 3.11+ (for keygen).

## 1) Put Bitcoin Core v26.1 into your repo
```bash
git clone https://github.com/bitcoin/bitcoin.git vly-src
cd vly-src
git checkout v26.1
git remote remove origin || true
git remote add origin https://github.com/volya089-bot/vly-blockchain.git
git push -u origin HEAD:main
```

## 2) Upload this ZIP into the repo root, then:
```bash
git add .
git commit -m "Add VLY patch, configs, workflows, keygen, docs"
git push
```

## 3) Generate your public VLY address (vly1...)
```bash
python3 tools/vly_keygen.py
```
Output:
```
Public address (VLY Bech32): vly1...
Private key (WIF, keep SECRET!): L...
```
Send ONLY the `vly1...` to the team; keep WIF offline.

## 4) Apply the patch
```bash
git apply vly.patch
git commit -m "Apply VLY consensus params & premine"
git push
```
> Replace the placeholder address later in `src/consensus/validation_vly_premine.h` with your real `vly1...` before mainnet.

## 5) Build locally or via GitHub Actions
Linux:
```bash
./autogen.sh
./configure --without-gui && make -j$(nproc)
make clean && ./configure --with-gui=qt && make -j$(nproc)
```

## 6) Run node
Copy `vlycoin.conf.example` → `~/.vlycoin/vlycoin.conf` and set strong RPC creds. Open P2P port 18771.

## 7) Explorer
Use BTC RPC Explorer with `contrib/explorer/.env.example` as template.
