package main

import (
	"fmt"
	"math/big"
	"strconv"

	"../consensus"
)

func main() {
	fmt.Println("VLY Blockchain Owner Reward System Demo")
	fmt.Println("======================================")
	fmt.Println()

	// Owner address
	fmt.Printf("Owner Address: %s\n", consensus.GetOwnerAddress())
	fmt.Println()

	// Demonstrate rewards at different block heights
	testBlocks := []uint64{0, 50000, 100000, 210000, 420000, 630000, 840000}

	fmt.Println("Block Reward Distribution:")
	fmt.Printf("%-10s %-15s %-15s %-15s\n", "Block", "Total Reward", "Owner (20%)", "Miner (80%)")
	fmt.Println("---------------------------------------------------------------")

	for _, blockHeight := range testBlocks {
		totalReward := consensus.CalculateBlockReward(blockHeight)
		ownerReward := consensus.CalculateOwnerReward(blockHeight)
		minerReward := consensus.CalculateMinerReward(blockHeight)

		// Convert from wei to VLY (divide by 10^18)
		totalVLY := new(big.Float).Quo(new(big.Float).SetInt(totalReward), big.NewFloat(1e18))
		ownerVLY := new(big.Float).Quo(new(big.Float).SetInt(ownerReward), big.NewFloat(1e18))
		minerVLY := new(big.Float).Quo(new(big.Float).SetInt(minerReward), big.NewFloat(1e18))

		fmt.Printf("%-10s %-15s %-15s %-15s\n", 
			strconv.FormatUint(blockHeight, 10),
			totalVLY.Text('f', 2) + " VLY",
			ownerVLY.Text('f', 2) + " VLY",
			minerVLY.Text('f', 2) + " VLY")
	}

	fmt.Println()
	fmt.Println("Halving Schedule:")
	fmt.Println("- Block 0-209,999: 50 VLY per block")
	fmt.Println("- Block 210,000-419,999: 25 VLY per block")
	fmt.Println("- Block 420,000-629,999: 12.5 VLY per block")
	fmt.Println("- And so on...")
}