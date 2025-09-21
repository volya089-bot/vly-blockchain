#!/bin/sh

# Start Geth with WLY blockchain configuration
exec geth \
  --datadir /home/ethereum/.ethereum \
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
  --miner.etherbase 0x742d35Cc6634C0532925a3b8D75C4A9c4b8b8b8b \
  --unlock 0x742d35Cc6634C0532925a3b8D75C4A9c4b8b8b8b \
  --password /dev/null \
  --allow-insecure-unlock \
  --nodiscover \
  --maxpeers 0 \
  --verbosity 3 \
  --dev.period 0.4 \
  --dev \
  --console