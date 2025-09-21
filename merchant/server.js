const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const Client = require('bitcoin-core');
const Joi = require('joi');
const winston = require('winston');
const NodeCache = require('node-cache');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const qr = require('qr-image');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'merchant-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'merchant.log' }),
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

// Cache for payment requests and confirmations
const paymentCache = new NodeCache({
  stdTTL: parseInt(process.env.PAYMENT_TTL || '3600'), // 1 hour default
  checkperiod: 60
});

// Rate limiter configuration
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 50, // Number of requests
  duration: 60, // Per 1 minute
});

// In-memory storage for demo (use database in production)
const merchants = new Map();
const paymentRequests = new Map();
const webhookQueue = [];

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
const merchantSchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  email: Joi.string().email().required(),
  website: Joi.string().uri().optional(),
  callback_url: Joi.string().uri().optional(),
  description: Joi.string().max(500).optional()
});

const paymentRequestSchema = Joi.object({
  merchant_id: Joi.string().required(),
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid('VLY').default('VLY'),
  order_id: Joi.string().required().max(100),
  description: Joi.string().max(500).optional(),
  customer_email: Joi.string().email().optional(),
  callback_url: Joi.string().uri().optional(),
  success_url: Joi.string().uri().optional(),
  cancel_url: Joi.string().uri().optional(),
  expires_in: Joi.number().integer().min(300).max(86400).default(3600) // 5 min to 24 hours
});

// Utility functions
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function generateSecretKey() {
  return crypto.randomBytes(64).toString('hex');
}

function createSignature(data, secret) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex');
}

function verifySignature(data, signature, secret) {
  const expectedSignature = createSignature(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

async function generatePaymentAddress(merchantId, paymentId) {
  try {
    // Generate a unique address for this payment
    const label = `merchant_${merchantId}_payment_${paymentId}`;
    const address = await vlyClient.getNewAddress(label, 'bech32');
    return address;
  } catch (error) {
    logger.error('Failed to generate payment address:', error);
    throw new Error('Failed to generate payment address');
  }
}

// Authentication middleware
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }

  const merchant = Array.from(merchants.values()).find(m => m.api_key === apiKey);
  if (!merchant) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  req.merchant = merchant;
  next();
}

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'VLY Merchant API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Register merchant
app.post('/merchant/register', async (req, res) => {
  try {
    const { error, value } = merchantSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const merchantId = uuidv4();
    const apiKey = generateApiKey();
    const secretKey = generateSecretKey();

    const merchant = {
      id: merchantId,
      ...value,
      api_key: apiKey,
      secret_key: secretKey,
      created_at: new Date().toISOString(),
      active: true,
      total_payments: 0,
      total_amount: 0
    };

    merchants.set(merchantId, merchant);

    logger.info(`New merchant registered: ${merchant.name} (${merchantId})`);

    res.json({
      success: true,
      data: {
        merchant_id: merchantId,
        api_key: apiKey,
        secret_key: secretKey,
        message: 'Merchant registered successfully. Keep your API key and secret key safe!'
      }
    });

  } catch (error) {
    logger.error('Error registering merchant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register merchant'
    });
  }
});

// Get merchant info
app.get('/merchant/info', authenticateApiKey, (req, res) => {
  const { secret_key, api_key, ...merchantInfo } = req.merchant;
  res.json({
    success: true,
    data: merchantInfo
  });
});

// Create payment request
app.post('/payment/create', authenticateApiKey, async (req, res) => {
  try {
    const { error, value } = paymentRequestSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Verify merchant_id matches authenticated merchant
    if (value.merchant_id !== req.merchant.id) {
      return res.status(403).json({
        success: false,
        error: 'Merchant ID mismatch'
      });
    }

    const paymentId = uuidv4();
    const paymentAddress = await generatePaymentAddress(req.merchant.id, paymentId);
    const expiresAt = new Date(Date.now() + (value.expires_in * 1000));

    const paymentRequest = {
      id: paymentId,
      merchant_id: req.merchant.id,
      amount: value.amount,
      currency: value.currency,
      order_id: value.order_id,
      description: value.description,
      customer_email: value.customer_email,
      callback_url: value.callback_url || req.merchant.callback_url,
      success_url: value.success_url,
      cancel_url: value.cancel_url,
      payment_address: paymentAddress,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      confirmations: 0,
      received_amount: 0,
      txid: null
    };

    paymentRequests.set(paymentId, paymentRequest);
    paymentCache.set(paymentAddress, paymentId);

    logger.info(`Payment request created: ${paymentId} for ${value.amount} VLY`);

    res.json({
      success: true,
      data: {
        payment_id: paymentId,
        payment_address: paymentAddress,
        amount: value.amount,
        currency: value.currency,
        expires_at: paymentRequest.expires_at,
        qr_code_url: `/payment/${paymentId}/qr`,
        payment_url: `/payment/${paymentId}`,
        status: 'pending'
      }
    });

  } catch (error) {
    logger.error('Error creating payment request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment request'
    });
  }
});

// Get payment status
app.get('/payment/:paymentId', (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = paymentRequests.get(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment request not found'
      });
    }

    // Check if payment has expired
    if (new Date() > new Date(payment.expires_at) && payment.status === 'pending') {
      payment.status = 'expired';
      paymentRequests.set(paymentId, payment);
    }

    const responseData = {
      payment_id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      payment_address: payment.payment_address,
      received_amount: payment.received_amount,
      confirmations: payment.confirmations,
      txid: payment.txid,
      created_at: payment.created_at,
      expires_at: payment.expires_at
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    logger.error('Error getting payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment status'
    });
  }
});

// Generate QR code for payment
app.get('/payment/:paymentId/qr', (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = paymentRequests.get(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment request not found'
      });
    }

    // Create VLY URI
    const vlyUri = `vly:${payment.payment_address}?amount=${payment.amount}&label=${encodeURIComponent(payment.description || 'VLY Payment')}`;
    
    const qrCodePng = qr.image(vlyUri, { type: 'png', size: 10 });
    
    res.setHeader('Content-Type', 'image/png');
    qrCodePng.pipe(res);

  } catch (error) {
    logger.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate QR code'
    });
  }
});

// List merchant payments
app.get('/merchant/payments', authenticateApiKey, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const status = req.query.status;

    let merchantPayments = Array.from(paymentRequests.values())
      .filter(p => p.merchant_id === req.merchant.id);

    if (status) {
      merchantPayments = merchantPayments.filter(p => p.status === status);
    }

    // Sort by creation date (newest first)
    merchantPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedPayments = merchantPayments.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        payments: paginatedPayments,
        pagination: {
          page,
          limit,
          total: merchantPayments.length,
          totalPages: Math.ceil(merchantPayments.length / limit),
          hasNext: endIndex < merchantPayments.length,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error listing payments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list payments'
    });
  }
});

// Webhook endpoint for testing
app.post('/webhook/test', (req, res) => {
  logger.info('Test webhook received:', req.body);
  res.json({ success: true, message: 'Webhook received' });
});

// Payment monitoring functions
async function checkPaymentAddress(address) {
  try {
    // Get all transactions for the address
    const addressInfo = await vlyClient.validateAddress(address);
    if (!addressInfo.isvalid) {
      return null;
    }

    // In a real implementation, you would need to:
    // 1. Use listreceivedbyaddress or similar RPC call
    // 2. Or implement address indexing
    // 3. Or use a third-party service
    
    // For now, we'll use a simple approach with listunspent
    const unspent = await vlyClient.listUnspent(0, 9999999, [address]);
    
    if (unspent.length > 0) {
      const totalReceived = unspent.reduce((sum, utxo) => sum + utxo.amount, 0);
      const confirmations = Math.min(...unspent.map(utxo => utxo.confirmations));
      const txid = unspent[0].txid;
      
      return {
        amount: totalReceived,
        confirmations,
        txid
      };
    }

    return null;
  } catch (error) {
    logger.error(`Error checking payment address ${address}:`, error);
    return null;
  }
}

async function processWebhook(payment, event) {
  if (!payment.callback_url) return;

  const webhookData = {
    event,
    payment_id: payment.id,
    merchant_id: payment.merchant_id,
    order_id: payment.order_id,
    amount: payment.amount,
    received_amount: payment.received_amount,
    currency: payment.currency,
    status: payment.status,
    confirmations: payment.confirmations,
    txid: payment.txid,
    timestamp: new Date().toISOString()
  };

  const merchant = merchants.get(payment.merchant_id);
  if (merchant && merchant.secret_key) {
    webhookData.signature = createSignature(webhookData, merchant.secret_key);
  }

  webhookQueue.push({
    url: payment.callback_url,
    data: webhookData,
    retries: 0
  });
}

// Payment monitoring job
async function monitorPayments() {
  try {
    const pendingPayments = Array.from(paymentRequests.values())
      .filter(p => p.status === 'pending' && new Date() < new Date(p.expires_at));

    for (const payment of pendingPayments) {
      const result = await checkPaymentAddress(payment.payment_address);
      
      if (result) {
        const wasFirstPayment = payment.received_amount === 0;
        payment.received_amount = result.amount;
        payment.confirmations = result.confirmations;
        payment.txid = result.txid;

        if (result.amount >= payment.amount) {
          payment.status = result.confirmations >= 1 ? 'confirmed' : 'paid';
          
          if (payment.status === 'confirmed') {
            // Update merchant statistics
            const merchant = merchants.get(payment.merchant_id);
            if (merchant) {
              merchant.total_payments++;
              merchant.total_amount += payment.amount;
              merchants.set(payment.merchant_id, merchant);
            }
          }
        }

        paymentRequests.set(payment.id, payment);

        if (wasFirstPayment) {
          await processWebhook(payment, 'payment_received');
        }
        
        if (payment.status === 'confirmed') {
          await processWebhook(payment, 'payment_confirmed');
        }

        logger.info(`Payment ${payment.id} updated: ${payment.status}, amount: ${result.amount}, confirmations: ${result.confirmations}`);
      }
    }

    // Expire old payments
    const expiredPayments = Array.from(paymentRequests.values())
      .filter(p => p.status === 'pending' && new Date() > new Date(p.expires_at));

    for (const payment of expiredPayments) {
      payment.status = 'expired';
      paymentRequests.set(payment.id, payment);
      await processWebhook(payment, 'payment_expired');
      logger.info(`Payment ${payment.id} expired`);
    }

  } catch (error) {
    logger.error('Error monitoring payments:', error);
  }
}

// Webhook delivery job
async function processWebhooks() {
  while (webhookQueue.length > 0) {
    const webhook = webhookQueue.shift();
    
    try {
      const axios = require('axios');
      await axios.post(webhook.url, webhook.data, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'VLY-Merchant-API/1.0'
        }
      });
      
      logger.info(`Webhook delivered successfully to ${webhook.url}`);
    } catch (error) {
      webhook.retries++;
      if (webhook.retries < 3) {
        webhookQueue.push(webhook);
        logger.warn(`Webhook delivery failed, retrying (${webhook.retries}/3): ${webhook.url}`);
      } else {
        logger.error(`Webhook delivery failed permanently: ${webhook.url}`, error);
      }
    }
  }
}

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

// Scheduled jobs
// Monitor payments every 30 seconds
cron.schedule('*/30 * * * * *', monitorPayments);

// Process webhooks every 10 seconds
cron.schedule('*/10 * * * * *', processWebhooks);

// Server startup
async function startServer() {
  try {
    // Test VLY node connection
    await vlyClient.getBlockchainInfo();
    logger.info('Connected to VLY node successfully');
    
    app.listen(PORT, () => {
      logger.info(`VLY Merchant API running on port ${PORT}`);
      logger.info(`Network: ${process.env.VLY_NETWORK || 'regtest'}`);
    });
    
  } catch (error) {
    logger.error('Failed to start merchant server:', error);
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