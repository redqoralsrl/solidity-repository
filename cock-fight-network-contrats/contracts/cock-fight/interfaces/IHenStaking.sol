// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

interface IHenStaking {
    struct Info {
        address owner;  // receipt owner
        uint256 startTimestamp; // 스테이킹 시작 시간
        uint256 accStakingTimestamp; // 누적된 스테이킹 시간
        uint256 accRewardAmount; // 누적된 리워드 양
    }

    event MintHenReceipt(address indexed _owner, uint256 indexed _tokenId);
    event StakingHenReceipt(address indexed _owner, uint256 indexed _tokenId, Info _info);
    event WithdrawHenReceipt(address indexed _owner, uint256 indexed _tokenId, Info _info);
    event WithdrawManagerHenReceipt(address _manager, address indexed _owner, uint256 indexed _tokenId, Info _info);
    event UpdateReceiveWallet(address indexed wallet);
    event UpdateAccessControl(address indexed wallet);
    event UpdateHenManager(address indexed wallet);
    event UpdateErc20TokenManager(address indexed wallet);
    event Withdraw(address indexed walletAddress, uint256 withdrawAmount);
    event WithdrawToken(
        address indexed walletAddress,
        uint256 withdrawAmount,
        address tokenContract
    );

    error HenReceiptError(address wallet);

    function maxReward() external view returns(uint256 _maxReward);
    function maxHenStakingAmount() external view returns(uint256 _maxHenStakingAmount);
    function totalHenStakingAmount() external view returns(uint256 _totalHenStakingAmount);
    function maxStakingTimestamp() external view returns(uint256 _maxStakingTimestamp);
    function stakingAllowedTimestamp() external view returns(uint256 _stakingAllowedTimestamp);
    function rewardPerStakingAllowed() external view returns(uint256 _rewardPerStakingAllowed);
    function accWithdrawAmount() external view returns(uint256 _accWithdrawAmount);
    function stakingActive() external view returns(bool _stakingActive);
    function stakingInfo(uint256 _tokenId) external view returns(Info memory _stakingInfo);
    function tokenURI(uint256 tokenId) external view returns (string memory);

    function setAccessControl(address _ca) external;
    function setHenManager(address _ca) external;
    function setErc20TokenManager(address _ca) external;
    function setReceiveWallet(address _receiveWallet) external;
    function setMaxReward(uint256  _maxReward) external;
    function setRewardPerStakingAllowed(uint256  _rewardPerStakingAllowed) external;
    function setStakingActive(bool _stakingActive) external;
    function setMaxHenStakingAmount(uint256 _maxHenStakingAmount) external;
    function henStaking(uint256  _tokenId) external;
    function reward(uint256 _tokenId) external view returns(uint256 _reward);
    function henWithdraw(uint256 _tokenId) external;
    function henWithdrawManager(uint256 _tokenId) external;
    function aggregate(bytes[] calldata callDatas) external;
    function withdrawToken(uint256 _amount) external;
    function withdrawTokenAll() external;
    function withdrawCoin(uint256 _amount) external;
    function withdrawCoinAll() external;
    function getStakingInfo(uint256 _tokenId) external view returns(address owner, uint256 startTimestamp, uint256 receiveReward ,uint256 accRewardAmount);
}