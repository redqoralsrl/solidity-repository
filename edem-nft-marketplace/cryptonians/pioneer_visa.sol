// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract PioneersCryptonians is ERC721, Ownable {

    using Counters for Counters.Counter;
    using Strings for uint256;
    Counters.Counter private _tokenIdCounter;
    string public fileExtention = ".json";
    string private url;

    constructor(address initialOwner, string memory initialUrl)
    ERC721("Pioneers Cryptonians", "PCM")
    Ownable(initialOwner)
    {
        url = initialUrl;
    }


    function _baseURI() internal view override returns (string memory) {
        return url;
    }

    function setUrl(string memory uri) public onlyOwner {
        url = uri;
    }

    function mint(address _to) public onlyOwner {
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        _safeMint(_to, tokenId);
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "ERC721Metadata: URI query for nonexistent token");
        string memory baseURI = _baseURI();
        return string(abi.encodePacked(baseURI, tokenId.toString(), fileExtention));
    }
}
