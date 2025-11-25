// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./WL20.sol";

/**
 * @title WLY Token Factory
 * @dev Factory contract for creating WL20 tokens on VLY blockchain
 * @author VLY Blockchain Team
 */
contract WLYTokenFactory {
    // Events
    event TokenCreated(
        address indexed tokenAddress,
        address indexed creator,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 timestamp
    );
    event FactoryOwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event CreationFeeChanged(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // Structs
    struct TokenInfo {
        address tokenAddress;
        address creator;
        string name;
        string symbol;
        uint8 decimals;
        uint256 totalSupply;
        bool mintable;
        bool burnable;
        uint256 maxSupply;
        uint256 createdAt;
    }

    // State variables
    address public owner;
    uint256 public creationFee;
    uint256 public totalTokensCreated;
    
    // Arrays and mappings
    address[] public allTokens;
    mapping(address => TokenInfo) public tokenInfo;
    mapping(address => address[]) public creatorTokens;
    mapping(string => bool) public symbolExists;
    
    // Constants
    uint256 public constant MAX_SUPPLY_LIMIT = 1000000000 * 10**18; // 1 billion tokens max
    uint256 public constant MIN_INITIAL_SUPPLY = 1000 * 10**18; // 1000 tokens min
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "WLYTokenFactory: caller is not the owner");
        _;
    }

    modifier validTokenParams(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        uint256 maxSupply
    ) {
        require(bytes(name).length > 0 && bytes(name).length <= 50, "WLYTokenFactory: invalid name");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 10, "WLYTokenFactory: invalid symbol");
        require(!symbolExists[symbol], "WLYTokenFactory: symbol already exists");
        require(decimals >= 0 && decimals <= 18, "WLYTokenFactory: invalid decimals");
        require(totalSupply >= MIN_INITIAL_SUPPLY, "WLYTokenFactory: initial supply too low");
        require(maxSupply <= MAX_SUPPLY_LIMIT, "WLYTokenFactory: max supply too high");
        require(totalSupply <= maxSupply, "WLYTokenFactory: initial supply exceeds max supply");
        _;
    }

    /**
     * @dev Constructor
     * @param _creationFee Fee required to create a token (in VLY)
     */
    constructor(uint256 _creationFee) {
        owner = msg.sender;
        creationFee = _creationFee;
        totalTokensCreated = 0;
    }

    /**
     * @dev Create a new WL20 token
     * @param name Token name
     * @param symbol Token symbol
     * @param decimals Token decimals
     * @param totalSupply Initial total supply
     * @param mintable Whether the token is mintable
     * @param burnable Whether the token is burnable
     * @param maxSupply Maximum supply (for mintable tokens)
     * @return tokenAddress Address of the created token
     */
    function createToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        bool mintable,
        bool burnable,
        uint256 maxSupply
    ) 
        external 
        payable 
        validTokenParams(name, symbol, decimals, totalSupply, maxSupply)
        returns (address tokenAddress) 
    {
        require(msg.value >= creationFee, "WLYTokenFactory: insufficient fee");

        // Deploy new token contract
        WL20 newToken = new WL20(
            name,
            symbol,
            decimals,
            totalSupply,
            mintable,
            burnable,
            maxSupply
        );

        tokenAddress = address(newToken);

        // Transfer ownership to creator
        newToken.transferOwnership(msg.sender);

        // Store token info
        tokenInfo[tokenAddress] = TokenInfo({
            tokenAddress: tokenAddress,
            creator: msg.sender,
            name: name,
            symbol: symbol,
            decimals: decimals,
            totalSupply: totalSupply,
            mintable: mintable,
            burnable: burnable,
            maxSupply: maxSupply,
            createdAt: block.timestamp
        });

        // Update tracking variables
        allTokens.push(tokenAddress);
        creatorTokens[msg.sender].push(tokenAddress);
        symbolExists[symbol] = true;
        totalTokensCreated++;

        // Refund excess fee
        if (msg.value > creationFee) {
            payable(msg.sender).transfer(msg.value - creationFee);
        }

        emit TokenCreated(tokenAddress, msg.sender, name, symbol, totalSupply, block.timestamp);
        
        return tokenAddress;
    }

    /**
     * @dev Create a simple token with default parameters
     * @param name Token name
     * @param symbol Token symbol
     * @param totalSupply Initial total supply (in tokens, not wei)
     * @return tokenAddress Address of the created token
     */
    function createSimpleToken(
        string memory name,
        string memory symbol,
        uint256 totalSupply
    ) external payable returns (address tokenAddress) {
        uint256 supply = totalSupply * 10**18; // Convert to 18 decimals
        return createToken(
            name,
            symbol,
            18,
            supply,
            false,  // not mintable
            true,   // burnable
            supply  // max supply equals initial supply
        );
    }

    /**
     * @dev Create a mintable token
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial supply (in tokens, not wei)
     * @param maxSupply Maximum supply (in tokens, not wei)
     * @return tokenAddress Address of the created token
     */
    function createMintableToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint256 maxSupply
    ) external payable returns (address tokenAddress) {
        uint256 initialSupplyWei = initialSupply * 10**18;
        uint256 maxSupplyWei = maxSupply * 10**18;
        
        return createToken(
            name,
            symbol,
            18,
            initialSupplyWei,
            true,   // mintable
            true,   // burnable
            maxSupplyWei
        );
    }

    /**
     * @dev Get all tokens created by a specific address
     * @param creator Creator address
     * @return Array of token addresses
     */
    function getTokensByCreator(address creator) external view returns (address[] memory) {
        return creatorTokens[creator];
    }

    /**
     * @dev Get all created tokens
     * @return Array of token addresses
     */
    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }

    /**
     * @dev Get token info by address
     * @param tokenAddress Token contract address
     * @return TokenInfo struct
     */
    function getTokenInfo(address tokenAddress) external view returns (TokenInfo memory) {
        return tokenInfo[tokenAddress];
    }

    /**
     * @dev Get paginated list of tokens
     * @param offset Starting index
     * @param limit Number of tokens to return
     * @return tokens Array of token addresses
     * @return hasMore Whether there are more tokens
     */
    function getTokensPaginated(uint256 offset, uint256 limit) 
        external 
        view 
        returns (address[] memory tokens, bool hasMore) 
    {
        require(limit > 0 && limit <= 100, "WLYTokenFactory: invalid limit");
        
        uint256 totalTokens = allTokens.length;
        if (offset >= totalTokens) {
            return (new address[](0), false);
        }

        uint256 end = offset + limit;
        if (end > totalTokens) {
            end = totalTokens;
        }

        tokens = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            tokens[i - offset] = allTokens[i];
        }

        hasMore = end < totalTokens;
    }

    /**
     * @dev Get recently created tokens
     * @param count Number of recent tokens to return
     * @return Array of token addresses
     */
    function getRecentTokens(uint256 count) external view returns (address[] memory) {
        require(count > 0 && count <= 50, "WLYTokenFactory: invalid count");
        
        uint256 totalTokens = allTokens.length;
        if (totalTokens == 0) {
            return new address[](0);
        }

        uint256 actualCount = count > totalTokens ? totalTokens : count;
        address[] memory recentTokens = new address[](actualCount);

        for (uint256 i = 0; i < actualCount; i++) {
            recentTokens[i] = allTokens[totalTokens - 1 - i];
        }

        return recentTokens;
    }

    /**
     * @dev Check if a symbol is available
     * @param symbol Token symbol to check
     * @return bool Whether the symbol is available
     */
    function isSymbolAvailable(string memory symbol) external view returns (bool) {
        return !symbolExists[symbol];
    }

    /**
     * @dev Get factory statistics
     * @return totalTokens Total number of tokens created
     * @return totalFees Total fees collected
     * @return currentFee Current creation fee
     */
    function getFactoryStats() external view returns (uint256 totalTokens, uint256 totalFees, uint256 currentFee) {
        return (totalTokensCreated, address(this).balance, creationFee);
    }

    /**
     * @dev Search tokens by name or symbol
     * @param query Search query (case insensitive)
     * @param limit Maximum number of results
     * @return matches Array of matching token addresses
     */
    function searchTokens(string memory query, uint256 limit) 
        external 
        view 
        returns (address[] memory matches) 
    {
        require(limit > 0 && limit <= 50, "WLYTokenFactory: invalid limit");
        
        address[] memory tempMatches = new address[](allTokens.length);
        uint256 matchCount = 0;
        
        bytes memory queryBytes = bytes(_toLowerCase(query));
        
        for (uint256 i = 0; i < allTokens.length && matchCount < limit; i++) {
            TokenInfo memory info = tokenInfo[allTokens[i]];
            
            if (_contains(_toLowerCase(info.name), queryBytes) || 
                _contains(_toLowerCase(info.symbol), queryBytes)) {
                tempMatches[matchCount] = allTokens[i];
                matchCount++;
            }
        }
        
        matches = new address[](matchCount);
        for (uint256 i = 0; i < matchCount; i++) {
            matches[i] = tempMatches[i];
        }
    }

    /**
     * @dev Set creation fee (only owner)
     * @param _newFee New creation fee in VLY
     */
    function setCreationFee(uint256 _newFee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = _newFee;
        emit CreationFeeChanged(oldFee, _newFee);
    }

    /**
     * @dev Withdraw collected fees (only owner)
     * @param to Address to send fees to
     */
    function withdrawFees(address payable to) external onlyOwner {
        require(to != address(0), "WLYTokenFactory: invalid recipient");
        uint256 amount = address(this).balance;
        require(amount > 0, "WLYTokenFactory: no fees to withdraw");
        
        to.transfer(amount);
        emit FeesWithdrawn(to, amount);
    }

    /**
     * @dev Transfer ownership of the factory (only owner)
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "WLYTokenFactory: new owner is the zero address");
        emit FactoryOwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /**
     * @dev Emergency function to pause token creation
     */
    function emergencyPause() external onlyOwner {
        creationFee = type(uint256).max; // Set extremely high fee to effectively pause
    }

    // Helper functions
    function _toLowerCase(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        for (uint256 i = 0; i < bStr.length; i++) {
            if (bStr[i] >= 0x41 && bStr[i] <= 0x5A) {
                bStr[i] = bytes1(uint8(bStr[i]) + 32);
            }
        }
        return string(bStr);
    }

    function _contains(string memory str, bytes memory query) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        if (query.length > strBytes.length) return false;
        if (query.length == 0) return true;

        for (uint256 i = 0; i <= strBytes.length - query.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < query.length; j++) {
                if (strBytes[i + j] != query[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }

    /**
     * @dev Fallback function to receive VLY
     */
    receive() external payable {}
}