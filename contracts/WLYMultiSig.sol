// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./WL20.sol";

/**
 * @title WLY MultiSig Wallet
 * @dev Multi-signature wallet for VLY blockchain supporting both native VLY and WL20 tokens
 * @author VLY Blockchain Team
 */
contract WLYMultiSig {
    // Events
    event Deposit(address indexed sender, uint256 amount, uint256 balance);
    event SubmitTransaction(
        address indexed owner,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event RequirementChanged(uint256 required);

    // Structs
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 numConfirmations;
    }

    // State variables
    address[] public owners;
    mapping(address => bool) public isOwner;
    uint256 public numConfirmationsRequired;

    Transaction[] public transactions;
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    // Modifiers
    modifier onlyOwner() {
        require(isOwner[msg.sender], "WLYMultiSig: not owner");
        _;
    }

    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "WLYMultiSig: tx does not exist");
        _;
    }

    modifier notExecuted(uint256 _txIndex) {
        require(!transactions[_txIndex].executed, "WLYMultiSig: tx already executed");
        _;
    }

    modifier notConfirmed(uint256 _txIndex) {
        require(!isConfirmed[_txIndex][msg.sender], "WLYMultiSig: tx already confirmed");
        _;
    }

    modifier confirmed(uint256 _txIndex) {
        require(isConfirmed[_txIndex][msg.sender], "WLYMultiSig: tx not confirmed");
        _;
    }

    modifier validRequirement(uint256 _numOwners, uint256 _required) {
        require(
            _required > 0 && _required <= _numOwners && _numOwners > 0,
            "WLYMultiSig: invalid requirement"
        );
        _;
    }

    /**
     * @dev Constructor sets initial owners and required confirmations
     * @param _owners List of initial owners
     * @param _numConfirmationsRequired Number of required confirmations
     */
    constructor(address[] memory _owners, uint256 _numConfirmationsRequired)
        validRequirement(_owners.length, _numConfirmationsRequired)
    {
        require(_owners.length > 0, "WLYMultiSig: owners required");

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];

            require(owner != address(0), "WLYMultiSig: invalid owner");
            require(!isOwner[owner], "WLYMultiSig: owner not unique");

            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    /**
     * @dev Fallback function allows to deposit ether
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    /**
     * @dev Submit a transaction
     * @param _to Destination address
     * @param _value Amount of VLY to send
     * @param _data Transaction data
     */
    function submitTransaction(
        address _to,
        uint256 _value,
        bytes memory _data
    ) public onlyOwner {
        uint256 txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    /**
     * @dev Confirm a transaction
     * @param _txIndex Transaction index
     */
    function confirmTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    /**
     * @dev Execute a transaction after required confirmations
     * @param _txIndex Transaction index
     */
    function executeTransaction(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "WLYMultiSig: cannot execute tx"
        );

        transaction.executed = true;

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        require(success, "WLYMultiSig: tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    /**
     * @dev Revoke transaction confirmation
     * @param _txIndex Transaction index
     */
    function revokeConfirmation(uint256 _txIndex)
        public
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        confirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];

        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    /**
     * @dev Transfer WL20 tokens
     * @param _token WL20 token address
     * @param _to Recipient address
     * @param _amount Amount to transfer
     */
    function submitWL20Transfer(
        address _token,
        address _to,
        uint256 _amount
    ) public onlyOwner {
        bytes memory data = abi.encodeWithSignature(
            "transfer(address,uint256)",
            _to,
            _amount
        );
        submitTransaction(_token, 0, data);
    }

    /**
     * @dev Get owners
     * @return Array of owner addresses
     */
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    /**
     * @dev Get transaction count
     * @return Number of transactions
     */
    function getTransactionCount() public view returns (uint256) {
        return transactions.length;
    }

    /**
     * @dev Get transaction details
     * @param _txIndex Transaction index
     * @return to Destination address
     * @return value Amount
     * @return data Transaction data
     * @return executed Execution status
     * @return numConfirmations Number of confirmations
     */
    function getTransaction(uint256 _txIndex)
        public
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }

    /**
     * @dev Add a new owner (requires multisig approval)
     * @param _owner New owner address
     */
    function addOwner(address _owner) public {
        require(msg.sender == address(this), "WLYMultiSig: only multisig can add owner");
        require(_owner != address(0), "WLYMultiSig: invalid owner");
        require(!isOwner[_owner], "WLYMultiSig: owner already exists");

        isOwner[_owner] = true;
        owners.push(_owner);
        emit OwnerAdded(_owner);
    }

    /**
     * @dev Remove an owner (requires multisig approval)
     * @param _owner Owner address to remove
     */
    function removeOwner(address _owner) public {
        require(msg.sender == address(this), "WLYMultiSig: only multisig can remove owner");
        require(isOwner[_owner], "WLYMultiSig: owner does not exist");
        require(owners.length > 1, "WLYMultiSig: cannot remove last owner");

        isOwner[_owner] = false;
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == _owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }

        if (numConfirmationsRequired > owners.length) {
            numConfirmationsRequired = owners.length;
            emit RequirementChanged(numConfirmationsRequired);
        }

        emit OwnerRemoved(_owner);
    }

    /**
     * @dev Change confirmation requirement (requires multisig approval)
     * @param _required New required confirmations
     */
    function changeRequirement(uint256 _required) public
        validRequirement(owners.length, _required)
    {
        require(msg.sender == address(this), "WLYMultiSig: only multisig can change requirement");
        numConfirmationsRequired = _required;
        emit RequirementChanged(_required);
    }

    /**
     * @dev Submit transaction to add owner
     * @param _owner New owner address
     */
    function submitAddOwner(address _owner) public onlyOwner {
        bytes memory data = abi.encodeWithSignature("addOwner(address)", _owner);
        submitTransaction(address(this), 0, data);
    }

    /**
     * @dev Submit transaction to remove owner
     * @param _owner Owner address to remove
     */
    function submitRemoveOwner(address _owner) public onlyOwner {
        bytes memory data = abi.encodeWithSignature("removeOwner(address)", _owner);
        submitTransaction(address(this), 0, data);
    }

    /**
     * @dev Submit transaction to change requirement
     * @param _required New required confirmations
     */
    function submitChangeRequirement(uint256 _required) public onlyOwner {
        bytes memory data = abi.encodeWithSignature("changeRequirement(uint256)", _required);
        submitTransaction(address(this), 0, data);
    }

    /**
     * @dev Get pending transactions
     * @return Array of pending transaction indices
     */
    function getPendingTransactions() public view returns (uint256[] memory) {
        uint256[] memory pending = new uint256[](transactions.length);
        uint256 count = 0;

        for (uint256 i = 0; i < transactions.length; i++) {
            if (!transactions[i].executed) {
                pending[count] = i;
                count++;
            }
        }

        // Resize array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = pending[i];
        }

        return result;
    }

    /**
     * @dev Get confirmations for a transaction
     * @param _txIndex Transaction index
     * @return Array of addresses that confirmed the transaction
     */
    function getConfirmations(uint256 _txIndex)
        public
        view
        txExists(_txIndex)
        returns (address[] memory)
    {
        address[] memory confirmations = new address[](owners.length);
        uint256 count = 0;

        for (uint256 i = 0; i < owners.length; i++) {
            if (isConfirmed[_txIndex][owners[i]]) {
                confirmations[count] = owners[i];
                count++;
            }
        }

        // Resize array
        address[] memory result = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = confirmations[i];
        }

        return result;
    }

    /**
     * @dev Emergency function to recover stuck VLY
     * Only callable by the multisig itself
     */
    function emergencyWithdraw(address payable _to, uint256 _amount) public {
        require(msg.sender == address(this), "WLYMultiSig: only multisig can withdraw");
        require(_to != address(0), "WLYMultiSig: invalid recipient");
        require(address(this).balance >= _amount, "WLYMultiSig: insufficient balance");
        
        _to.transfer(_amount);
    }

    /**
     * @dev Emergency function to recover stuck WL20 tokens
     * Only callable by the multisig itself
     */
    function emergencyWithdrawWL20(address _token, address _to, uint256 _amount) public {
        require(msg.sender == address(this), "WLYMultiSig: only multisig can withdraw");
        require(_to != address(0), "WLYMultiSig: invalid recipient");
        
        WL20(_token).transfer(_to, _amount);
    }
}