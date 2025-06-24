// TODO : ITransferManager.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITransferExecution {
    function transferFrom(
        address collection,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) external;
}
