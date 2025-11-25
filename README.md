# VLY Blockchain - Complete Web3 Ecosystem

VLY Blockchain is a Bitcoin Core v26.1 fork with comprehensive Web3 features including smart contracts, DeFi tools, explorer, faucet, merchant API, mobile wallet, and DAO governance.

## 🌟 Features

### Core Blockchain
- **21,000,000 VLY total supply** with 1,000,000 premine
- **SHA-256 mining algorithm** (Bitcoin-compatible)
- **Bech32 addresses** with `vly1` prefix
- **Native SegWit support**

### Smart Contracts
- **WL20 Token Standard** - VLY-native token standard with enhanced features
- **MultisigWallet** - Multi-signature wallet for secure fund management
- **Token Factory** - Create and manage WL20 tokens with web interface
- **DAO Governance** - Decentralized voting and proposal system
- **Referral Program** - Multi-level referral and loyalty point system

### Web Services
- **Block Explorer** - Full-featured blockchain explorer (Node.js + React)
- **Faucet Service** - Testnet VLY distribution with rate limiting
- **Merchant API** - Payment processing for businesses
- **Mobile Wallet** - React Native wallet template

## 🚀 Quick Start

### 1. Core Blockchain Setup

```bash
# Clone Bitcoin Core v26.1
git clone https://github.com/bitcoin/bitcoin.git vly-src
cd vly-src
git checkout v26.1

# Apply VLY modifications
git remote remove origin
git remote add origin https://github.com/volya089-bot/vly-blockchain.git
git push -u origin HEAD:main

# Apply VLY patch (if available)
git apply vly.patch
```

### 2. Generate VLY Address

```bash
# Use the provided key generator
python3 tools/vly_keygen.py
```

### 3. Build VLY Core

```bash
# Linux/Mac
./autogen.sh
./configure --without-gui
make -j$(nproc)

# With GUI
make clean && ./configure --with-gui=qt && make -j$(nproc)
```

### 4. Run VLY Node

```bash
# Copy configuration
cp vlycoin.conf.example ~/.vlycoin/vlycoin.conf

# Start node
./src/vlycoind -daemon
```

## 📊 Web3 Services

### Faucet Service

```bash
cd faucet
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

**Features:**
- Rate-limited VLY distribution
- Admin panel for configuration
- QR code support
- Comprehensive logging

### Block Explorer

```bash
# Backend
cd explorer/backend
npm install
cp .env.example .env
npm start

# Frontend
cd explorer/frontend
npm install
npm start
```

**Features:**
- Real-time blockchain data
- Block and transaction search
- Address lookup
- Mempool monitoring
- Network statistics

### Merchant API

```bash
cd merchant
npm install
cp .env.example .env
npm start
```

**Features:**
- Payment request generation
- QR code payments
- Webhook notifications
- Multi-merchant support
- Real-time payment monitoring

### Mobile Wallet

```bash
cd mobile
npm install

# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

**Features:**
- Secure mnemonic-based wallet creation
- Biometric authentication support
- QR code scanning
- Transaction history
- Real-time balance updates

## 💡 Smart Contracts

All smart contracts are located in the `contracts/` directory and are ready for deployment on VLY blockchain.

### WL20 Token Standard (`contracts/WL20.sol`)

Enhanced ERC20-compatible token standard for VLY blockchain:

```solidity
// Deploy a new token
contract MyToken is WL20 {
    constructor() WL20(
        "My Token",     // name
        "MYT",          // symbol
        18,             // decimals
        1000000 * 1e18, // initial supply
        true,           // mintable
        true,           // burnable
        10000000 * 1e18 // max supply
    ) {}
}
```

### MultisigWallet (`contracts/WLYMultiSig.sol`)

Secure multi-signature wallet supporting both VLY and WL20 tokens.

### Token Factory (`contracts/WLYTokenFactory.sol`)

Create and manage WL20 tokens with configurable parameters and fees.

### DAO Governance (`contracts/WLYDAO.sol`)

Decentralized voting and proposal system with time-locked execution.

### Referral Program (`contracts/WLYReferral.sol`)

Multi-level referral and loyalty point system with configurable rewards.

## 🛠 Development

### Environment Setup

Each service has its own `.env.example` file. Copy and configure as needed:

```bash
# Faucet
cd faucet && cp .env.example .env

# Explorer
cd explorer/backend && cp .env.example .env

# Merchant API
cd merchant && cp .env.example .env
```

### Testing

```bash
# Test individual services
cd faucet && npm test
cd explorer/backend && npm test
cd merchant && npm test
```

## 🌐 Network Configuration

### Mainnet
- **RPC Port:** 18772
- **P2P Port:** 18771
- **Address Prefix:** vly1

### Testnet
- **RPC Port:** 18773
- **P2P Port:** 18774
- **Address Prefix:** vly1

### Regtest
- **RPC Port:** 18443
- **P2P Port:** 18444
- **Address Prefix:** vly1

## 🔧 API Endpoints

### Faucet API (Port 3001)
- `POST /request` - Request VLY tokens
- `GET /info` - Faucet information
- `GET /stats` - Distribution statistics

### Explorer API (Port 3002)
- `GET /api/network` - Network information
- `GET /api/blocks` - Latest blocks
- `GET /api/block/:id` - Block details
- `GET /api/transaction/:txid` - Transaction details
- `GET /api/address/:addr` - Address information

### Merchant API (Port 3003)
- `POST /merchant/register` - Register merchant
- `POST /payment/create` - Create payment request
- `GET /payment/:id` - Payment status
- `GET /payment/:id/qr` - Payment QR code

## 📱 Mobile Wallet

The React Native mobile wallet template provides:

- Secure mnemonic-based wallet creation
- Biometric authentication support
- QR code scanning for payments
- Transaction history and real-time balance updates
- Multi-network support (mainnet/testnet/regtest)

## 🏗 Project Structure

```
vly-blockchain/
├── contracts/              # Smart contracts
│   ├── WL20.sol            # Token standard
│   ├── WLYMultiSig.sol     # Multi-signature wallet
│   ├── WLYTokenFactory.sol # Token creation factory
│   ├── WLYDAO.sol          # DAO governance
│   └── WLYReferral.sol     # Referral program
├── faucet/                 # Faucet service
├── explorer/               # Block explorer
│   ├── backend/            # API server
│   └── frontend/           # React frontend
├── merchant/               # Merchant payment API
├── mobile/                 # React Native wallet
├── tools/                  # Utility scripts
├── docs/                   # Documentation
└── contrib/                # Additional resources
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues:** [GitHub Issues](https://github.com/volya089-bot/vly-blockchain/issues)
- **Documentation:** [docs/](docs/)

---

**Built with ❤️ by the VLY Blockchain Team**