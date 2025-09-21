// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./WL20.sol";

/**
 * @title WLYDAO - VLY Blockchain DAO and Voting Contract
 * @dev Decentralized Autonomous Organization for VLY blockchain governance
 * @author VLY Blockchain Team
 */
contract WLYDAO {
    // Enums
    enum ProposalState {
        Active,
        Succeeded,
        Defeated,
        Executed,
        Cancelled
    }

    enum VoteType {
        Against,
        For,
        Abstain
    }

    // Structs
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        address target;
        bytes data;
        uint256 value;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasVoted;
        mapping(address => VoteType) votes;
    }

    struct ProposalInfo {
        uint256 id;
        address proposer;
        string title;
        string description;
        address target;
        bytes data;
        uint256 value;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
        bool cancelled;
        ProposalState state;
    }

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        uint256 startTime,
        uint256 endTime
    );
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        VoteType vote,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed proposalId, bool success);
    event ProposalCancelled(uint256 indexed proposalId);
    event QuorumChanged(uint256 oldQuorum, uint256 newQuorum);
    event VotingDelayChanged(uint256 oldDelay, uint256 newDelay);
    event VotingPeriodChanged(uint256 oldPeriod, uint256 newPeriod);
    event TokenChanged(address oldToken, address newToken);

    // State variables
    address public govToken;           // Governance token (WL20)
    address public timelock;           // Timelock contract (optional)
    address public admin;              // DAO admin
    
    uint256 public quorum;             // Minimum votes needed for proposal to pass
    uint256 public votingDelay;        // Delay before voting starts (in blocks)
    uint256 public votingPeriod;       // Voting period length (in blocks)
    uint256 public proposalThreshold;  // Minimum tokens needed to create proposal
    uint256 public executionDelay;     // Delay before execution (in seconds)
    
    uint256 public proposalCounter;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public lastProposalTime;
    
    // Anti-spam
    uint256 public proposalCooldown = 1 days;
    
    // Constants
    uint256 public constant MAX_VOTING_PERIOD = 2 weeks;
    uint256 public constant MIN_VOTING_PERIOD = 1 days;
    uint256 public constant MAX_VOTING_DELAY = 1 weeks;
    uint256 public constant MAX_EXECUTION_DELAY = 30 days;

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "WLYDAO: caller is not admin");
        _;
    }

    modifier onlyDAO() {
        require(msg.sender == address(this), "WLYDAO: caller is not DAO");
        _;
    }

    modifier validProposal(uint256 proposalId) {
        require(proposalId > 0 && proposalId <= proposalCounter, "WLYDAO: invalid proposal");
        _;
    }

    /**
     * @dev Constructor
     * @param _govToken Governance token address
     * @param _quorum Quorum percentage (in basis points, e.g., 500 = 5%)
     * @param _votingDelay Voting delay in blocks
     * @param _votingPeriod Voting period in blocks
     * @param _proposalThreshold Minimum tokens to create proposal
     */
    constructor(
        address _govToken,
        uint256 _quorum,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold
    ) {
        require(_govToken != address(0), "WLYDAO: invalid token address");
        require(_quorum > 0 && _quorum <= 10000, "WLYDAO: invalid quorum");
        require(_votingPeriod >= MIN_VOTING_PERIOD && _votingPeriod <= MAX_VOTING_PERIOD, "WLYDAO: invalid voting period");
        require(_votingDelay <= MAX_VOTING_DELAY, "WLYDAO: invalid voting delay");

        govToken = _govToken;
        admin = msg.sender;
        quorum = _quorum;
        votingDelay = _votingDelay;
        votingPeriod = _votingPeriod;
        proposalThreshold = _proposalThreshold;
        executionDelay = 2 days;
        proposalCounter = 0;
    }

    /**
     * @dev Create a new proposal
     * @param title Proposal title
     * @param description Proposal description
     * @param target Target contract address
     * @param data Call data
     * @param value VLY value to send
     * @return proposalId The ID of the created proposal
     */
    function propose(
        string memory title,
        string memory description,
        address target,
        bytes memory data,
        uint256 value
    ) external returns (uint256 proposalId) {
        require(bytes(title).length > 0, "WLYDAO: empty title");
        require(bytes(description).length > 0, "WLYDAO: empty description");
        require(
            WL20(govToken).balanceOf(msg.sender) >= proposalThreshold,
            "WLYDAO: insufficient tokens to propose"
        );
        require(
            block.timestamp >= lastProposalTime[msg.sender] + proposalCooldown,
            "WLYDAO: proposal cooldown not met"
        );

        proposalCounter++;
        proposalId = proposalCounter;

        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.target = target;
        proposal.data = data;
        proposal.value = value;
        proposal.startTime = block.timestamp + votingDelay;
        proposal.endTime = proposal.startTime + votingPeriod;
        proposal.executed = false;
        proposal.cancelled = false;

        lastProposalTime[msg.sender] = block.timestamp;

        emit ProposalCreated(proposalId, msg.sender, title, proposal.startTime, proposal.endTime);
        
        return proposalId;
    }

    /**
     * @dev Cast a vote on a proposal
     * @param proposalId Proposal ID
     * @param vote Vote type (0=Against, 1=For, 2=Abstain)
     */
    function castVote(uint256 proposalId, VoteType vote) external validProposal(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        require(block.timestamp >= proposal.startTime, "WLYDAO: voting not started");
        require(block.timestamp < proposal.endTime, "WLYDAO: voting ended");
        require(!proposal.hasVoted[msg.sender], "WLYDAO: already voted");
        require(!proposal.cancelled, "WLYDAO: proposal cancelled");

        uint256 weight = WL20(govToken).balanceOf(msg.sender);
        require(weight > 0, "WLYDAO: no voting power");

        proposal.hasVoted[msg.sender] = true;
        proposal.votes[msg.sender] = vote;

        if (vote == VoteType.For) {
            proposal.forVotes += weight;
        } else if (vote == VoteType.Against) {
            proposal.againstVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }

        emit VoteCast(msg.sender, proposalId, vote, weight);
    }

    /**
     * @dev Execute a successful proposal
     * @param proposalId Proposal ID
     */
    function execute(uint256 proposalId) external validProposal(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        require(getProposalState(proposalId) == ProposalState.Succeeded, "WLYDAO: proposal not succeeded");
        require(!proposal.executed, "WLYDAO: already executed");
        require(!proposal.cancelled, "WLYDAO: proposal cancelled");
        require(
            block.timestamp >= proposal.endTime + executionDelay,
            "WLYDAO: execution delay not met"
        );

        proposal.executed = true;

        bool success;
        if (proposal.target != address(0)) {
            (success, ) = proposal.target.call{value: proposal.value}(proposal.data);
        } else {
            success = true; // For proposals without execution (e.g., signal votes)
        }

        emit ProposalExecuted(proposalId, success);
    }

    /**
     * @dev Cancel a proposal (only by proposer or admin)
     * @param proposalId Proposal ID
     */
    function cancel(uint256 proposalId) external validProposal(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        require(
            msg.sender == proposal.proposer || msg.sender == admin,
            "WLYDAO: unauthorized to cancel"
        );
        require(!proposal.executed, "WLYDAO: cannot cancel executed proposal");
        require(!proposal.cancelled, "WLYDAO: already cancelled");

        proposal.cancelled = true;
        emit ProposalCancelled(proposalId);
    }

    /**
     * @dev Get proposal state
     * @param proposalId Proposal ID
     * @return ProposalState
     */
    function getProposalState(uint256 proposalId) public view validProposal(proposalId) returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.cancelled) {
            return ProposalState.Cancelled;
        }
        
        if (proposal.executed) {
            return ProposalState.Executed;
        }
        
        if (block.timestamp < proposal.endTime) {
            return ProposalState.Active;
        }
        
        // Check if proposal succeeded
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        uint256 totalSupply = WL20(govToken).totalSupply();
        
        if (totalVotes * 10000 < totalSupply * quorum) {
            return ProposalState.Defeated; // Quorum not met
        }
        
        if (proposal.forVotes > proposal.againstVotes) {
            return ProposalState.Succeeded;
        } else {
            return ProposalState.Defeated;
        }
    }

    /**
     * @dev Get proposal info
     * @param proposalId Proposal ID
     * @return ProposalInfo struct
     */
    function getProposal(uint256 proposalId) external view validProposal(proposalId) returns (ProposalInfo memory) {
        Proposal storage proposal = proposals[proposalId];
        
        return ProposalInfo({
            id: proposal.id,
            proposer: proposal.proposer,
            title: proposal.title,
            description: proposal.description,
            target: proposal.target,
            data: proposal.data,
            value: proposal.value,
            startTime: proposal.startTime,
            endTime: proposal.endTime,
            forVotes: proposal.forVotes,
            againstVotes: proposal.againstVotes,
            abstainVotes: proposal.abstainVotes,
            executed: proposal.executed,
            cancelled: proposal.cancelled,
            state: getProposalState(proposalId)
        });
    }

    /**
     * @dev Get voter's vote on a proposal
     * @param proposalId Proposal ID
     * @param voter Voter address
     * @return hasVoted Whether the voter has voted
     * @return vote The vote cast
     */
    function getVote(uint256 proposalId, address voter) 
        external 
        view 
        validProposal(proposalId) 
        returns (bool hasVoted, VoteType vote) 
    {
        Proposal storage proposal = proposals[proposalId];
        return (proposal.hasVoted[voter], proposal.votes[voter]);
    }

    /**
     * @dev Get active proposals
     * @return Array of active proposal IDs
     */
    function getActiveProposals() external view returns (uint256[] memory) {
        uint256[] memory activeIds = new uint256[](proposalCounter);
        uint256 count = 0;

        for (uint256 i = 1; i <= proposalCounter; i++) {
            if (getProposalState(i) == ProposalState.Active) {
                activeIds[count] = i;
                count++;
            }
        }

        // Resize array
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeIds[i];
        }

        return result;
    }

    /**
     * @dev Get recent proposals
     * @param limit Number of recent proposals to return
     * @return Array of proposal IDs
     */
    function getRecentProposals(uint256 limit) external view returns (uint256[] memory) {
        require(limit > 0 && limit <= 50, "WLYDAO: invalid limit");
        
        if (proposalCounter == 0) {
            return new uint256[](0);
        }

        uint256 actualLimit = limit > proposalCounter ? proposalCounter : limit;
        uint256[] memory recent = new uint256[](actualLimit);

        for (uint256 i = 0; i < actualLimit; i++) {
            recent[i] = proposalCounter - i;
        }

        return recent;
    }

    /**
     * @dev Get voting power of an address at current time
     * @param account Account address
     * @return Voting power
     */
    function getVotingPower(address account) external view returns (uint256) {
        return WL20(govToken).balanceOf(account);
    }

    /**
     * @dev Set quorum (only DAO can call this through proposal)
     * @param _quorum New quorum in basis points
     */
    function setQuorum(uint256 _quorum) external onlyDAO {
        require(_quorum > 0 && _quorum <= 10000, "WLYDAO: invalid quorum");
        uint256 oldQuorum = quorum;
        quorum = _quorum;
        emit QuorumChanged(oldQuorum, _quorum);
    }

    /**
     * @dev Set voting delay (only DAO can call this through proposal)
     * @param _votingDelay New voting delay in blocks
     */
    function setVotingDelay(uint256 _votingDelay) external onlyDAO {
        require(_votingDelay <= MAX_VOTING_DELAY, "WLYDAO: invalid voting delay");
        uint256 oldDelay = votingDelay;
        votingDelay = _votingDelay;
        emit VotingDelayChanged(oldDelay, _votingDelay);
    }

    /**
     * @dev Set voting period (only DAO can call this through proposal)
     * @param _votingPeriod New voting period in blocks
     */
    function setVotingPeriod(uint256 _votingPeriod) external onlyDAO {
        require(_votingPeriod >= MIN_VOTING_PERIOD && _votingPeriod <= MAX_VOTING_PERIOD, "WLYDAO: invalid voting period");
        uint256 oldPeriod = votingPeriod;
        votingPeriod = _votingPeriod;
        emit VotingPeriodChanged(oldPeriod, _votingPeriod);
    }

    /**
     * @dev Change governance token (only DAO can call this through proposal)
     * @param _newToken New governance token address
     */
    function setGovToken(address _newToken) external onlyDAO {
        require(_newToken != address(0), "WLYDAO: invalid token address");
        address oldToken = govToken;
        govToken = _newToken;
        emit TokenChanged(oldToken, _newToken);
    }

    /**
     * @dev Transfer admin role (only current admin)
     * @param newAdmin New admin address
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "WLYDAO: invalid admin address");
        admin = newAdmin;
    }

    /**
     * @dev Emergency function to cancel all active proposals (only admin)
     */
    function emergencyPause() external onlyAdmin {
        for (uint256 i = 1; i <= proposalCounter; i++) {
            if (getProposalState(i) == ProposalState.Active) {
                proposals[i].cancelled = true;
                emit ProposalCancelled(i);
            }
        }
    }

    /**
     * @dev Receive VLY for treasury
     */
    receive() external payable {}

    /**
     * @dev Get DAO treasury balance
     * @return VLY balance
     */
    function getTreasuryBalance() external view returns (uint256) {
        return address(this).balance;
    }
}