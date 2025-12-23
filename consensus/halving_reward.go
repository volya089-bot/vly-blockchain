package consensus

import (
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"math/big"
)

const (
	// HalvingInterval defines how often the block reward halves (every 210,000 blocks like Bitcoin)
	HalvingInterval = 210000

	// InitialBlockReward is the initial reward per block in Wei (5 WLY)
	InitialBlockReward = 5000000000000000000

	// OwnerRewardPercentage is the percentage of each block reward that goes to the owner (20%)
	OwnerRewardPercentage = 20

	// OwnerAddress receives 20% of all block rewards
	OwnerAddress = "0x742d35Cc6634C0532925a3b8D75C4A9c4b8b8b8b"
)

// CalculateBlockReward calculates the block reward based on block number with halving
func CalculateBlockReward(blockNumber uint64) *big.Int {
	halvings := blockNumber / HalvingInterval

	// Start with initial reward
	reward := big.NewInt(InitialBlockReward)

	// Apply halving: reward = reward / (2^halvings)
	for i := uint64(0); i < halvings; i++ {
		reward = new(big.Int).Div(reward, big.NewInt(2))
	}

	// Minimum reward of 1 Wei to prevent zero rewards
	if reward.Cmp(big.NewInt(1)) < 0 {
		reward = big.NewInt(1)
	}

	return reward
}

// CalculateOwnerReward calculates the 20% owner reward from the total block reward
func CalculateOwnerReward(totalReward *big.Int) *big.Int {
	ownerReward := new(big.Int).Mul(totalReward, big.NewInt(OwnerRewardPercentage))
	ownerReward = new(big.Int).Div(ownerReward, big.NewInt(100))
	return ownerReward
}

// CalculateMinerReward calculates the miner reward (total - owner reward)
func CalculateMinerReward(totalReward *big.Int) *big.Int {
	ownerReward := CalculateOwnerReward(totalReward)
	minerReward := new(big.Int).Sub(totalReward, ownerReward)
	return minerReward
}

// GetOwnerAddress returns the owner address as common.Address
func GetOwnerAddress() common.Address {
	return common.HexToAddress(OwnerAddress)
}

// ApplyBlockRewards applies the block rewards to the given state with halving and owner reward
func ApplyBlockRewards(header *types.Header, coinbase common.Address, state StateDB) {
	blockNumber := header.Number.Uint64()
	totalReward := CalculateBlockReward(blockNumber)

	// Calculate miner and owner rewards
	minerReward := CalculateMinerReward(totalReward)
	ownerReward := CalculateOwnerReward(totalReward)
	ownerAddr := GetOwnerAddress()

	// Add rewards to balances
	state.AddBalance(coinbase, minerReward)
	state.AddBalance(ownerAddr, ownerReward)
}

// StateDB interface for state manipulation
type StateDB interface {
	AddBalance(common.Address, *big.Int)
	SubBalance(common.Address, *big.Int)
	GetBalance(common.Address) *big.Int
	SetBalance(common.Address, *big.Int)
}
