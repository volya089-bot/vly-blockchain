const hre = require("hardhat");

async function main() {
  console.log("🎨 Deploying ERC721WLY NFT contract...");

  // Get the ContractFactory and Signers here
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance));

  // Deploy ERC721WLY NFT
  const ERC721WLY = await hre.ethers.getContractFactory("ERC721WLY");
  const erc721 = await ERC721WLY.deploy(
    "WLY NFT Collection",  // name
    "WLYNFT"              // symbol
  );

  await erc721.deployed();

  console.log("✅ ERC721WLY deployed to:", erc721.address);
  console.log("📊 NFT details:");
  console.log("   Name:", await erc721.name());
  console.log("   Symbol:", await erc721.symbol());
  console.log("   Owner:", await erc721.owner());
  console.log("   Total Supply:", await erc721.totalSupply());

  // Mint a sample NFT to the deployer
  console.log("🎨 Minting sample NFT...");
  const mintTx = await erc721.mint(
    deployer.address,
    "https://gateway.pinata.cloud/ipfs/QmYourSampleNFTMetadata"
  );
  await mintTx.wait();

  const totalSupply = await erc721.totalSupply();
  console.log("✅ Sample NFT minted! Total supply:", totalSupply.toString());

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contract: "ERC721WLY",
    address: erc721.address,
    deployer: deployer.address,
    blockNumber: erc721.deployTransaction.blockNumber,
    transactionHash: erc721.deployTransaction.hash,
    sampleNFTMinted: true,
    timestamp: new Date().toISOString()
  };

  const fs = require('fs');
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }
  
  fs.writeFileSync(
    `deployments/ERC721WLY-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("💾 Deployment info saved to deployments/ERC721WLY-" + hre.network.name + ".json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });