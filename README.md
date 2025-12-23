# VLY Blockchain

VLY Blockchain is an Ethereum-based blockchain with unique features including halving rewards (like Bitcoin), automatic owner rewards, and ultra-fast block times (~0.4 seconds).

## 🚀 Features

- **Ethereum Compatibility**: Full EVM compatibility for smart contracts
- **Halving Mechanism**: Block rewards halve every 210,000 blocks (like Bitcoin)
- **Owner Rewards**: Automatic 20% reward allocation to owner address from each block
- **Fast Block Times**: ~0.4 second block generation for quick transactions
- **Ready-to-Use Contracts**: ERC20 and ERC721 templates included
- **Merchant API**: Complete payment processing API for integration
- **Development Tools**: Automated deployment scripts and Docker support

## 📁 Repository Structure

```
vly-blockchain/
├── genesis.json                 # Genesis configuration for WLY chain
├── consensus/
│   └── halving_reward.go       # Halving and owner reward implementation
├── contracts/
│   ├── ERC20WLY.sol           # ERC20 token template
│   └── ERC721WLY.sol          # ERC721 NFT template
├── scripts/
│   ├── deploy_contracts.sh     # Contract deployment automation
│   ├── deploy_ERC20.js        # ERC20 deployment script
│   └── deploy_ERC721.js       # ERC721 deployment script
├── merchant-api/
│   ├── index.js               # Express.js payment API
│   └── package.json           # API dependencies
├── docker/
│   └── start.sh               # Docker startup script
├── Dockerfile                 # Container configuration
└── README.md                  # This file
```

## 🛠️ Quick Start

### Method 1: Docker (Recommended)

1. **Build and run the blockchain**:
```bash
docker build -t vly-blockchain .
docker run -d -p 8545:8545 -p 8546:8546 -p 30303:30303 vly-blockchain
```

2. **Verify the node is running**:
```bash
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545
```

### Method 2: Manual Setup

1. **Install Go-Ethereum (Geth)**:
```bash
# Ubuntu/Debian
sudo add-apt-repository -y ppa:ethereum/ethereum
sudo apt-get update
sudo apt-get install ethereum

# macOS
brew tap ethereum/ethereum
brew install ethereum
```

2. **Initialize the blockchain**:
```bash
geth --datadir ./data init genesis.json
```

3. **Start the node**:
```bash
geth --datadir ./data \
  --networkid 3001 \
  --http \
  --http.addr 0.0.0.0 \
  --http.port 8545 \
  --http.api "eth,net,web3,personal,miner" \
  --http.corsdomain "*" \
  --ws \
  --ws.addr 0.0.0.0 \
  --ws.port 8546 \
  --ws.api "eth,net,web3,personal,miner" \
  --ws.origins "*" \
  --mine \
  --miner.threads 1 \
  --allow-insecure-unlock \
  --dev.period 0.4 \
  --console
```

## 📦 Smart Contract Development

### Deploy Template Contracts

1. **Install dependencies**:
```bash
npm install -g hardhat
./scripts/deploy_contracts.sh
```

2. **Deploy individual contracts**:
```bash
# Deploy ERC20 token
node scripts/deploy_ERC20.js

# Deploy ERC721 NFT
node scripts/deploy_ERC721.js
```

### Contract Features

#### ERC20WLY Token
- Standard ERC20 implementation
- Mintable by owner
- Burnable by token holders
- 18 decimals by default

#### ERC721WLY NFT
- Standard ERC721 implementation with metadata
- Mintable by owner with custom URI
- Full transfer and approval functionality

### Custom Development

1. **Create new contracts** in the `contracts/` folder
2. **Modify deployment scripts** to include your contracts
3. **Use the WLY network configuration**:

```javascript
// hardhat.config.js
module.exports = {
  networks: {
    wly: {
      url: "http://localhost:8545",
      chainId: 3001,
      accounts: ["0xYourPrivateKeyHere"]
    }
  }
};
```

## 🛒 Merchant API Integration

The Merchant API provides a complete payment processing solution.

### Start the API

```bash
cd merchant-api
npm install
npm start
```

### API Endpoints

#### Health Check
```bash
GET /health
```

#### Get Balance
```bash
GET /balance/:address
```

#### Create Payment
```bash
POST /payment/create
{
  "to": "0x742d35Cc6634C0532925a3b8D75C4A9c4b8b8b8b",
  "amount": "1.5"
}
```

#### Send Payment
```bash
POST /payment/send
{
  "to": "0x742d35Cc6634C0532925a3b8D75C4A9c4b8b8b8b",
  "amount": "1.5"
}
```

#### Transaction Status
```bash
GET /transaction/:hash
```

#### Transaction History
```bash
GET /history/:address/:limit
```

#### Network Information
```bash
GET /network/info
```

### Integration Example

```javascript
const axios = require('axios');

// Send payment
const payment = await axios.post('http://localhost:3000/payment/send', {
  to: '0x742d35Cc6634C0532925a3b8D75C4A9c4b8b8b8b',
  amount: '1.0'
});

console.log('Payment sent:', payment.data.transactionHash);

// Check status
const status = await axios.get(`http://localhost:3000/transaction/${payment.data.transactionHash}`);
console.log('Payment status:', status.data.status);
```

## ⚙️ Blockchain Configuration

### Genesis Configuration

- **Chain ID**: 3001
- **Initial Difficulty**: Very low for fast mining
- **Gas Limit**: 134,217,728 (high throughput)
- **Owner Address**: `0x742d35Cc6634C0532925a3b8D75C4A9c4b8b8b8b`
- **Premine**: 1,000,000 WLY to owner address

### Block Rewards

- **Initial Reward**: 5 WLY per block
- **Halving**: Every 210,000 blocks (reduces by 50%)
- **Owner Share**: 20% of each block reward automatically
- **Miner Share**: 80% of each block reward

### Network Parameters

- **Block Time**: ~0.4 seconds
- **Network ID**: 3001
- **RPC Port**: 8545
- **WebSocket Port**: 8546
- **P2P Port**: 30303

## 🔧 Development Tools

### Environment Variables

```bash
# Merchant API Configuration
export WLY_RPC_URL="http://localhost:8545"
export PRIVATE_KEY="0xYourPrivateKeyHere"
export PORT=3000
```

### Testing

```bash
# Test blockchain connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' \
  http://localhost:8545

# Test mining
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"miner_start","params":[1],"id":1}' \
  http://localhost:8545
```

### Monitoring

```bash
# Check current block number
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545

# Get account balance
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0x742d35Cc6634C0532925a3b8D75C4A9c4b8b8b8b","latest"],"id":1}' \
  http://localhost:8545
```

## 🔒 Security Considerations

1. **Private Keys**: Never commit private keys to version control
2. **Network Security**: Use proper firewall rules for production
3. **API Security**: Implement rate limiting and authentication for production APIs
4. **Smart Contracts**: Audit contracts before mainnet deployment
5. **Node Security**: Keep Geth updated and secure RPC endpoints

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: This README
- **Community**: Discord/Telegram (links coming soon)

## 🗺️ Roadmap

- [ ] Mainnet launch
- [ ] Block explorer
- [ ] Mobile wallet
- [ ] Cross-chain bridges
- [ ] DeFi protocols
- [ ] NFT marketplace

---

**Happy Building on VLY Blockchain! 🚀**