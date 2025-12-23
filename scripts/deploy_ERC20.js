const hre = require("hardhat");

async function main() {
  console.log("🪙 Deploying ERC20WLY token contract...");

  // Get the ContractFactory and Signers here
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.getBalance();
  console.log("Account balance:", hre.ethers.utils.formatEther(balance));

  // Deploy ERC20WLY token
  const ERC20WLY = await hre.ethers.getContractFactory("ERC20WLY");
  const erc20 = await ERC20WLY.deploy(
    "WLY Token",        // name
    "WLY",             // symbol
    18,                // decimals
    1000000            // total supply (1M tokens)
  );

  await erc20.deployed();

  console.log("✅ ERC20WLY deployed to:", erc20.address);
  console.log("📊 Token details:");
  console.log("   Name:", await erc20.name());
  console.log("   Symbol:", await erc20.symbol());
  console.log("   Decimals:", await erc20.decimals());
  console.log("   Total Supply:", hre.ethers.utils.formatEther(await erc20.totalSupply()));
  console.log("   Owner:", await erc20.owner());

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contract: "ERC20WLY",
    address: erc20.address,
    deployer: deployer.address,
    blockNumber: erc20.deployTransaction.blockNumber,
    transactionHash: erc20.deployTransaction.hash,
    timestamp: new Date().toISOString()
  };

  const fs = require('fs');
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }
  
  fs.writeFileSync(
    `deployments/ERC20WLY-${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("💾 Deployment info saved to deployments/ERC20WLY-" + hre.network.name + ".json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });