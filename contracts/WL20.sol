// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title WL20 Token Standard
 * @dev VLY Blockchain native token standard (similar to ERC20 but optimized for VLY)
 * @author VLY Blockchain Team
 */

interface IWL20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     * Returns a boolean value indicating whether the operation succeeded.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     * Returns a boolean value indicating whether the operation succeeded.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the allowance mechanism.
     * `amount` is then deducted from the caller's allowance.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to another (`to`).
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by a call to {approve}.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title WL20 Implementation
 * @dev Implementation of the WL20 interface with additional VLY-specific features
 */
contract WL20 is IWL20 {
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private _totalSupply;
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    
    // VLY-specific features
    address private _owner;
    bool private _mintable;
    bool private _burnable;
    uint256 private _maxSupply;
    
    // Anti-spam and security features
    mapping(address => uint256) private _lastTransfer;
    uint256 private _transferCooldown;
    
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == _owner, "WL20: caller is not the owner");
        _;
    }

    modifier transferCooldownCheck(address from) {
        if (_transferCooldown > 0) {
            require(
                block.timestamp >= _lastTransfer[from] + _transferCooldown,
                "WL20: transfer cooldown not met"
            );
        }
        _;
    }

    /**
     * @dev Sets the values for {name}, {symbol}, {decimals}, and {totalSupply}.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        bool mintable_,
        bool burnable_,
        uint256 maxSupply_
    ) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;
        _owner = msg.sender;
        _mintable = mintable_;
        _burnable = burnable_;
        _maxSupply = maxSupply_;
        _transferCooldown = 0; // No cooldown by default
        
        if (totalSupply_ > 0) {
            _mint(msg.sender, totalSupply_);
        }
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view returns (string memory) {
        return _name;
    }

    /**
     * @dev Returns the symbol of the token.
     */
    function symbol() public view returns (string memory) {
        return _symbol;
    }

    /**
     * @dev Returns the decimals places of the token.
     */
    function decimals() public view returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     */
    function transfer(address to, uint256 amount) public override transferCooldownCheck(msg.sender) returns (bool) {
        address owner = msg.sender;
        _transfer(owner, to, amount);
        return true;
    }

    /**
     * @dev Returns the remaining number of tokens that `spender` will be allowed to spend.
     */
    function allowance(address owner, address spender) public view override returns (uint256) {
        return _allowances[owner][spender];
    }

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     */
    function approve(address spender, uint256 amount) public override returns (bool) {
        address owner = msg.sender;
        _approve(owner, spender, amount);
        return true;
    }

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the allowance mechanism.
     */
    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        transferCooldownCheck(from) 
        returns (bool) 
    {
        address spender = msg.sender;
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }

    /**
     * @dev Creates `amount` tokens and assigns them to `to`, increasing the total supply.
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(_mintable, "WL20: minting is disabled");
        require(_totalSupply + amount <= _maxSupply, "WL20: max supply exceeded");
        _mint(to, amount);
    }

    /**
     * @dev Destroys `amount` tokens from the caller.
     */
    function burn(uint256 amount) public {
        require(_burnable, "WL20: burning is disabled");
        _burn(msg.sender, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, deducting from the caller's allowance.
     */
    function burnFrom(address account, uint256 amount) public {
        require(_burnable, "WL20: burning is disabled");
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "WL20: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        return _owner;
    }

    /**
     * @dev Sets transfer cooldown period in seconds
     */
    function setTransferCooldown(uint256 cooldownSeconds) public onlyOwner {
        _transferCooldown = cooldownSeconds;
    }

    /**
     * @dev Returns current transfer cooldown
     */
    function transferCooldown() public view returns (uint256) {
        return _transferCooldown;
    }

    /**
     * @dev Internal transfer function
     */
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "WL20: transfer from the zero address");
        require(to != address(0), "WL20: transfer to the zero address");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "WL20: transfer amount exceeds balance");
        
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }
        
        _lastTransfer[from] = block.timestamp;
        emit Transfer(from, to, amount);
    }

    /**
     * @dev Internal mint function
     */
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "WL20: mint to the zero address");

        _totalSupply += amount;
        unchecked {
            _balances[to] += amount;
        }
        emit Transfer(address(0), to, amount);
        emit Mint(to, amount);
    }

    /**
     * @dev Internal burn function
     */
    function _burn(address from, uint256 amount) internal {
        require(from != address(0), "WL20: burn from the zero address");

        uint256 accountBalance = _balances[from];
        require(accountBalance >= amount, "WL20: burn amount exceeds balance");
        unchecked {
            _balances[from] = accountBalance - amount;
            _totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
        emit Burn(from, amount);
    }

    /**
     * @dev Internal approve function
     */
    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "WL20: approve from the zero address");
        require(spender != address(0), "WL20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    /**
     * @dev Internal allowance spending function
     */
    function _spendAllowance(address owner, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "WL20: insufficient allowance");
            unchecked {
                _approve(owner, spender, currentAllowance - amount);
            }
        }
    }
}