// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWannaLockUp {
    struct LockInfo {
        uint256 startTime;
        uint256 endTime;
        uint256 amount;
        bool isUnlock;
    }

    event Lock(
        address indexed recipient,
        uint256 amount,
        uint256 lockTime,
        uint256 startTime,
        uint256 endTime
    );
    event Claim(
        address indexed recipient,
        uint256 amount,
        uint256[] lockIndexs
    );

    error ZeroAddress();
    error ZeroAmount();
    error ZeroLockTime();
    error NoUnlockedTokens();
    error InvalidIndex();
    error NotEnough();

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function initialLockedSupply() external view returns (uint256);

    function totalClaimed() external view returns (uint256);

    function tokenManager() external view returns (IERC20);

    function addressOfLocks(
        address account,
        uint256 index
    ) external view returns (LockInfo memory);

    function getTokenBalance() external view returns (uint256);

    function getLockCount(address _recipient) external view returns (uint256);

    function getLockInfo(
        address _recipient,
        uint256 _index
    ) external view returns (LockInfo memory);

    function getLockedAmountOfAddress(
        address _recipient
    ) external view returns (uint256);

    function getClaimableAmount(
        address _recipient
    ) external view returns (uint256);

    function withdrawAll() external;

    function lockUp(
        address _recipient,
        uint256 _amount,
        uint256 _lockTime
    ) external;

    function claimSelected(uint256[] calldata indexes) external;

    function claimAll() external;
}
