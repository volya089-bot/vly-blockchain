const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const Client = require('bitcoin-core');
const Joi = require('joi');
const winston = require('winston');
const NodeCache = require('node-cache');
const moment = require('moment');
const Big = require('big.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'explorer-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'explorer.log' }),
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

// Cache configuration
const cache = new NodeCache({
  stdTTL: parseInt(process.env.CACHE_TTL || '60'), // 60 seconds default
  checkperiod: 30
});

// Rate limiter configuration
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 100, // Number of requests
  duration: 60, // Per 1 minute
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request rate limiting
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
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
const blockHashSchema = Joi.string().pattern(/^[0-9a-fA-F]{64}$/);
const blockHeightSchema = Joi.number().integer().min(0);
const txidSchema = Joi.string().pattern(/^[0-9a-fA-F]{64}$/);
const addressSchema = Joi.string().pattern(/^(vly1[a-zA-Z0-9]{39,59}|[13][a-zA-Z0-9]{25,62})$/);
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

// Utility functions
function formatVLY(satoshis) {
  return new Big(satoshis).div(100000000).toString();
}

function formatTransaction(tx, blockHeight = null, blockTime = null) {
  const formatted = {
    txid: tx.txid,
    version: tx.version,
    locktime: tx.locktime,
    size: tx.size,
    vsize: tx.vsize || tx.size,
    weight: tx.weight || tx.size * 4,
    fee: tx.fee ? formatVLY(tx.fee) : null,
    confirmations: tx.confirmations || 0,
    blockHeight: blockHeight || null,
    blockTime: blockTime || null,
    timestamp: blockTime ? moment.unix(blockTime).toISOString() : null,
    inputs: tx.vin.map(input => ({
      txid: input.txid,
      vout: input.vout,
      sequence: input.sequence,
      scriptSig: input.scriptSig ? {
        asm: input.scriptSig.asm,
        hex: input.scriptSig.hex
      } : null,
      witness: input.txinwitness || null,
      prevOutput: null // Will be populated if needed
    })),
    outputs: tx.vout.map(output => ({
      value: formatVLY(output.value * 100000000),
      n: output.n,
      scriptPubKey: {
        asm: output.scriptPubKey.asm,
        hex: output.scriptPubKey.hex,
        type: output.scriptPubKey.type,
        addresses: output.scriptPubKey.addresses || []
      }
    }))
  };

  return formatted;
}

function formatBlock(block) {
  return {
    hash: block.hash,
    height: block.height,
    version: block.version,
    versionHex: block.versionHex,
    merkleroot: block.merkleroot,
    time: block.time,
    timestamp: moment.unix(block.time).toISOString(),
    mediantime: block.mediantime,
    nonce: block.nonce,
    bits: block.bits,
    difficulty: block.difficulty,
    chainwork: block.chainwork,
    nTx: block.nTx || (block.tx ? block.tx.length : 0),
    previousblockhash: block.previousblockhash,
    nextblockhash: block.nextblockhash,
    size: block.size,
    strippedsize: block.strippedsize,
    weight: block.weight,
    confirmations: block.confirmations || 0
  };
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'VLY Explorer API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Get network info
app.get('/api/network', async (req, res) => {
  try {
    const cacheKey = 'network_info';
    let networkInfo = cache.get(cacheKey);
    
    if (!networkInfo) {
      const [blockchainInfo, networkInfo, mempoolInfo] = await Promise.all([
        vlyClient.getBlockchainInfo(),
        vlyClient.getNetworkInfo(),
        vlyClient.getMempoolInfo()
      ]);

      networkInfo = {
        blockchain: {
          chain: blockchainInfo.chain,
          blocks: blockchainInfo.blocks,
          headers: blockchainInfo.headers,
          bestblockhash: blockchainInfo.bestblockhash,
          difficulty: blockchainInfo.difficulty,
          mediantime: blockchainInfo.mediantime,
          verificationprogress: blockchainInfo.verificationprogress,
          initialblockdownload: blockchainInfo.initialblockdownload,
          chainwork: blockchainInfo.chainwork,
          size_on_disk: blockchainInfo.size_on_disk
        },
        network: {
          version: networkInfo.version,
          subversion: networkInfo.subversion,
          protocolversion: networkInfo.protocolversion,
          connections: networkInfo.connections,
          networks: networkInfo.networks,
          relayfee: formatVLY(networkInfo.relayfee * 100000000),
          incrementalfee: formatVLY(networkInfo.incrementalfee * 100000000)
        },
        mempool: {
          size: mempoolInfo.size,
          bytes: mempoolInfo.bytes,
          usage: mempoolInfo.usage,
          maxmempool: mempoolInfo.maxmempool,
          mempoolminfee: formatVLY(mempoolInfo.mempoolminfee * 100000000)
        }
      };

      cache.set(cacheKey, networkInfo, 30); // Cache for 30 seconds
    }

    res.json({
      success: true,
      data: networkInfo
    });

  } catch (error) {
    logger.error('Error getting network info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get network information'
    });
  }
});

// Get latest blocks
app.get('/api/blocks', async (req, res) => {
  try {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { page, limit } = value;
    const cacheKey = `blocks_${page}_${limit}`;
    let result = cache.get(cacheKey);

    if (!result) {
      const blockchainInfo = await vlyClient.getBlockchainInfo();
      const currentHeight = blockchainInfo.blocks;
      const startHeight = Math.max(0, currentHeight - ((page - 1) * limit));
      const endHeight = Math.max(0, startHeight - limit + 1);

      const blocks = [];
      for (let height = startHeight; height >= endHeight; height--) {
        try {
          const blockHash = await vlyClient.getBlockHash(height);
          const block = await vlyClient.getBlock(blockHash, 1);
          blocks.push(formatBlock(block));
        } catch (blockError) {
          logger.warn(`Failed to get block at height ${height}:`, blockError);
        }
      }

      result = {
        blocks,
        pagination: {
          page,
          limit,
          total: currentHeight + 1,
          totalPages: Math.ceil((currentHeight + 1) / limit),
          hasNext: startHeight > limit,
          hasPrev: page > 1
        }
      };

      cache.set(cacheKey, result, 10); // Cache for 10 seconds
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error getting blocks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blocks'
    });
  }
});

// Get block by hash or height
app.get('/api/block/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const includeTransactions = req.query.include_tx === 'true';
    
    let blockHash;
    
    // Determine if identifier is height or hash
    if (/^\d+$/.test(identifier)) {
      // Height
      const height = parseInt(identifier);
      blockHash = await vlyClient.getBlockHash(height);
    } else {
      // Hash
      const { error } = blockHashSchema.validate(identifier);
      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid block hash format'
        });
      }
      blockHash = identifier;
    }

    const cacheKey = `block_${blockHash}_${includeTransactions}`;
    let blockData = cache.get(cacheKey);

    if (!blockData) {
      const verbosity = includeTransactions ? 2 : 1;
      const block = await vlyClient.getBlock(blockHash, verbosity);
      
      blockData = formatBlock(block);
      
      if (includeTransactions && block.tx) {
        blockData.transactions = block.tx.map(tx => 
          formatTransaction(tx, block.height, block.time)
        );
      } else if (block.tx) {
        blockData.transactionIds = block.tx;
      }

      cache.set(cacheKey, blockData, 60); // Cache for 60 seconds
    }

    res.json({
      success: true,
      data: blockData
    });

  } catch (error) {
    if (error.code === -5) {
      return res.status(404).json({
        success: false,
        error: 'Block not found'
      });
    }
    
    logger.error('Error getting block:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get block'
    });
  }
});

// Get transaction by txid
app.get('/api/transaction/:txid', async (req, res) => {
  try {
    const { txid } = req.params;
    
    const { error } = txidSchema.validate(txid);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction ID format'
      });
    }

    const cacheKey = `tx_${txid}`;
    let txData = cache.get(cacheKey);

    if (!txData) {
      const tx = await vlyClient.getRawTransaction(txid, true);
      
      let blockHeight = null;
      let blockTime = null;
      
      if (tx.blockhash) {
        const block = await vlyClient.getBlock(tx.blockhash, 1);
        blockHeight = block.height;
        blockTime = block.time;
      }

      txData = formatTransaction(tx, blockHeight, blockTime);
      
      // Get input details
      for (let i = 0; i < txData.inputs.length; i++) {
        const input = txData.inputs[i];
        if (input.txid && input.vout !== undefined) {
          try {
            const prevTx = await vlyClient.getRawTransaction(input.txid, true);
            if (prevTx.vout[input.vout]) {
              input.prevOutput = {
                value: formatVLY(prevTx.vout[input.vout].value * 100000000),
                addresses: prevTx.vout[input.vout].scriptPubKey.addresses || []
              };
            }
          } catch (prevError) {
            logger.warn(`Failed to get previous output for ${input.txid}:${input.vout}`);
          }
        }
      }

      cache.set(cacheKey, txData, 300); // Cache for 5 minutes
    }

    res.json({
      success: true,
      data: txData
    });

  } catch (error) {
    if (error.code === -5) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    logger.error('Error getting transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction'
    });
  }
});

// Get address information
app.get('/api/address/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const { error } = addressSchema.validate(address);
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }

    const cacheKey = `address_${address}`;
    let addressData = cache.get(cacheKey);

    if (!addressData) {
      try {
        // Try to get address info (may not be available in all cases)
        const addressInfo = await vlyClient.validateAddress(address);
        
        addressData = {
          address: address,
          isValid: addressInfo.isvalid,
          type: addressInfo.isscript ? 'script' : 'pubkey',
          isWitness: addressInfo.iswitness || false,
          // Note: Balance and transaction history would require additional indexing
          // This is a basic implementation
          balance: '0', // Would need UTXO indexing
          received: '0', // Would need transaction indexing
          sent: '0', // Would need transaction indexing
          txCount: 0, // Would need transaction indexing
          transactions: [] // Would need transaction indexing
        };

      } catch (addressError) {
        addressData = {
          address: address,
          isValid: false,
          error: 'Address validation failed'
        };
      }

      cache.set(cacheKey, addressData, 60); // Cache for 60 seconds
    }

    res.json({
      success: true,
      data: addressData
    });

  } catch (error) {
    logger.error('Error getting address info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get address information'
    });
  }
});

// Search endpoint
app.get('/api/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const results = [];

    // Try to interpret as block height
    if (/^\d+$/.test(query)) {
      const height = parseInt(query);
      try {
        const blockHash = await vlyClient.getBlockHash(height);
        results.push({
          type: 'block',
          identifier: height.toString(),
          data: { height, hash: blockHash }
        });
      } catch (e) {
        // Block height doesn't exist
      }
    }

    // Try to interpret as block hash
    if (/^[0-9a-fA-F]{64}$/.test(query)) {
      try {
        const block = await vlyClient.getBlock(query, 1);
        results.push({
          type: 'block',
          identifier: query,
          data: { height: block.height, hash: query }
        });
      } catch (e) {
        // Try as transaction ID
        try {
          const tx = await vlyClient.getRawTransaction(query, true);
          results.push({
            type: 'transaction',
            identifier: query,
            data: { txid: query, confirmations: tx.confirmations || 0 }
          });
        } catch (e) {
          // Not found as block or transaction
        }
      }
    }

    // Try to interpret as address
    if (/^(vly1[a-zA-Z0-9]{39,59}|[13][a-zA-Z0-9]{25,62})$/.test(query)) {
      try {
        const addressInfo = await vlyClient.validateAddress(query);
        if (addressInfo.isvalid) {
          results.push({
            type: 'address',
            identifier: query,
            data: { address: query, isValid: true }
          });
        }
      } catch (e) {
        // Address validation failed
      }
    }

    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length
      }
    });

  } catch (error) {
    logger.error('Error searching:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

// Get mempool transactions
app.get('/api/mempool', async (req, res) => {
  try {
    const { error, value } = paginationSchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { page, limit } = value;
    const cacheKey = `mempool_${page}_${limit}`;
    let result = cache.get(cacheKey);

    if (!result) {
      const mempoolTxids = await vlyClient.getRawMempool();
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTxids = mempoolTxids.slice(startIndex, endIndex);

      const transactions = [];
      for (const txid of paginatedTxids) {
        try {
          const tx = await vlyClient.getRawTransaction(txid, true);
          transactions.push(formatTransaction(tx));
        } catch (txError) {
          logger.warn(`Failed to get mempool transaction ${txid}:`, txError);
        }
      }

      result = {
        transactions,
        pagination: {
          page,
          limit,
          total: mempoolTxids.length,
          totalPages: Math.ceil(mempoolTxids.length / limit),
          hasNext: endIndex < mempoolTxids.length,
          hasPrev: page > 1
        }
      };

      cache.set(cacheKey, result, 5); // Cache for 5 seconds
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error getting mempool:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get mempool transactions'
    });
  }
});

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const cacheKey = 'stats';
    let stats = cache.get(cacheKey);

    if (!stats) {
      const [blockchainInfo, mempoolInfo, networkInfo] = await Promise.all([
        vlyClient.getBlockchainInfo(),
        vlyClient.getMempoolInfo(),
        vlyClient.getNetworkInfo()
      ]);

      // Get recent blocks for average time calculation
      const recentBlocks = [];
      const currentHeight = blockchainInfo.blocks;
      for (let i = 0; i < Math.min(10, currentHeight); i++) {
        try {
          const blockHash = await vlyClient.getBlockHash(currentHeight - i);
          const block = await vlyClient.getBlock(blockHash, 1);
          recentBlocks.push(block);
        } catch (e) {
          break;
        }
      }

      let avgBlockTime = 600; // Default 10 minutes
      if (recentBlocks.length > 1) {
        const timeDiffs = [];
        for (let i = 1; i < recentBlocks.length; i++) {
          timeDiffs.push(recentBlocks[i-1].time - recentBlocks[i].time);
        }
        avgBlockTime = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
      }

      stats = {
        blockchain: {
          height: blockchainInfo.blocks,
          difficulty: blockchainInfo.difficulty,
          hashrate: blockchainInfo.difficulty * Math.pow(2, 32) / avgBlockTime,
          avgBlockTime: avgBlockTime,
          totalTransactions: null, // Would need additional indexing
          circulatingSupply: null // Would need calculation based on premine and mining
        },
        network: {
          connections: networkInfo.connections,
          version: networkInfo.version,
          protocolVersion: networkInfo.protocolversion
        },
        mempool: {
          size: mempoolInfo.size,
          bytes: mempoolInfo.bytes,
          usage: mempoolInfo.usage
        }
      };

      cache.set(cacheKey, stats, 60); // Cache for 60 seconds
    }

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
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

// Server startup
async function startServer() {
  try {
    // Test VLY node connection
    await vlyClient.getBlockchainInfo();
    logger.info('Connected to VLY node successfully');
    
    app.listen(PORT, () => {
      logger.info(`VLY Explorer API running on port ${PORT}`);
      logger.info(`Network: ${process.env.VLY_NETWORK || 'regtest'}`);
    });
    
  } catch (error) {
    logger.error('Failed to start explorer server:', error);
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