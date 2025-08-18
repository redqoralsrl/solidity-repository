// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IWannaLockUp {
    struct LockInfo {
        uint256 startTime;
        uint256 amount;
        uint256 percentage;
        uint256 withdrawAmount;
    }

    event LockPercentage(
        uint256 unlockPercentage,
        uint256 totalUnLockPercentage
    );
    event Lock(address indexed recipient, uint256 startTime, uint256 amount);
    event Claim(
        address indexed recipient,
        uint256 amount,
        uint256 percentage,
        uint256[] lockIndexs
    );

    error UnLockSettingError();
    error ZeroAddress();
    error ZeroAmount();
    error ZeroLockTime();
    error NoUnlockedTokens();
    error InvalidIndex();
    error NotEnough();
    error SystemError();

    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function initialLockedSupply() external view returns (uint256);

    function totalClaimed() external view returns (uint256);

    function unLockPercentage() external view returns (uint256);

    function totalPercentage() external view returns (uint256);

    function tokenManager() external view returns (address);

    function unLockList(uint256 index) external view returns (uint256);

    function addressOfLocks(
        address account,
        uint256 index
    )
        external
        view
        returns (
            uint256 startTime,
            uint256 amount,
            uint256 percentage,
            uint256 withdrawAmount
        );

    function getUnLockList() external view returns (uint256[] memory);

    function getTokenBalance() external view returns (uint256);

    function getLockCount(address _recipient) external view returns (uint256);

    function getLockInfo(
        address _recipient,
        uint256 _index
    )
        external
        view
        returns (
            uint256 startTime,
            uint256 amount,
            uint256 percentage,
            uint256 withdrawAmount
        );

    function getLockInfoAll(
        address _recipient
    ) external view returns (LockInfo[] memory);

    function getLockClaimStatus(
        address _recipient
    ) external view returns (bool);

    function getLockedAmountOfAddress(
        address _recipient
    ) external view returns (uint256);

    function getClaimableAmount(
        address _recipient
    ) external view returns (uint256 total);

    function increaseUnlockPercent(uint256 _unlock) external;

    function withdrawAll() external;

    function withdraw(uint256 _amount) external;

    function lockUp(address _recipient, uint256 _amount) external;

    function claimSelected(uint256[] calldata indexes) external;

    function claimAll() external;
}
