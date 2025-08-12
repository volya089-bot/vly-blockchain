# vly-blockchain
VLY Blockchain — Bitcoin Core fork (21,000,000 supply, SHA-256, genesis premine 1,000,000 VLY)
# 1) Взяти код Bitcoin Core (v26.1)
git clone https://github.com/bitcoin/bitcoin.git vly-src
cd vly-src
git checkout v26.1

# 2) Під’єднати свій репозиторій
git remote remove origin
git remote add origin https://github.com/volya089-bot/vly-blockchain.git

# 3) Запушити у твій репо (в гілку main)
git push -u origin HEAD:main
