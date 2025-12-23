package consensus

import (
	"math/big"
)

// OwnerAddress is the address that receives 20% of mining rewards
const OwnerAddress = "0x273Cac41cd1aA2845A5A15B5183a428eaB62E050"

// OwnerRewardPercentage defines the percentage of mining rewards that go to the owner
const OwnerRewardPercentage = 20

// HalvingInterval defines the number of blocks between halvings (210,000 blocks)
const HalvingInterval = 210000

// InitialBlockReward defines the initial block reward in wei (50 VLY)
var InitialBlockReward = new(big.Int).Mul(big.NewInt(50), big.NewInt(1e18))

// CalculateBlockReward calculates the total block reward based on block height
func CalculateBlockReward(blockHeight uint64) *big.Int {
	// Calculate number of halvings
	halvings := blockHeight / HalvingInterval
	
	// Start with initial reward
	reward := new(big.Int).Set(InitialBlockReward)
	
	// Apply halvings
	for i := uint64(0); i < halvings; i++ {
		reward.Div(reward, big.NewInt(2))
	}
	
	// Minimum reward is 1 wei to prevent zero rewards
	if reward.Cmp(big.NewInt(1)) < 0 {
		reward.Set(big.NewInt(1))
	}
	
	return reward
}

// CalculateOwnerReward calculates the owner's reward (20% of block reward)
func CalculateOwnerReward(blockHeight uint64) *big.Int {
	blockReward := CalculateBlockReward(blockHeight)
	ownerReward := new(big.Int).Mul(blockReward, big.NewInt(OwnerRewardPercentage))
	ownerReward.Div(ownerReward, big.NewInt(100))
	return ownerReward
}

// CalculateMinerReward calculates the miner's reward (80% of block reward)
func CalculateMinerReward(blockHeight uint64) *big.Int {
	blockReward := CalculateBlockReward(blockHeight)
	ownerReward := CalculateOwnerReward(blockHeight)
	minerReward := new(big.Int).Sub(blockReward, ownerReward)
	return minerReward
}

// GetOwnerAddress returns the owner address
func GetOwnerAddress() string {
	return OwnerAddress
}