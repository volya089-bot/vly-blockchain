// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./WL20.sol";

/**
 * @title WLY Referral and Loyalty Program
 * @dev Smart contract for referral rewards and loyalty points on VLY blockchain
 * @author VLY Blockchain Team
 */
contract WLYReferral {
    // Events
    event UserRegistered(address indexed user, address indexed referrer, uint256 timestamp);
    event ReferralReward(address indexed referrer, address indexed referee, uint256 amount, uint256 level);
    event LoyaltyPointsEarned(address indexed user, uint256 points, string action);
    event LoyaltyPointsRedeemed(address indexed user, uint256 points, uint256 rewardAmount);
    event LevelUpgraded(address indexed user, uint256 oldLevel, uint256 newLevel);
    event ProgramParametersUpdated(address indexed admin);

    // Structs
    struct User {
        address referrer;
        address[] referrals;
        uint256 totalReferred;
        uint256 totalEarned;
        uint256 loyaltyPoints;
        uint256 level;
        uint256 registrationTime;
        bool isActive;
    }

    struct LoyaltyLevel {
        uint256 pointsRequired;
        uint256 rewardMultiplier; // In basis points (10000 = 100%)
        string name;
    }

    struct ReferralLevel {
        uint256 percentage; // In basis points
        uint256 maxReward; // Maximum reward per referral
    }

    // State variables
    address public admin;
    address public rewardToken; // WL20 token for rewards
    bool public programActive;

    // Referral system
    mapping(address => User) public users;
    mapping(address => bool) public isRegistered;
    
    // Referral rewards configuration (level => percentage)
    mapping(uint256 => ReferralLevel) public referralLevels;
    uint256 public maxReferralLevels;
    
    // Loyalty system
    mapping(uint256 => LoyaltyLevel) public loyaltyLevels;
    uint256 public maxLoyaltyLevels;
    
    // Points earning configuration
    mapping(string => uint256) public actionPoints; // action => points
    mapping(address => mapping(string => uint256)) public dailyActionCount;
    mapping(address => mapping(string => uint256)) public lastActionDay;
    mapping(string => uint256) public dailyActionLimit;
    
    // Loyalty redemption
    uint256 public pointsToTokenRatio; // How many points = 1 token (in wei)
    uint256 public minRedemptionPoints;
    
    // Statistics
    uint256 public totalUsers;
    uint256 public totalRewardsDistributed;
    uint256 public totalPointsIssued;
    
    // Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant SECONDS_PER_DAY = 86400;

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "WLYReferral: caller is not admin");
        _;
    }

    modifier onlyRegistered() {
        require(isRegistered[msg.sender], "WLYReferral: user not registered");
        _;
    }

    modifier programIsActive() {
        require(programActive, "WLYReferral: program is not active");
        _;
    }

    /**
     * @dev Constructor
     * @param _rewardToken Address of the WL20 reward token
     */
    constructor(address _rewardToken) {
        require(_rewardToken != address(0), "WLYReferral: invalid token address");
        
        admin = msg.sender;
        rewardToken = _rewardToken;
        programActive = true;
        
        // Initialize default referral levels
        _initializeReferralLevels();
        
        // Initialize default loyalty levels
        _initializeLoyaltyLevels();
        
        // Initialize default action points
        _initializeActionPoints();
        
        // Set default redemption parameters
        pointsToTokenRatio = 1000; // 1000 points = 1 token (1e18 wei)
        minRedemptionPoints = 1000;
    }

    /**
     * @dev Register a new user with optional referrer
     * @param referrer Address of the referrer (can be zero address)
     */
    function register(address referrer) external programIsActive {
        require(!isRegistered[msg.sender], "WLYReferral: already registered");
        require(referrer != msg.sender, "WLYReferral: cannot refer yourself");
        
        if (referrer != address(0)) {
            require(isRegistered[referrer], "WLYReferral: referrer not registered");
        }

        // Create new user
        User storage user = users[msg.sender];
        user.referrer = referrer;
        user.registrationTime = block.timestamp;
        user.isActive = true;
        user.level = 1;

        isRegistered[msg.sender] = true;
        totalUsers++;

        // Add to referrer's list
        if (referrer != address(0)) {
            users[referrer].referrals.push(msg.sender);
            users[referrer].totalReferred++;
            
            // Give referral reward
            _distributeReferralReward(referrer, msg.sender);
        }

        // Give registration loyalty points
        _earnLoyaltyPoints(msg.sender, "register");

        emit UserRegistered(msg.sender, referrer, block.timestamp);
    }

    /**
     * @dev Earn loyalty points for specific actions
     * @param action Action identifier
     */
    function earnPoints(string memory action) external onlyRegistered programIsActive {
        _earnLoyaltyPoints(msg.sender, action);
    }

    /**
     * @dev Admin function to award points to a user
     * @param user User address
     * @param points Number of points to award
     * @param action Action description
     */
    function awardPoints(address user, uint256 points, string memory action) external onlyAdmin {
        require(isRegistered[user], "WLYReferral: user not registered");
        
        users[user].loyaltyPoints += points;
        totalPointsIssued += points;
        
        _checkLevelUpgrade(user);
        
        emit LoyaltyPointsEarned(user, points, action);
    }

    /**
     * @dev Redeem loyalty points for tokens
     * @param points Number of points to redeem
     */
    function redeemPoints(uint256 points) external onlyRegistered programIsActive {
        require(points >= minRedemptionPoints, "WLYReferral: below minimum redemption");
        require(users[msg.sender].loyaltyPoints >= points, "WLYReferral: insufficient points");

        uint256 rewardAmount = (points * 1e18) / pointsToTokenRatio;
        require(
            WL20(rewardToken).balanceOf(address(this)) >= rewardAmount,
            "WLYReferral: insufficient reward tokens"
        );

        users[msg.sender].loyaltyPoints -= points;
        
        // Transfer reward tokens
        WL20(rewardToken).transfer(msg.sender, rewardAmount);

        emit LoyaltyPointsRedeemed(msg.sender, points, rewardAmount);
    }

    /**
     * @dev Get user information
     * @param user User address
     * @return User struct data
     */
    function getUserInfo(address user) external view returns (
        address referrer,
        uint256 totalReferred,
        uint256 totalEarned,
        uint256 loyaltyPoints,
        uint256 level,
        uint256 registrationTime,
        bool isActive
    ) {
        User storage userData = users[user];
        return (
            userData.referrer,
            userData.totalReferred,
            userData.totalEarned,
            userData.loyaltyPoints,
            userData.level,
            userData.registrationTime,
            userData.isActive
        );
    }

    /**
     * @dev Get user's referrals
     * @param user User address
     * @return Array of referral addresses
     */
    function getUserReferrals(address user) external view returns (address[] memory) {
        return users[user].referrals;
    }

    /**
     * @dev Get referral chain up to specified depth
     * @param user User address
     * @param depth Maximum depth to traverse
     * @return Array of referrer addresses
     */
    function getReferralChain(address user, uint256 depth) external view returns (address[] memory) {
        address[] memory chain = new address[](depth);
        address current = users[user].referrer;
        uint256 count = 0;

        while (current != address(0) && count < depth) {
            chain[count] = current;
            current = users[current].referrer;
            count++;
        }

        // Resize array to actual length
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = chain[i];
        }

        return result;
    }

    /**
     * @dev Calculate potential referral reward for a user
     * @param referrer Referrer address
     * @param level Referral level
     * @return Potential reward amount
     */
    function calculateReferralReward(address referrer, uint256 level) public view returns (uint256) {
        if (level > maxReferralLevels || !isRegistered[referrer]) {
            return 0;
        }

        ReferralLevel storage refLevel = referralLevels[level];
        uint256 userLevel = users[referrer].level;
        uint256 multiplier = loyaltyLevels[userLevel].rewardMultiplier;
        
        uint256 baseReward = refLevel.maxReward;
        uint256 reward = (baseReward * multiplier) / BASIS_POINTS;
        
        return reward;
    }

    /**
     * @dev Get program statistics
     * @return totalUsers, totalRewardsDistributed, totalPointsIssued
     */
    function getProgramStats() external view returns (uint256, uint256, uint256) {
        return (totalUsers, totalRewardsDistributed, totalPointsIssued);
    }

    /**
     * @dev Get loyalty level information
     * @param level Loyalty level
     * @return pointsRequired, rewardMultiplier, name
     */
    function getLoyaltyLevel(uint256 level) external view returns (uint256, uint256, string memory) {
        LoyaltyLevel storage loyaltyLevel = loyaltyLevels[level];
        return (loyaltyLevel.pointsRequired, loyaltyLevel.rewardMultiplier, loyaltyLevel.name);
    }

    /**
     * @dev Check if user can perform action today
     * @param user User address
     * @param action Action identifier
     * @return bool Whether action is allowed
     */
    function canPerformAction(address user, string memory action) external view returns (bool) {
        uint256 today = block.timestamp / SECONDS_PER_DAY;
        uint256 todayCount = lastActionDay[user][action] == today ? dailyActionCount[user][action] : 0;
        uint256 limit = dailyActionLimit[action];
        
        return limit == 0 || todayCount < limit;
    }

    // Admin functions
    /**
     * @dev Set referral level configuration
     * @param level Referral level
     * @param percentage Reward percentage in basis points
     * @param maxReward Maximum reward amount
     */
    function setReferralLevel(uint256 level, uint256 percentage, uint256 maxReward) external onlyAdmin {
        require(level > 0 && level <= 10, "WLYReferral: invalid level");
        require(percentage <= BASIS_POINTS, "WLYReferral: invalid percentage");
        
        referralLevels[level] = ReferralLevel({
            percentage: percentage,
            maxReward: maxReward
        });
        
        if (level > maxReferralLevels) {
            maxReferralLevels = level;
        }
        
        emit ProgramParametersUpdated(msg.sender);
    }

    /**
     * @dev Set loyalty level configuration
     * @param level Loyalty level
     * @param pointsRequired Points required for this level
     * @param rewardMultiplier Reward multiplier in basis points
     * @param name Level name
     */
    function setLoyaltyLevel(
        uint256 level, 
        uint256 pointsRequired, 
        uint256 rewardMultiplier, 
        string memory name
    ) external onlyAdmin {
        require(level > 0 && level <= 20, "WLYReferral: invalid level");
        require(rewardMultiplier <= 50000, "WLYReferral: multiplier too high"); // Max 500%
        
        loyaltyLevels[level] = LoyaltyLevel({
            pointsRequired: pointsRequired,
            rewardMultiplier: rewardMultiplier,
            name: name
        });
        
        if (level > maxLoyaltyLevels) {
            maxLoyaltyLevels = level;
        }
        
        emit ProgramParametersUpdated(msg.sender);
    }

    /**
     * @dev Set action points configuration
     * @param action Action identifier
     * @param points Points awarded for action
     * @param dailyLimit Daily limit for action (0 = no limit)
     */
    function setActionPoints(string memory action, uint256 points, uint256 dailyLimit) external onlyAdmin {
        actionPoints[action] = points;
        dailyActionLimit[action] = dailyLimit;
        emit ProgramParametersUpdated(msg.sender);
    }

    /**
     * @dev Set redemption parameters
     * @param _pointsToTokenRatio Points required for 1 token
     * @param _minRedemptionPoints Minimum points for redemption
     */
    function setRedemptionParams(uint256 _pointsToTokenRatio, uint256 _minRedemptionPoints) external onlyAdmin {
        require(_pointsToTokenRatio > 0, "WLYReferral: invalid ratio");
        pointsToTokenRatio = _pointsToTokenRatio;
        minRedemptionPoints = _minRedemptionPoints;
        emit ProgramParametersUpdated(msg.sender);
    }

    /**
     * @dev Toggle program active status
     */
    function toggleProgram() external onlyAdmin {
        programActive = !programActive;
    }

    /**
     * @dev Withdraw reward tokens (emergency function)
     * @param amount Amount to withdraw
     */
    function withdrawRewardTokens(uint256 amount) external onlyAdmin {
        WL20(rewardToken).transfer(admin, amount);
    }

    /**
     * @dev Transfer admin role
     * @param newAdmin New admin address
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "WLYReferral: invalid admin");
        admin = newAdmin;
    }

    // Internal functions
    function _earnLoyaltyPoints(address user, string memory action) internal {
        uint256 points = actionPoints[action];
        if (points == 0) return;

        // Check daily limit
        uint256 today = block.timestamp / SECONDS_PER_DAY;
        if (lastActionDay[user][action] != today) {
            dailyActionCount[user][action] = 0;
            lastActionDay[user][action] = today;
        }

        uint256 limit = dailyActionLimit[action];
        if (limit > 0 && dailyActionCount[user][action] >= limit) {
            return; // Daily limit reached
        }

        dailyActionCount[user][action]++;
        users[user].loyaltyPoints += points;
        totalPointsIssued += points;

        _checkLevelUpgrade(user);

        emit LoyaltyPointsEarned(user, points, action);
    }

    function _checkLevelUpgrade(address user) internal {
        User storage userData = users[user];
        uint256 currentLevel = userData.level;
        uint256 newLevel = currentLevel;

        // Find the highest level user qualifies for
        for (uint256 i = currentLevel + 1; i <= maxLoyaltyLevels; i++) {
            if (userData.loyaltyPoints >= loyaltyLevels[i].pointsRequired) {
                newLevel = i;
            } else {
                break;
            }
        }

        if (newLevel > currentLevel) {
            userData.level = newLevel;
            emit LevelUpgraded(user, currentLevel, newLevel);
        }
    }

    function _distributeReferralReward(address referrer, address referee) internal {
        // Distribute rewards up the referral chain
        address current = referrer;
        for (uint256 level = 1; level <= maxReferralLevels && current != address(0); level++) {
            uint256 reward = calculateReferralReward(current, level);
            
            if (reward > 0 && WL20(rewardToken).balanceOf(address(this)) >= reward) {
                users[current].totalEarned += reward;
                totalRewardsDistributed += reward;
                
                WL20(rewardToken).transfer(current, reward);
                emit ReferralReward(current, referee, reward, level);
            }
            
            current = users[current].referrer;
        }
    }

    function _initializeReferralLevels() internal {
        // Level 1: Direct referrals - 5%
        referralLevels[1] = ReferralLevel({percentage: 500, maxReward: 10 * 1e18});
        
        // Level 2: Second level - 2%
        referralLevels[2] = ReferralLevel({percentage: 200, maxReward: 5 * 1e18});
        
        // Level 3: Third level - 1%
        referralLevels[3] = ReferralLevel({percentage: 100, maxReward: 2 * 1e18});
        
        maxReferralLevels = 3;
    }

    function _initializeLoyaltyLevels() internal {
        loyaltyLevels[1] = LoyaltyLevel({pointsRequired: 0, rewardMultiplier: 10000, name: "Bronze"});
        loyaltyLevels[2] = LoyaltyLevel({pointsRequired: 1000, rewardMultiplier: 11000, name: "Silver"});
        loyaltyLevels[3] = LoyaltyLevel({pointsRequired: 5000, rewardMultiplier: 12500, name: "Gold"});
        loyaltyLevels[4] = LoyaltyLevel({pointsRequired: 15000, rewardMultiplier: 15000, name: "Platinum"});
        loyaltyLevels[5] = LoyaltyLevel({pointsRequired: 50000, rewardMultiplier: 20000, name: "Diamond"});
        
        maxLoyaltyLevels = 5;
    }

    function _initializeActionPoints() internal {
        actionPoints["register"] = 100;
        actionPoints["daily_login"] = 10;
        actionPoints["transaction"] = 5;
        actionPoints["stake"] = 50;
        actionPoints["vote"] = 25;
        
        dailyActionLimit["daily_login"] = 1;
        dailyActionLimit["transaction"] = 10;
        dailyActionLimit["stake"] = 5;
        dailyActionLimit["vote"] = 3;
    }

    /**
     * @dev Receive VLY for rewards
     */
    receive() external payable {}
}