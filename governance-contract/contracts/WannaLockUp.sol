// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract WannaLockUp is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    string public name = "Wanna Lockup Contract";
    string public symbol = "WLC";

    struct LockInfo {
        uint256 startTime;
        uint256 amount;
        uint256 percentage;
        uint256 withdrawAmount;
    }

    mapping(address => LockInfo[]) public addressOfLocks;

    uint256 public initialLockedSupply;
    uint256 public totalClaimed;

    uint256 public unLockPercentage = 0;
    uint256 public immutable totalPercentage = 100;
    uint256[] public unLockList;

    IERC20 public immutable tokenManager;

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

    constructor(address _token) {
        if (_token == address(0)) revert ZeroAddress();
        tokenManager = IERC20(_token);
    }

    function increaseUnlockPercent(uint256 _unlock) public onlyOwner {
        if (unLockPercentage + _unlock > totalPercentage)
            revert UnLockSettingError();

        unLockPercentage += _unlock;
        unLockList.push(_unlock);

        emit LockPercentage(_unlock, unLockPercentage);
    }

    function getUnLockList() external view returns (uint256[] memory) {
        return unLockList;
    }

    function getTokenBalance() external view returns (uint256) {
        return tokenManager.balanceOf(address(this));
    }

    function getLockCount(address _recipient) external view returns (uint256) {
        return addressOfLocks[_recipient].length;
    }

    function getLockInfo(
        address _recipient,
        uint256 _index
    ) external view returns (LockInfo memory) {
        if (_index >= addressOfLocks[_recipient].length) revert InvalidIndex();
        return addressOfLocks[_recipient][_index];
    }

    function getLockInfoAll(
        address _recipient
    ) public view returns (LockInfo[] memory) {
        return addressOfLocks[_recipient];
    }

    function getLockClaimStatus(address _recipient) public view returns (bool) {
        LockInfo[] storage locks = addressOfLocks[_recipient];
        uint256 len = locks.length;

        for (uint256 i; i < len; ) {
            LockInfo storage l = locks[i];
            if (
                (l.amount * unLockPercentage) / totalPercentage >
                l.withdrawAmount
            ) {
                return true;
            }
            unchecked {
                ++i;
            }
        }
        return false;
    }

    function getLockedAmountOfAddress(
        address _recipient
    ) external view returns (uint256) {
        LockInfo[] storage locks = addressOfLocks[_recipient];
        uint256 len = locks.length;

        uint256 total = 0;

        for (uint256 i = 0; i < len; ) {
            LockInfo storage lock = locks[i];

            total += lock.amount - lock.withdrawAmount;

            unchecked {
                i++;
            }
        }

        return total;
    }

    function getClaimableAmount(
        address _recipient
    ) external view returns (uint256 total) {
        LockInfo[] storage locks = addressOfLocks[_recipient];
        uint256 len = locks.length;

        for (uint256 i; i < len; ) {
            LockInfo storage l = locks[i];

            uint256 entitled = (l.amount * unLockPercentage) / totalPercentage;
            if (entitled > l.withdrawAmount) {
                total += (entitled - l.withdrawAmount);
            }

            unchecked {
                ++i;
            }
        }
    }

    function withdrawAll() external onlyOwner {
        if (owner() == address(0)) revert ZeroAddress();

        uint256 tokenAmount = tokenManager.balanceOf(address(this));
        if (tokenAmount == 0) revert NotEnough();

        tokenManager.safeTransfer(owner(), tokenAmount);
    }

    function withdraw(uint256 _amount) external onlyOwner {
        if (owner() == address(0)) revert ZeroAddress();

        uint256 tokenAmount = tokenManager.balanceOf(address(this));
        if (tokenAmount == 0 || tokenAmount < _amount) revert NotEnough();

        tokenManager.safeTransfer(owner(), _amount);
    }

    function lockUp(
        address _recipient,
        uint256 _amount
    ) external nonReentrant onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();

        initialLockedSupply += _amount;
        addressOfLocks[_recipient].push(
            LockInfo(block.timestamp, _amount, 0, 0)
        );

        emit Lock(_recipient, block.timestamp, _amount);
    }

    function claimSelected(uint256[] calldata indexes) external nonReentrant {
        (uint256 total, uint256[] memory claimedIndexes) = _claim(
            msg.sender,
            indexes
        );
        totalClaimed += total;

        tokenManager.safeTransfer(msg.sender, total);

        emit Claim(msg.sender, total, unLockPercentage, claimedIndexes);
    }

    function claimAll() external nonReentrant {
        uint256[] memory empty;
        (uint256 total, uint256[] memory claimedIndexes) = _claim(
            msg.sender,
            empty
        );
        totalClaimed += total;

        tokenManager.safeTransfer(msg.sender, total);

        emit Claim(msg.sender, total, unLockPercentage, claimedIndexes);
    }

    function _claim(
        address _user,
        uint256[] memory indexes
    ) internal returns (uint256 total, uint256[] memory claimedIndexes) {
        LockInfo[] storage locks = addressOfLocks[_user];
        uint256 len = locks.length;

        bool isAll = (indexes.length == 0);
        uint256 count = isAll ? len : indexes.length;

        claimedIndexes = new uint256[](count);
        uint256 idxCounter;

        for (uint256 i; i < count; ) {
            uint256 j = isAll ? i : indexes[i];
            if (j >= len) revert InvalidIndex();

            LockInfo storage l = locks[j];

            uint256 entitled = (l.amount * unLockPercentage) / totalPercentage;
            if (entitled > l.withdrawAmount) {
                uint256 unlockable = entitled - l.withdrawAmount;

                total += unlockable;
                l.withdrawAmount = entitled;
                l.percentage = unLockPercentage;
                claimedIndexes[idxCounter++] = j;
            }

            unchecked {
                ++i;
            }
        }

        if (total == 0) revert NoUnlockedTokens();

        assembly {
            mstore(claimedIndexes, idxCounter)
        }
    }
}
