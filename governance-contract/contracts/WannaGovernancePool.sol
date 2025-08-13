// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC5805.sol";
import "@openzeppelin/contracts/governance/utils/IVotes.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./IWannaLockUp.sol";

abstract contract WannaGovernor {
    enum ProposalState {
        Pending, // 제안 대기
        Active, // 투표중
        Canceled, // 취소됨
        Defeated, // 제안 실패
        Succeeded, // 제안 성공
        Expired, // 제안 만료
        Executed // 제안 실행 완료
    }

    enum VoteType {
        Against,
        For,
        Abstain
    }

    struct ProposalDetails {
        address proposer;
        bytes32 title;
        bytes32 url;
        uint256 voteStart;
        uint256 voteEnd;
        uint256 againstVotes;
        uint256 forVotes;
        uint256 abstainVotes;
        bool executed;
        bool canceled;
    }

    struct ProposalVote {
        uint256 againstVotes;
        uint256 forVotes;
        uint256 abstainVotes;
        bool hasVoted;
    }

    event ProposalCreated(
        uint256 proposalId,
        address proposer,
        string title,
        string url,
        uint256 voteStart,
        uint256 voteEnd
    );

    event ProposalExecuted(uint256 proposalId);

    event ProposalCanceled(uint256 proposalId);

    event VoteCast(
        address voter,
        uint256 proposalId,
        uint256 weight,
        uint8 support
    );
}

contract WannaGovernancePool is Ownable, WannaGovernor, ReentrancyGuard {
    string public name = "Wanna Governer Pool";
    string public symbol = "WGP";

    IERC5805 public immutable token;
    IWannaLockUp public immutable lock;

    bytes32 public publicMerkleRoot;
    mapping(address => bool) public privateUser;
    mapping(uint256 => ProposalDetails) private _proposals;
    mapping(uint256 => mapping(address => ProposalVote)) private _proposalVotes;

    uint256 _proposalThreshold = 0 * 10 ** 18; // 0 token
    uint256 _votingPeriod = 28_800; // 7 day
    uint256 _quorumVotes = 1000 * 10 ** 18; // 1000 token

    error NotEnough();
    error NotAllow();
    error ExistPropose();
    error UnknownProposal();
    error NotSuccessful();
    error InvalidSupport();
    error AlreadyVoted();

    constructor(
        bytes32 _merkleRoot,
        IERC5805 _tokenAddress,
        IWannaLockUp _lockAddress
    ) {
        publicMerkleRoot = _merkleRoot;
        token = _tokenAddress;
        lock = _lockAddress;
    }

    function isValidUser(
        address user,
        bytes32[] calldata proof
    ) public view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(user));
        return MerkleProof.verify(proof, publicMerkleRoot, leaf);
    }

    function setPrivateAddress(
        address _privateUser,
        bool _status
    ) external onlyOwner {
        privateUser[_privateUser] = _status;
    }

    function setPublicMerkleRoot(bytes32 _merkleRoot) public onlyOwner {
        publicMerkleRoot = _merkleRoot;
    }

    function proposalThreshold() public view returns (uint256) {
        return _proposalThreshold;
    }

    function setProposalThreshold(uint256 _tokenAmount) public onlyOwner {
        _proposalThreshold = _tokenAmount;
    }

    function votingPeriod() public view returns (uint256) {
        return _votingPeriod;
    }

    function setVotingPeriod(uint256 _period) public onlyOwner {
        _votingPeriod = _period;
    }

    function setQuorumVotes(uint256 _quorumVotesAmount) public onlyOwner {
        _quorumVotes = _quorumVotesAmount;
    }

    function quorumVotes() public view returns (uint256) {
        return _quorumVotes;
    }

    function proposals(
        uint256 proposalId
    ) public view returns (ProposalDetails memory) {
        return _proposals[proposalId];
    }

    function proposalVotes(
        uint256 proposalId
    )
        public
        view
        returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)
    {
        ProposalDetails storage proposal = _proposals[proposalId];
        return (
            proposal.againstVotes,
            proposal.forVotes,
            proposal.abstainVotes
        );
    }

    function state(uint256 proposalId) public view returns (ProposalState) {
        ProposalDetails storage proposal = _proposals[proposalId];

        if (proposal.proposer == address(0)) {
            revert UnknownProposal();
        }

        if (proposal.executed) {
            return ProposalState.Executed;
        }

        if (proposal.canceled) {
            return ProposalState.Canceled;
        }

        uint256 currentTimepoint = token.clock();

        uint256 deadline = proposal.voteEnd;

        if (currentTimepoint < proposal.voteStart) {
            return ProposalState.Pending;
        }

        if (deadline > currentTimepoint) {
            return ProposalState.Active;
        }

        uint256 totalVotes = proposal.forVotes +
            proposal.againstVotes +
            proposal.abstainVotes;

        if (totalVotes < quorumVotes()) {
            return ProposalState.Expired;
        }

        if (
            proposal.forVotes > proposal.againstVotes &&
            proposal.forVotes > proposal.abstainVotes
        ) {
            return ProposalState.Succeeded;
        }

        return ProposalState.Defeated;
    }

    function hashProposal(
        bytes32 titleHash,
        bytes32 urlHash
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(titleHash, urlHash)));
    }

    function propose(
        string memory title,
        string memory url,
        bytes32[] calldata proof
    ) public nonReentrant returns (uint256) {
        address proposer = _msgSender();

        if (
            !isValidUser(proposer, proof) &&
            !privateUser[proposer] &&
            proposer != owner()
        ) {
            revert NotAllow();
        }

        uint256 currentTimepoint = token.clock();

        if (currentTimepoint == 0) {
            revert NotSuccessful();
        }

        uint256 lockAmount = lock.getLockedAmountOfAddress(proposer);

        if (
            token.getPastVotes(proposer, currentTimepoint - 1) + lockAmount <
            proposalThreshold()
        ) {
            revert NotEnough();
        }

        uint256 proposalId = hashProposal(
            keccak256(bytes(title)),
            keccak256(bytes(url))
        );

        if (_proposals[proposalId].proposer != address(0)) {
            revert ExistPropose();
        }

        uint256 start = currentTimepoint + 1;
        uint256 end = start + votingPeriod();

        _proposals[proposalId] = ProposalDetails(
            proposer,
            keccak256(bytes(title)),
            keccak256(bytes(url)),
            start,
            end,
            0,
            0,
            0,
            false,
            false
        );

        emit ProposalCreated(
            proposalId,
            proposer,
            title,
            url,
            start,
            end
        );

        return proposalId;
    }

    function execute(
        string memory title,
        string memory url
    ) public payable nonReentrant returns (uint256) {
        uint256 proposalId = hashProposal(
            keccak256(bytes(title)),
            keccak256(bytes(url))
        );

        address proposer = _msgSender();

        ProposalDetails storage proposal = _proposals[proposalId];

        if (proposer != proposal.proposer && proposer != owner()) {
            revert NotAllow();
        }

        ProposalState currentState = state(proposalId);

        if (currentState != ProposalState.Succeeded) {
            revert NotSuccessful();
        }

        proposal.executed = true;
        emit ProposalExecuted(proposalId);

        return proposalId;
    }

    function cancel(
        string memory title,
        string memory url
    ) public payable nonReentrant returns (uint256) {
        uint256 proposalId = hashProposal(
            keccak256(bytes(title)),
            keccak256(bytes(url))
        );

        address proposer = _msgSender();

        ProposalDetails storage proposal = _proposals[proposalId];

        if (proposer != proposal.proposer && proposer != owner()) {
            revert NotAllow();
        }

        ProposalState currentState = state(proposalId);

        if (currentState != ProposalState.Active) {
            revert NotSuccessful();
        }

        proposal.canceled = true;

        emit ProposalCanceled(proposalId);

        return proposalId;
    }

    function voterVote(
        uint256 proposalId,
        address account
    ) external view returns (ProposalVote memory) {
        return _proposalVotes[proposalId][account];
    }

    function hasVoted(
        uint256 proposalId,
        address account
    ) public view virtual returns (bool) {
        return _proposalVotes[proposalId][account].hasVoted;
    }

    function proposalVotesWeight(uint256 proposalId, address voter) public view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) {
        ProposalVote storage proposal = _proposalVotes[proposalId][voter];
        
        return (
            proposal.againstVotes,
            proposal.forVotes,
            proposal.abstainVotes
        );
    }

    function proposalDelegateAmount(uint256 proposalId, address voter) public view returns (uint256) {
        uint256 weight = 0;

        ProposalDetails storage proposal = _proposals[proposalId];

        uint256 lockAmount = lock.getLockedAmountOfAddress(voter);

        weight = token.getPastVotes(voter, proposal.voteStart - 1) +
            lockAmount;

        return weight;
    }

    function castVote(
        uint256 proposalId,
        uint8 support
    ) public returns (uint256) {
        address voter = _msgSender();

        ProposalDetails storage proposal = _proposals[proposalId];

        if (_proposalVotes[proposalId][voter].hasVoted) {
            revert AlreadyVoted();
        }

        ProposalState currentState = state(proposalId);

        if (currentState != ProposalState.Active) {
            revert NotSuccessful();
        }

        uint256 lockAmount = lock.getLockedAmountOfAddress(voter);

        uint256 weight = token.getPastVotes(voter, proposal.voteStart - 1) +
            lockAmount;

        _proposalVotes[proposalId][voter] = ProposalVote(0, 0, 0, true);

        if (support == uint8(VoteType.Against)) {
            proposal.againstVotes += weight;
            _proposalVotes[proposalId][voter].againstVotes += weight;
        } else if (support == uint8(VoteType.For)) {
            proposal.forVotes += weight;
            _proposalVotes[proposalId][voter].forVotes += weight;
        } else if (support == uint8(VoteType.Abstain)) {
            proposal.abstainVotes += weight;
            _proposalVotes[proposalId][voter].abstainVotes += weight;
        } else {
            revert InvalidSupport();
        }

        emit VoteCast(voter, proposalId, weight, support);

        return weight;
    }
}
