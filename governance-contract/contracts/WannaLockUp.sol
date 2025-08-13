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
        uint256 endTime;
        uint256 amount;
        bool isUnlock;
    }

    mapping(address => LockInfo[]) public addressOfLocks;

    uint256 public initialLockedSupply;
    uint256 public totalClaimed;

    IERC20 public immutable tokenManager;

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

    constructor(address _token) {
        if (_token == address(0)) revert ZeroAddress();
        tokenManager = IERC20(_token);
    }

    function getTokenBalance() external view returns (uint256) {
        return tokenManager.balanceOf(address(this));
    }

    function withdrawAll() external onlyOwner {
        if (owner() == address(0)) revert ZeroAddress();

        uint256 tokenAmount = tokenManager.balanceOf(address(this));
        if (tokenAmount == 0) revert NotEnough();

        tokenManager.safeTransfer(owner(), tokenAmount);
    }

    function lockUp(
        address _recipient,
        uint256 _amount,
        uint256 _lockTime
    ) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        if (_amount == 0) revert ZeroAmount();
        if (_lockTime == 0) revert ZeroLockTime();

        tokenManager.safeTransferFrom(msg.sender, address(this), _amount);

        initialLockedSupply += _amount;
        addressOfLocks[_recipient].push(
            LockInfo(
                block.timestamp,
                block.timestamp + _lockTime,
                _amount,
                false
            )
        );

        emit Lock(
            _recipient,
            _amount,
            _lockTime,
            block.timestamp,
            block.timestamp + _lockTime
        );
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

    function getLockedAmountOfAddress(
        address _recipient
    ) external view returns (uint256) {
        LockInfo[] storage locks = addressOfLocks[_recipient];
        uint256 len = locks.length;

        uint256 total = 0;

        for (uint256 i = 0; i < len; ) {
            LockInfo storage lock = locks[i];

            if (!lock.isUnlock) {
                total += lock.amount;
            }
            unchecked {
                i++;
            }
        }

        return total;
    }

    function getClaimableAmount(
        address _recipient
    ) external view returns (uint256) {
        LockInfo[] storage locks = addressOfLocks[_recipient];
        uint256 len = locks.length;
        uint256 ts = block.timestamp;

        uint256 claimable = 0;

        for (uint256 i = 0; i < len; ) {
            LockInfo storage lock = locks[i];

            if (!lock.isUnlock && ts >= lock.endTime) {
                claimable += lock.amount;
            }
            unchecked {
                i++;
            }
        }

        return claimable;
    }

    function claimSelected(uint256[] calldata indexes) external nonReentrant {
        LockInfo[] storage locks = addressOfLocks[msg.sender];
        uint256 len = locks.length;
        uint256 ts = block.timestamp;

        uint256 total;
        for (uint256 i; i < indexes.length; ) {
            uint256 j = indexes[i];
            if (j >= len) revert InvalidIndex();
            LockInfo storage l = locks[j];
            if (!l.isUnlock && ts >= l.endTime) {
                total += l.amount;
                l.isUnlock = true;
            }
            unchecked {
                i++;
            }
        }
        if (total == 0) revert NoUnlockedTokens();

        totalClaimed += total;
        tokenManager.safeTransfer(msg.sender, total);
        emit Claim(msg.sender, total, indexes);
    }

    function claimAll() external nonReentrant {
        LockInfo[] storage locks = addressOfLocks[msg.sender];
        uint256 len = locks.length;
        uint256 ts = block.timestamp;

        uint256 n;
        for (uint256 i; i < len; ) {
            LockInfo storage l = locks[i];
            if (!l.isUnlock && ts >= l.endTime) {
                n++;
            }
            unchecked {
                i++;
            }
        }
        if (n == 0) revert NoUnlockedTokens();

        uint256[] memory idx = new uint256[](n);
        uint256 total;
        uint256 k;
        for (uint256 i; i < len; ) {
            LockInfo storage l = locks[i];
            if (!l.isUnlock && ts >= l.endTime) {
                total += l.amount;
                l.isUnlock = true;
                idx[k++] = i;
            }
            unchecked {
                i++;
            }
        }

        totalClaimed += total;
        tokenManager.safeTransfer(msg.sender, total);
        emit Claim(msg.sender, total, idx);
    }
}
