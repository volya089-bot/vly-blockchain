package consensus

import (
	"math/big"
	"testing"
)

func TestOwnerAddress(t *testing.T) {
	expected := "0x273Cac41cd1aA2845A5A15B5183a428eaB62E050"
	if GetOwnerAddress() != expected {
		t.Errorf("GetOwnerAddress() = %v, want %v", GetOwnerAddress(), expected)
	}
}

func TestCalculateBlockReward(t *testing.T) {
	tests := []struct {
		blockHeight    uint64
		expectedReward string // in wei
	}{
		{0, "50000000000000000000"},     // Initial reward: 50 VLY
		{210000, "25000000000000000000"}, // After first halving: 25 VLY
		{420000, "12500000000000000000"}, // After second halving: 12.5 VLY
		{630000, "6250000000000000000"},  // After third halving: 6.25 VLY
	}

	for _, test := range tests {
		reward := CalculateBlockReward(test.blockHeight)
		expected, _ := new(big.Int).SetString(test.expectedReward, 10)
		if reward.Cmp(expected) != 0 {
			t.Errorf("CalculateBlockReward(%v) = %v, want %v", test.blockHeight, reward, expected)
		}
	}
}

func TestCalculateOwnerReward(t *testing.T) {
	tests := []struct {
		blockHeight   uint64
		expectedReward string // 20% of block reward
	}{
		{0, "10000000000000000000"},     // 20% of 50 VLY = 10 VLY
		{210000, "5000000000000000000"}, // 20% of 25 VLY = 5 VLY
		{420000, "2500000000000000000"}, // 20% of 12.5 VLY = 2.5 VLY
	}

	for _, test := range tests {
		reward := CalculateOwnerReward(test.blockHeight)
		expected, _ := new(big.Int).SetString(test.expectedReward, 10)
		if reward.Cmp(expected) != 0 {
			t.Errorf("CalculateOwnerReward(%v) = %v, want %v", test.blockHeight, reward, expected)
		}
	}
}

func TestCalculateMinerReward(t *testing.T) {
	tests := []struct {
		blockHeight   uint64
		expectedReward string // 80% of block reward
	}{
		{0, "40000000000000000000"},     // 80% of 50 VLY = 40 VLY
		{210000, "20000000000000000000"}, // 80% of 25 VLY = 20 VLY
		{420000, "10000000000000000000"}, // 80% of 12.5 VLY = 10 VLY
	}

	for _, test := range tests {
		reward := CalculateMinerReward(test.blockHeight)
		expected, _ := new(big.Int).SetString(test.expectedReward, 10)
		if reward.Cmp(expected) != 0 {
			t.Errorf("CalculateMinerReward(%v) = %v, want %v", test.blockHeight, reward, expected)
		}
	}
}

func TestRewardSplit(t *testing.T) {
	// Test that owner reward + miner reward = total block reward
	testBlocks := []uint64{0, 100000, 210000, 300000, 420000}
	
	for _, blockHeight := range testBlocks {
		blockReward := CalculateBlockReward(blockHeight)
		ownerReward := CalculateOwnerReward(blockHeight)
		minerReward := CalculateMinerReward(blockHeight)
		
		sum := new(big.Int).Add(ownerReward, minerReward)
		
		if sum.Cmp(blockReward) != 0 {
			t.Errorf("At block %v: owner(%v) + miner(%v) = %v, want %v", 
				blockHeight, ownerReward, minerReward, sum, blockReward)
		}
	}
}

func TestOwnerRewardPercentage(t *testing.T) {
	// Test that owner always gets exactly 20% (within rounding errors)
	testBlocks := []uint64{0, 100000, 210000, 300000, 420000}
	
	for _, blockHeight := range testBlocks {
		blockReward := CalculateBlockReward(blockHeight)
		ownerReward := CalculateOwnerReward(blockHeight)
		
		// Calculate percentage: (ownerReward * 100) / blockReward
		percentage := new(big.Int).Mul(ownerReward, big.NewInt(100))
		percentage.Div(percentage, blockReward)
		
		if percentage.Cmp(big.NewInt(20)) != 0 {
			t.Errorf("At block %v: owner percentage = %v%%, want 20%%", blockHeight, percentage)
		}
	}
}