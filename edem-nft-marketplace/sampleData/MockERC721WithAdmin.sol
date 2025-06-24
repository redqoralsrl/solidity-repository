// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MockERC721WithAdmin is ERC721 {
    address public immutable admin;

        using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;


    constructor() ERC721("MyToken", "MTK") {
        admin = msg.sender;
    }



    function _baseURI() internal pure override returns (string memory) {
        return "https://gateway.pinata.cloud/ipfs/QmPECXCrme3PAUT3rMM4kdFSwfiHtw9cp3bNSebNq57EzN/";
    }


    function safeMint(address to) public {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
    }
}
