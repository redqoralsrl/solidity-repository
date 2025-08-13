// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "@openzeppelin/contracts/governance/compatibility/GovernorCompatibilityBravo.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WannaGovernance is
    Governor,
    GovernorCompatibilityBravo,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl,
    Ownable
{
    mapping(address => bool) public privateList;
    mapping(address => bool) public publicList;

    address[] public publicAddresses;

    modifier onlyAuthorizedProposer() {
        require(
            msg.sender == owner() ||
                privateList[msg.sender] ||
                publicList[msg.sender],
            "Not authorized to propose"
        );
        _;
    }

    constructor(
        IVotes _token,
        TimelockController _timelock
    )
        Governor("WannaGovernance")
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4)
        GovernorTimelockControl(_timelock)
    {}

    /**
     * GMMT => 1day : 28,800 1hour : 1,200 1 minutes : 20
     */
    function votingDelay() public pure override returns (uint256) {
        // return 28_800; // 1 day
        return 1000;
    }

    function votingPeriod() public pure override returns (uint256) {
        // return 201_600; // 7 day
        return 2000;
    }

    function proposalThreshold() public pure override returns (uint256) {
        return 100 * 10 ** 18; // 100 token
    }

    function setPrivateAddress(
        address _privateAddress,
        bool _status
    ) external onlyOwner {
        privateList[_privateAddress] = _status;
    }

    function setPrivateAddressList(
        address[] calldata _privateAddressList,
        bool _status
    ) external onlyOwner {
        for (uint256 i = 0; i < _privateAddressList.length; i++) {
            privateList[_privateAddressList[i]] = _status;
        }
    }

    function setPublicAddressList(
        address[] calldata _publicAddressList
    ) external onlyOwner {
        for (uint256 i = 0; i < _publicAddressList.length; i++) {
            address addr = _publicAddressList[i];
            if (!publicList[addr]) {
                publicAddresses.push(addr);
                publicList[addr] = true;
            }
        }
    }

    function clearPublicAddresses() external onlyOwner {
        for (uint256 i = 0; i < publicAddresses.length; i++) {
            publicList[publicAddresses[i]] = false;
        }
        delete publicAddresses;
    }

    function getPublicAddressesList() public view returns (address[] memory) {
        return publicAddresses;
    }

    function state(
        uint256 proposalId
    )
        public
        view
        override(Governor, IGovernor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    )
        public
        override(Governor, GovernorCompatibilityBravo, IGovernor)
        onlyAuthorizedProposer
        returns (uint256)
    {
        return super.propose(targets, values, calldatas, description);
    }

    function cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    )
        public
        override(Governor, GovernorCompatibilityBravo, IGovernor)
        returns (uint256)
    {
        return super.cancel(targets, values, calldatas, descriptionHash);
    }

    function cancelOwnerPower(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public onlyOwner returns (uint256) {
        return _cancel(targets, values, calldatas, descriptionHash);
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(Governor, IERC165, GovernorTimelockControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function proposals(
        uint256 proposalId
    )
        public
        view
        override(GovernorCompatibilityBravo)
        returns (
            uint256 id,
            address proposer,
            uint256 eta,
            uint256 startBlock,
            uint256 endBlock,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            bool canceled,
            bool executed
        )
    {
        return super.proposals(proposalId);
    }

    function getActions(
        uint256 proposalId
    )
        public
        view
        override(GovernorCompatibilityBravo)
        returns (
            address[] memory targets,
            uint256[] memory values,
            string[] memory signatures,
            bytes[] memory calldatas
        )
    {
        return super.getActions(proposalId);
    }

    function getReceipt(
        uint256 proposalId,
        address voter
    )
        public
        view
        override(GovernorCompatibilityBravo)
        returns (Receipt memory)
    {
        return super.getReceipt(proposalId, voter);
    }

    function hasVoted(
        uint256 proposalId,
        address account
    )
        public
        view
        override(GovernorCompatibilityBravo, IGovernor)
        returns (bool)
    {
        return super.hasVoted(proposalId, account);
    }
}
