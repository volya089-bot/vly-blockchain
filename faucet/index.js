const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const Client = require('bitcoin-core');
const Joi = require('joi');
const winston = require('winston');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'faucet-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'faucet.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// VLY Node client configuration
const vlyClient = new Client({
  network: process.env.VLY_NETWORK || 'regtest',
  username: process.env.VLY_RPC_USER || 'vlyrpc',
  password: process.env.VLY_RPC_PASSWORD || 'vlypass',
  host: process.env.VLY_RPC_HOST || 'localhost',
  port: process.env.VLY_RPC_PORT || 18443,
  timeout: 30000
});

// Rate limiter configuration
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 1, // Number of requests
  duration: parseInt(process.env.FAUCET_COOLDOWN || '3600'), // Per 1 hour by default
});

const requestLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 5, // Number of requests
  duration: 60, // Per 1 minute
});

// Faucet configuration
const FAUCET_CONFIG = {
  amount: parseFloat(process.env.FAUCET_AMOUNT || '1.0'), // VLY amount to send
  minBalance: parseFloat(process.env.FAUCET_MIN_BALANCE || '100.0'), // Minimum faucet balance
  maxDaily: parseFloat(process.env.FAUCET_MAX_DAILY || '100.0'), // Maximum daily distribution
  wallet: process.env.FAUCET_WALLET || 'vlywallet',
  address: process.env.FAUCET_ADDRESS || '' // Will be set dynamically
};

// Statistics
let stats = {
  totalRequests: 0,
  totalDistributed: 0,
  dailyDistributed: 0,
  lastResetDate: new Date().toDateString(),
  errors: 0,
  balance: 0
};

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Request rate limiting
app.use(async (req, res, next) => {
  try {
    await requestLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000)
    });
  }
});

// Validation schemas
const addressSchema = Joi.object({
  address: Joi.string().required().pattern(/^vly1[a-zA-Z0-9]{39,59}$/).message('Invalid VLY address format'),
  captcha: Joi.string().optional()
});

// Utility functions
function isValidVLYAddress(address) {
  // Basic validation for VLY Bech32 addresses
  return /^vly1[a-zA-Z0-9]{39,59}$/.test(address);
}

async function getFaucetBalance() {
  try {
    const balance = await vlyClient.getBalance(FAUCET_CONFIG.wallet);
    stats.balance = balance;
    return balance;
  } catch (error) {
    logger.error('Failed to get faucet balance:', error);
    return 0;
  }
}

async function getFaucetAddress() {
  try {
    if (!FAUCET_CONFIG.address) {
      // Get or create a receiving address for the faucet
      const addresses = await vlyClient.getAddressesByLabel(FAUCET_CONFIG.wallet);
      if (addresses && Object.keys(addresses).length > 0) {
        FAUCET_CONFIG.address = Object.keys(addresses)[0];
      } else {
        FAUCET_CONFIG.address = await vlyClient.getNewAddress(FAUCET_CONFIG.wallet, 'bech32');
      }
    }
    return FAUCET_CONFIG.address;
  } catch (error) {
    logger.error('Failed to get faucet address:', error);
    return null;
  }
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'VLY Faucet',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Get faucet info
app.get('/info', async (req, res) => {
  try {
    const balance = await getFaucetBalance();
    const address = await getFaucetAddress();
    
    res.json({
      success: true,
      data: {
        amount: FAUCET_CONFIG.amount,
        cooldown: parseInt(process.env.FAUCET_COOLDOWN || '3600'),
        balance: balance,
        address: address,
        minBalance: FAUCET_CONFIG.minBalance,
        network: process.env.VLY_NETWORK || 'regtest',
        active: balance >= FAUCET_CONFIG.minBalance && stats.dailyDistributed < FAUCET_CONFIG.maxDaily
      }
    });
  } catch (error) {
    logger.error('Error getting faucet info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get faucet information'
    });
  }
});

// Get faucet statistics
app.get('/stats', async (req, res) => {
  try {
    await getFaucetBalance(); // Update balance
    
    res.json({
      success: true,
      data: {
        ...stats,
        remainingDaily: Math.max(0, FAUCET_CONFIG.maxDaily - stats.dailyDistributed),
        active: stats.balance >= FAUCET_CONFIG.minBalance
      }
    });
  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
});

// Request VLY from faucet
app.post('/request', async (req, res) => {
  try {
    // Validate request
    const { error, value } = addressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { address } = value;

    // Check faucet cooldown
    try {
      await rateLimiter.consume(req.ip);
    } catch (rejRes) {
      return res.status(429).json({
        success: false,
        error: 'Faucet cooldown active. Please try again later.',
        retryAfter: Math.round(rejRes.msBeforeNext / 1000),
        cooldown: parseInt(process.env.FAUCET_COOLDOWN || '3600')
      });
    }

    // Check faucet balance
    const balance = await getFaucetBalance();
    if (balance < FAUCET_CONFIG.minBalance) {
      stats.errors++;
      return res.status(503).json({
        success: false,
        error: 'Faucet temporarily unavailable. Low balance.',
        balance: balance,
        required: FAUCET_CONFIG.minBalance
      });
    }

    // Check daily limit
    if (stats.dailyDistributed >= FAUCET_CONFIG.maxDaily) {
      return res.status(503).json({
        success: false,
        error: 'Daily distribution limit reached. Please try again tomorrow.',
        dailyLimit: FAUCET_CONFIG.maxDaily
      });
    }

    // Validate VLY address
    if (!isValidVLYAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid VLY address format. Address must start with "vly1".'
      });
    }

    // Send VLY
    try {
      const txid = await vlyClient.sendToAddress(address, FAUCET_CONFIG.amount, 'VLY Faucet');
      
      // Update statistics
      stats.totalRequests++;
      stats.totalDistributed += FAUCET_CONFIG.amount;
      stats.dailyDistributed += FAUCET_CONFIG.amount;

      logger.info(`Faucet sent ${FAUCET_CONFIG.amount} VLY to ${address}, txid: ${txid}`);

      res.json({
        success: true,
        data: {
          txid: txid,
          amount: FAUCET_CONFIG.amount,
          address: address,
          timestamp: new Date().toISOString(),
          network: process.env.VLY_NETWORK || 'regtest'
        }
      });

    } catch (sendError) {
      stats.errors++;
      logger.error('Failed to send VLY:', sendError);
      
      // Reset rate limiter on send failure
      await rateLimiter.delete(req.ip);
      
      res.status(500).json({
        success: false,
        error: 'Failed to send VLY. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? sendError.message : undefined
      });
    }

  } catch (error) {
    stats.errors++;
    logger.error('Faucet request error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Admin routes (protected by simple auth)
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const adminKey = process.env.ADMIN_KEY;
  
  if (!adminKey || !authHeader || authHeader !== `Bearer ${adminKey}`) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }
  next();
};

// Reset daily statistics (admin only)
app.post('/admin/reset-daily', adminAuth, (req, res) => {
  stats.dailyDistributed = 0;
  stats.lastResetDate = new Date().toDateString();
  
  logger.info('Daily statistics reset by admin');
  
  res.json({
    success: true,
    message: 'Daily statistics reset',
    data: stats
  });
});

// Update faucet configuration (admin only)
app.post('/admin/config', adminAuth, (req, res) => {
  const { amount, minBalance, maxDaily } = req.body;
  
  if (amount && amount > 0) FAUCET_CONFIG.amount = amount;
  if (minBalance && minBalance > 0) FAUCET_CONFIG.minBalance = minBalance;
  if (maxDaily && maxDaily > 0) FAUCET_CONFIG.maxDaily = maxDaily;
  
  logger.info('Faucet configuration updated by admin', { amount, minBalance, maxDaily });
  
  res.json({
    success: true,
    message: 'Configuration updated',
    data: FAUCET_CONFIG
  });
});

// Get detailed admin statistics
app.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    const balance = await getFaucetBalance();
    const networkInfo = await vlyClient.getNetworkInfo();
    const blockchainInfo = await vlyClient.getBlockchainInfo();
    
    res.json({
      success: true,
      data: {
        faucet: {
          ...stats,
          config: FAUCET_CONFIG,
          balance: balance
        },
        network: {
          version: networkInfo.version,
          subversion: networkInfo.subversion,
          connections: networkInfo.connections,
          network: networkInfo.networkactive
        },
        blockchain: {
          chain: blockchainInfo.chain,
          blocks: blockchainInfo.blocks,
          headers: blockchainInfo.headers,
          difficulty: blockchainInfo.difficulty
        }
      }
    });
  } catch (error) {
    logger.error('Error getting admin stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get admin statistics'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Scheduled tasks
// Reset daily statistics at midnight
cron.schedule('0 0 * * *', () => {
  const today = new Date().toDateString();
  if (stats.lastResetDate !== today) {
    stats.dailyDistributed = 0;
    stats.lastResetDate = today;
    logger.info('Daily statistics reset automatically');
  }
});

// Update balance every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await getFaucetBalance();
  } catch (error) {
    logger.error('Failed to update balance:', error);
  }
});

// Server startup
async function startServer() {
  try {
    // Test VLY node connection
    await vlyClient.getBlockchainInfo();
    logger.info('Connected to VLY node successfully');
    
    // Get faucet address
    await getFaucetAddress();
    logger.info(`Faucet address: ${FAUCET_CONFIG.address}`);
    
    // Update initial balance
    await getFaucetBalance();
    logger.info(`Faucet balance: ${stats.balance} VLY`);
    
    app.listen(PORT, () => {
      logger.info(`VLY Faucet running on port ${PORT}`);
      logger.info(`Network: ${process.env.VLY_NETWORK || 'regtest'}`);
      logger.info(`Faucet amount: ${FAUCET_CONFIG.amount} VLY`);
      logger.info(`Cooldown: ${process.env.FAUCET_COOLDOWN || '3600'} seconds`);
    });
    
  } catch (error) {
    logger.error('Failed to start faucet server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;