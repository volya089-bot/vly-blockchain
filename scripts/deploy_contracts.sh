#!/bin/bash

# Deploy contracts script for WLY blockchain
echo "🚀 Deploying WLY blockchain contracts..."

# Check if hardhat is installed
if ! command -v npx &> /dev/null; then
    echo "❌ Node.js and npm are required. Please install them first."
    exit 1
fi

# Initialize Hardhat project if not exists
if [ ! -f "hardhat.config.js" ]; then
    echo "📦 Initializing Hardhat project..."
    npm init -y
    npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
    npx hardhat init --yes
fi

# Install required dependencies
echo "📦 Installing dependencies..."
npm install --save-dev @openzeppelin/contracts

# Create hardhat.config.js
cat > hardhat.config.js << 'EOF'
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  networks: {
    wly: {
      url: "http://localhost:8545",
      accounts: ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"], // Default hardhat account
      chainId: 3001
    },
    local: {
      url: "http://localhost:8545",
      accounts: ["0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"],
      chainId: 3001
    }
  }
};
EOF

# Deploy ERC20 contract
echo "🪙 Deploying ERC20WLY token..."
node scripts/deploy_ERC20.js

# Deploy ERC721 contract
echo "🎨 Deploying ERC721WLY NFT..."
node scripts/deploy_ERC721.js

echo "✅ Contract deployment completed!"
echo "📋 Check the console output above for contract addresses."