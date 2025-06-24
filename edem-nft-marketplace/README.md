# Smart Contract 보안 보고서

## Slither 검사 결과

> [Slither](https://github.com/crytic/slither)는 Smart Conatract가 보안적으로 부족한 부분은 없는지 취약점을 검사할 수 있는 FrameWork입니다.

```javascript
    // 보얀체크
    slither .
    // 사람이 이해할 수 있는 보안 결과 간단하게 정리해서 제공
    slither . --print human-summary
```

<검사 결과>

```javascript
Generating typings for: 36 artifacts in dir: typechain-types for target: ethers-v5
Successfully generated 96 typings!
Compiled 36 Solidity files successfully


Compiled with Builder
Number of lines: 1592 (+ 1395 in dependencies, + 0 in tests)
Number of assembly lines: 0
Number of contracts: 23 (+ 13 in dependencies, + 0 tests)

Number of optimization issues: 0
Number of informational issues: 64
Number of low issues: 21
Number of medium issues: 10
Number of high issues: 1

Use: Openzeppelin-Ownable
ERCs: ERC165, ERC721, ERC20

+--------------------------+-------------+------+------------+--------------+--------------------+
|           Name           | # functions | ERCS | ERC20 info | Complex code |      Features      |
+--------------------------+-------------+------+------------+--------------+--------------------+
|           Edem           |      33     |      |            |      No      |    Receive ETH     |
|                          |             |      |            |              |      Send ETH      |
|                          |             |      |            |              |     Ecrecover      |
|                          |             |      |            |              | Tokens interaction |
| ProtocolExecutionManager |      18     |      |            |      No      |                    |
|      RoyaltyManager      |      12     |      |            |      No      |                    |
|    TradeTokenManager     |      18     |      |            |      No      |                    |
|     TransferManager      |      14     |      |            |      No      |                    |
|         IOwnable         |      3      |      |            |      No      |                    |
|          IWETH           |      3      |      |            |      No      |    Receive ETH     |
|       MarketTypes        |      2      |      |            |      No      |                    |
|     SignHashChecker      |      2      |      |            |      No      |     Ecrecover      |
|   ProtocolAndExecution   |      16     |      |            |      No      |                    |
|         Royalty          |      17     |      |            |      No      |                    |
|    RoyaltySubmission     |      18     |      |            |     Yes      |                    |
|       Transfer1155       |      3      |      |            |      No      | Tokens interaction |
|       Transfer721        |      3      |      |            |      No      | Tokens interaction |
|      Unsupported721      |      3      |      |            |      No      | Tokens interaction |
+--------------------------+-------------+------+------------+--------------+--------------------+
. analyzed (36 contracts)
```

- 해당 이슈 문제점 분석

```javascript
Summary
 - [arbitrary-send-erc20](#arbitrary-send-erc20) (1 results) (High)
 - [uninitialized-local](#uninitialized-local) (3 results) (Medium)
 - [unused-return](#unused-return) (7 results) (Medium)
 - [shadowing-local](#shadowing-local) (1 results) (Low)
 - [missing-zero-check](#missing-zero-check) (8 results) (Low)
 - [variable-scope](#variable-scope) (3 results) (Low)
 - [reentrancy-benign](#reentrancy-benign) (1 results) (Low)
 - [reentrancy-events](#reentrancy-events) (6 results) (Low)
 - [timestamp](#timestamp) (2 results) (Low)
 - [assembly](#assembly) (4 results) (Informational)
 - [pragma](#pragma) (1 results) (Informational)
 - [solc-version](#solc-version) (37 results) (Informational)
 - [low-level-calls](#low-level-calls) (4 results) (Informational)
 - [naming-convention](#naming-convention) (16 results) (Informational)
 - [similar-names](#similar-names) (1 results) (Informational)
 - [too-many-digits](#too-many-digits) (1 results) (Informational)
## arbitrary-send-erc20

Unsupported721.transferFrom(address,address,address,uint256,uint256) (contracts/transfer/Unsupported721.sol#15-24) uses arbitrary from in transferFrom: IERC721(collection).transferFrom(from,to,tokenId) (contracts/transfer/Unsupported721.sol#23)
Reference: https://github.com/trailofbits/slither/wiki/Detector-Documentation#arbitrary-send-erc20

RoyaltySubmission.checkForCollectionSubmission(address).setter_scope_0 (contracts/royalty/RoyaltySubmission.sol#127) is a local variable never initialized
RoyaltySubmission.checkForCollectionSubmission(address).interfaceSupport (contracts/royalty/RoyaltySubmission.sol#118) is a local variable never initialized
RoyaltySubmission.checkForCollectionSubmission(address).setter (contracts/royalty/RoyaltySubmission.sol#124) is a local variable never initialized
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#uninitialized-local-variables

ProtocolExecutionManager.addProtocol(address) (contracts/ProtocolExecutionManager.sol#19-28) ignores return value by _whitelistedProtocols.add(protocol) (contracts/ProtocolExecutionManager.sol#25)
ProtocolExecutionManager.removeProtocol(address) (contracts/ProtocolExecutionManager.sol#31-40) ignores return value by _whitelistedProtocols.remove(protocol) (contracts/ProtocolExecutionManager.sol#37)
TradeTokenManager.addToken(address) (contracts/TradeTokenManager.sol#19-28) ignores return value by _whitelistedTokens.add(token) (contracts/TradeTokenManager.sol#25)
TradeTokenManager.removeToken(address) (contracts/TradeTokenManager.sol#31-37) ignores return value by _whitelistedTokens.remove(token) (contracts/TradeTokenManager.sol#34)
RoyaltySubmission.checkForCollectionSubmission(address) (contracts/royalty/RoyaltySubmission.sol#105-133) ignores return value by IERC165(collection).supportsInterface(INTERFACE_ID_ERC2981) (contracts/royalty/RoyaltySubmission.sol#116-122)
RoyaltySubmission.checkForCollectionSubmission(address) (contracts/royalty/RoyaltySubmission.sol#105-133) ignores return value by IOwnable(collection).owner() (contracts/royalty/RoyaltySubmission.sol#124-132)
RoyaltySubmission.checkForCollectionSubmission(address) (contracts/royalty/RoyaltySubmission.sol#105-133) ignores return value by IOwnable(collection).admin() (contracts/royalty/RoyaltySubmission.sol#127-131)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unused-return
```
