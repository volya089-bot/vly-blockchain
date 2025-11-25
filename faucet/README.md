# VLY Faucet Service

A Node.js-based faucet service for the VLY blockchain that allows users to request testnet VLY tokens.

## Features

- **Rate Limiting**: IP-based cooldown system to prevent abuse
- **Balance Management**: Automatic monitoring of faucet wallet balance
- **Daily Limits**: Configurable daily distribution limits
- **Statistics**: Tracking of requests, distributions, and errors
- **Admin Panel**: Administrative endpoints for configuration and monitoring
- **Security**: Rate limiting, input validation, and CORS protection
- **Logging**: Comprehensive logging for monitoring and debugging

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start VLY Node**
   Make sure your VLY node is running with RPC enabled:
   ```bash
   # Example vlycoin.conf
   server=1
   rpcuser=vlyrpc
   rpcpassword=vlypass
   rpcbind=127.0.0.1
   rpcport=18443
   ```

4. **Start Faucet**
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `VLY_NETWORK` | VLY network (regtest/testnet/mainnet) | regtest |
| `VLY_RPC_HOST` | VLY node RPC host | localhost |
| `VLY_RPC_PORT` | VLY node RPC port | 18443 |
| `VLY_RPC_USER` | VLY node RPC username | vlyrpc |
| `VLY_RPC_PASSWORD` | VLY node RPC password | vlypass |
| `FAUCET_AMOUNT` | Amount of VLY to send per request | 1.0 |
| `FAUCET_COOLDOWN` | Cooldown between requests (seconds) | 3600 |
| `FAUCET_MIN_BALANCE` | Minimum faucet balance to operate | 100.0 |
| `FAUCET_MAX_DAILY` | Maximum daily distribution | 100.0 |
| `FAUCET_WALLET` | Wallet name for faucet | vlywallet |
| `ADMIN_KEY` | Admin API key | - |

## API Endpoints

### Public Endpoints

#### GET /health
Health check endpoint
```json
{
  "success": true,
  "service": "VLY Faucet",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### GET /info
Get faucet information
```json
{
  "success": true,
  "data": {
    "amount": 1.0,
    "cooldown": 3600,
    "balance": 1000.0,
    "address": "vly1...",
    "minBalance": 100.0,
    "network": "regtest",
    "active": true
  }
}
```

#### GET /stats
Get faucet statistics
```json
{
  "success": true,
  "data": {
    "totalRequests": 150,
    "totalDistributed": 150.0,
    "dailyDistributed": 25.0,
    "lastResetDate": "Mon Jan 01 2024",
    "errors": 2,
    "balance": 975.0,
    "remainingDaily": 75.0,
    "active": true
  }
}
```

#### POST /request
Request VLY tokens
```json
// Request
{
  "address": "vly1qp3k7m8y5r6w2e4t6u8i0p9l8k7j6h5g4f3d2s1a"
}

// Success Response
{
  "success": true,
  "data": {
    "txid": "a1b2c3d4e5f6...",
    "amount": 1.0,
    "address": "vly1qp3k7m8y5r6w2e4t6u8i0p9l8k7j6h5g4f3d2s1a",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "network": "regtest"
  }
}

// Error Response (rate limited)
{
  "success": false,
  "error": "Faucet cooldown active. Please try again later.",
  "retryAfter": 3200,
  "cooldown": 3600
}
```

### Admin Endpoints

All admin endpoints require authentication header:
```
Authorization: Bearer <ADMIN_KEY>
```

#### POST /admin/reset-daily
Reset daily statistics

#### POST /admin/config
Update faucet configuration
```json
{
  "amount": 2.0,
  "minBalance": 150.0,
  "maxDaily": 200.0
}
```

#### GET /admin/stats
Get detailed admin statistics

## Usage Examples

### Request Tokens via cURL
```bash
curl -X POST http://localhost:3001/request \
  -H "Content-Type: application/json" \
  -d '{"address": "vly1qp3k7m8y5r6w2e4t6u8i0p9l8k7j6h5g4f3d2s1a"}'
```

### Check Faucet Status
```bash
curl http://localhost:3001/info
```

### Admin Reset Daily Limit
```bash
curl -X POST http://localhost:3001/admin/reset-daily \
  -H "Authorization: Bearer your-admin-key"
```

## Security Features

- **Rate Limiting**: Prevents spam and abuse
- **Input Validation**: Address format validation
- **CORS Protection**: Cross-origin request security
- **Helmet Security**: Additional HTTP security headers
- **Admin Authentication**: Secure admin endpoints

## Error Handling

The faucet handles various error conditions:

- Invalid VLY addresses
- Insufficient faucet balance
- Daily distribution limits reached
- Network connectivity issues
- Node synchronization problems

## Logging

Logs are written to:
- `faucet.log` - General application logs
- `faucet-error.log` - Error logs only
- Console - Real-time output during development

## Development

### Run in Development Mode
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Environment Setup for Different Networks

**Testnet:**
```env
VLY_NETWORK=testnet
VLY_RPC_PORT=18773
```

**Mainnet:**
```env
VLY_NETWORK=mainnet
VLY_RPC_PORT=18772
FAUCET_AMOUNT=0.1
```

## Deployment

1. **Production Environment**
   ```bash
   NODE_ENV=production npm start
   ```

2. **Docker Deployment**
   ```dockerfile
   FROM node:18
   WORKDIR /app
   COPY package*.json ./
   RUN npm install --production
   COPY . .
   EXPOSE 3001
   CMD ["npm", "start"]
   ```

3. **Reverse Proxy (Nginx)**
   ```nginx
   location /faucet {
     proxy_pass http://localhost:3001;
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
   }
   ```

## Monitoring

- Check `/health` endpoint for service status
- Monitor logs for errors and performance
- Use `/admin/stats` for detailed metrics
- Set up alerts for low balance conditions

## Security Considerations

1. **Keep admin key secret**
2. **Use HTTPS in production**
3. **Monitor for unusual request patterns**
4. **Regular backup of faucet wallet**
5. **Implement additional anti-bot measures if needed**

## Troubleshooting

### Common Issues

1. **Connection Error**
   - Check VLY node is running
   - Verify RPC credentials
   - Check network connectivity

2. **Low Balance**
   - Send more VLY to faucet address
   - Check wallet is unlocked

3. **Address Validation Errors**
   - Ensure address starts with "vly1"
   - Check address length and format

### Debug Mode
Set `NODE_ENV=development` for detailed error messages.

## Support

For issues and feature requests, please open an issue in the VLY blockchain repository.