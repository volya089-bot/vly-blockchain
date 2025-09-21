const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const WLY_RPC_URL = process.env.WLY_RPC_URL || 'http://localhost:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const PORT = process.env.PORT || 3000;

// Initialize provider and wallet
const provider = new ethers.providers.JsonRpcProvider(WLY_RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log('🚀 WLY Merchant API Starting...');
console.log('📡 Connected to:', WLY_RPC_URL);
console.log('💰 Wallet Address:', wallet.address);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    wallet: wallet.address,
    network: WLY_RPC_URL
  });
});

// Get wallet balance
app.get('/balance/:address?', async (req, res) => {
  try {
    const address = req.params.address || wallet.address;
    
    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    const balance = await provider.getBalance(address);
    const formattedBalance = ethers.utils.formatEther(balance);

    res.json({
      address,
      balance: formattedBalance,
      balanceWei: balance.toString(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Balance check error:', error);
    res.status(500).json({ error: 'Failed to get balance', details: error.message });
  }
});

// Create payment transaction
app.post('/payment/create', async (req, res) => {
  try {
    const { to, amount, data = '0x' } = req.body;

    if (!to || !amount) {
      return res.status(400).json({ error: 'Missing required fields: to, amount' });
    }

    if (!ethers.utils.isAddress(to)) {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }

    const value = ethers.utils.parseEther(amount.toString());
    
    // Get gas estimate
    const gasLimit = await wallet.estimateGas({
      to,
      value,
      data
    });

    const gasPrice = await provider.getGasPrice();
    const nonce = await wallet.getTransactionCount();

    const transaction = {
      to,
      value,
      gasLimit,
      gasPrice,
      nonce,
      data
    };

    res.json({
      transaction,
      estimatedCost: {
        value: ethers.utils.formatEther(value),
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
        maxFee: ethers.utils.formatEther(gasLimit.mul(gasPrice))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: 'Failed to create payment', details: error.message });
  }
});

// Send payment transaction
app.post('/payment/send', async (req, res) => {
  try {
    const { to, amount, data = '0x' } = req.body;

    if (!to || !amount) {
      return res.status(400).json({ error: 'Missing required fields: to, amount' });
    }

    if (!ethers.utils.isAddress(to)) {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }

    const value = ethers.utils.parseEther(amount.toString());

    const tx = await wallet.sendTransaction({
      to,
      value,
      data
    });

    console.log(`💸 Payment sent: ${tx.hash}`);

    res.json({
      success: true,
      transactionHash: tx.hash,
      from: wallet.address,
      to,
      amount,
      timestamp: new Date().toISOString(),
      status: 'pending'
    });
  } catch (error) {
    console.error('Payment send error:', error);
    res.status(500).json({ error: 'Failed to send payment', details: error.message });
  }
});

// Get transaction status
app.get('/transaction/:hash', async (req, res) => {
  try {
    const { hash } = req.params;

    const tx = await provider.getTransaction(hash);
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const receipt = await provider.getTransactionReceipt(hash);
    
    res.json({
      hash,
      status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
      transaction: {
        from: tx.from,
        to: tx.to,
        value: ethers.utils.formatEther(tx.value),
        gasPrice: ethers.utils.formatUnits(tx.gasPrice, 'gwei'),
        gasLimit: tx.gasLimit.toString(),
        nonce: tx.nonce,
        data: tx.data
      },
      receipt: receipt ? {
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei'),
        status: receipt.status
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Transaction status error:', error);
    res.status(500).json({ error: 'Failed to get transaction status', details: error.message });
  }
});

// Get transaction history for an address
app.get('/history/:address/:limit?', async (req, res) => {
  try {
    const { address, limit = 10 } = req.params;

    if (!ethers.utils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid Ethereum address' });
    }

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - parseInt(limit) * 100);

    // Get recent blocks and filter transactions
    const transactions = [];
    
    for (let i = currentBlock; i >= fromBlock && transactions.length < limit; i--) {
      try {
        const block = await provider.getBlockWithTransactions(i);
        if (block && block.transactions) {
          const relevantTxs = block.transactions.filter(tx => 
            tx.from.toLowerCase() === address.toLowerCase() || 
            tx.to?.toLowerCase() === address.toLowerCase()
          );
          
          for (const tx of relevantTxs) {
            const receipt = await provider.getTransactionReceipt(tx.hash);
            transactions.push({
              hash: tx.hash,
              from: tx.from,
              to: tx.to,
              value: ethers.utils.formatEther(tx.value),
              gasPrice: ethers.utils.formatUnits(tx.gasPrice, 'gwei'),
              gasUsed: receipt ? receipt.gasUsed.toString() : null,
              status: receipt ? (receipt.status === 1 ? 'success' : 'failed') : 'pending',
              blockNumber: tx.blockNumber,
              timestamp: block.timestamp
            });
            
            if (transactions.length >= limit) break;
          }
        }
      } catch (blockError) {
        // Skip blocks that can't be fetched
        continue;
      }
    }

    res.json({
      address,
      transactions: transactions.slice(0, limit),
      total: transactions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to get transaction history', details: error.message });
  }
});

// Get network information
app.get('/network/info', async (req, res) => {
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const gasPrice = await provider.getGasPrice();

    res.json({
      network: {
        name: network.name,
        chainId: network.chainId
      },
      currentBlock: blockNumber,
      gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Network info error:', error);
    res.status(500).json({ error: 'Failed to get network info', details: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error', details: error.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🌐 WLY Merchant API running on port ${PORT}`);
  console.log('📚 Available endpoints:');
  console.log('  GET  /health - Health check');
  console.log('  GET  /balance/:address - Get wallet balance');
  console.log('  POST /payment/create - Create payment transaction');
  console.log('  POST /payment/send - Send payment');
  console.log('  GET  /transaction/:hash - Get transaction status');
  console.log('  GET  /history/:address/:limit - Get transaction history');
  console.log('  GET  /network/info - Get network information');
});

module.exports = app;