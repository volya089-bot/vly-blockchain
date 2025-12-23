# VLY Blockchain

![VLY Logo](assets/vly-logo.png)

VLY Blockchain — Bitcoin Core fork (21,000,000 supply, SHA-256, genesis premine 1,000,000 VLY)

## Owner Reward System

VLY Blockchain features an automatic owner reward system where **20% of all mining rewards** are automatically distributed to the owner address:

**Owner Address:** `0x273Cac41cd1aA2845A5A15B5183a428eaB62E050`

This address receives 20% of block rewards to support:
- Network development and maintenance
- Infrastructure costs
- Community development
- Project sustainability

The remaining 80% goes to miners as usual.

## Setup Instructions

### 1) Взяти код Bitcoin Core (v26.1)
```bash
git clone https://github.com/bitcoin/bitcoin.git vly-src
cd vly-src
git checkout v26.1
```

### 2) Під'єднати свій репозиторій
```bash
git remote remove origin
git remote add origin https://github.com/volya089-bot/vly-blockchain.git
```

### 3) Запушити у твій репо (в гілку main)
```bash
git push -u origin HEAD:main
```

## Features

- **Total Supply:** 21,000,000 VLY
- **Mining Algorithm:** SHA-256 (Bitcoin-compatible)
- **Block Time:** 10 minutes
- **Halving Interval:** 210,000 blocks
- **Genesis Premine:** 1,000,000 VLY
- **Owner Reward:** 20% of block rewards
- **Network Port:** 18771