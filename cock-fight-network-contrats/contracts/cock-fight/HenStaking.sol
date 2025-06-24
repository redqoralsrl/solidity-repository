// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20, SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "./interfaces/ICFNAccessControl.sol";
import "./interfaces/IHen.sol";

contract HenStaking is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public erc20TokenManager;
    IHen public henManager;
    ICFNAccessControl public accessControl;


    uint256 public maxReward = 1825 * 1e18; // 총 리워드
    uint256 public maxHenStakingAmount = 10000; // 스테이킹 가능한 암탉 수
    uint256 public totalHenStakingAmount = 0;   // 스테이킹한 암탉 수
    uint256 public maxStakingTimestamp = 365 days;   // 최대 스테이킹 시간
    uint256 public stakingAllowedTimestamp = 1 days; //  스테이킹 허용 시간
    uint256 public rewardPerStakingAllowed = 5 * 1e18; // stakingAllowedTimestamp 당 보상
    uint256 public accWithdrawAmount = 0; // 누적 된 withdraw 토큰 양
    bool public stakingActive = true;   // 스테이킹 상태(true = 활성화, false = 비활성화)
    address payable public receiveWallet; // cfn or gmmt withdraw address

    mapping(uint256 => Info) public stakingInfo;

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

    error HenReceiptError(address wallet);

    constructor(
        address _accessControl,
        address _cfnContract,
        address _henContract,
        address _receiveWallet
    ) ERC721("CFN Hen Staking Card ", "CFNHSC") {
        require(_cfnContract != address(0), "Invalid ERC20 address");
        require(_henContract != address(0), "Invalid ERC721 address");
        require(_accessControl != address(0), "Invalid accessControl address");
        require(_receiveWallet != address(0), "Invalid receiveWallet address");

        erc20TokenManager = IERC20(_cfnContract);
        henManager = IHen(_henContract);
        accessControl = ICFNAccessControl(_accessControl);
        receiveWallet = payable(_receiveWallet);
    }

    modifier isBlackListWallet(address _address) {
        require(
            !accessControl.blackListWallet(_address),
            "Transaction denied: address is blacklisted"
        );
        _;
    }

    modifier isWhiteListControl(address _ca) {
        require(
            accessControl.whiteListControlAddress(_ca),
            "Unverified owner address"
        );
        _;
    }

    function setAccessControl(
        address _ca
    ) public isWhiteListControl(msg.sender) {
        accessControl = ICFNAccessControl(_ca);
        
        emit UpdateAccessControl(_ca);
    }

    function setHenManager(
        address _ca
    ) public isWhiteListControl(msg.sender) {
        henManager = IHen(_ca);
        
        emit UpdateHenManager(_ca);
    }

    function setErc20TokenManager(
        address _ca
    ) public isWhiteListControl(msg.sender) {
        erc20TokenManager = IERC20(_ca);
        
        emit UpdateErc20TokenManager(_ca);
    }

    // 총 리워드 양 수정
    function setMaxReward(uint256 _maxReward) public isWhiteListControl(msg.sender) {
        maxReward = _maxReward;
    }

    // stakingAllowedTimestamp 당 보상 양 수정
    function setRewardPerStakingAllowed(uint256 _rewardPerStakingAllowed) public isWhiteListControl(msg.sender) {
        rewardPerStakingAllowed = _rewardPerStakingAllowed;
    }

    // 스테이킹 상태 수정
    function setStakingActive(bool _stakingActive) public isWhiteListControl(msg.sender) {
        stakingActive = _stakingActive;
    }

    // 스테이킹 최대 암탉 수 수정
    function setMaxHenStakingAmount(uint256 _maxHenStakingAmount) public isWhiteListControl(msg.sender) {
        maxHenStakingAmount = _maxHenStakingAmount;
    }


    // hen staking 기능
    function henStaking(uint256 _tokenId) isBlackListWallet(msg.sender) public nonReentrant{

        require(stakingActive, "Hen staking is not available.");
        require(henManager.ownerOf(_tokenId) == msg.sender, "Token does not exist.");
        require(totalHenStakingAmount < maxHenStakingAmount, "Staking the maximum hen.");
        require(!henManager.info(_tokenId).isDead, "Hen is Dead");

        henManager.transferFrom(msg.sender, address(this), _tokenId);
        if(
            stakingInfo[_tokenId].owner == address(0)
        ){
            stakingInfo[_tokenId] = Info(msg.sender, block.timestamp, 0, 0);
            _safeMint(msg.sender, _tokenId);
            emit MintHenReceipt(msg.sender, _tokenId);
        }else{
            stakingInfo[_tokenId].owner = msg.sender;
            stakingInfo[_tokenId].startTimestamp = block.timestamp;
            _approve(msg.sender, _tokenId);
            super.transferFrom(address(this), msg.sender, _tokenId);
        }
        totalHenStakingAmount += 1;

        emit StakingHenReceipt(msg.sender, _tokenId, stakingInfo[_tokenId]);
    }

    // 스테이킹 허용 시간 계산
    function calculateRewardPerStakingAllowed (uint256 _tokenId) internal view returns(uint256) {
        uint256 stakingTimestamp = stakingInfo[_tokenId].startTimestamp != 0 ? block.timestamp - stakingInfo[_tokenId].startTimestamp : 0;
        uint256 beforeTimestamp = stakingInfo[_tokenId].accStakingTimestamp;
        uint256 totalTimeStamp = stakingTimestamp + beforeTimestamp;
        uint256 calculateTimestamp;

        if(stakingTimestamp == 0) return 0;

        if(maxStakingTimestamp < totalTimeStamp){
            calculateTimestamp = maxStakingTimestamp;
        }else{
            calculateTimestamp = totalTimeStamp;
        }

        uint256 calculateDay = calculateTimestamp / stakingAllowedTimestamp;
        return  calculateDay;
    }

    // 받는 리워드 계산
    function reward(uint256 _tokenId) public view returns(uint256){

        uint256 calculateDay = calculateRewardPerStakingAllowed(_tokenId);
        uint256 receiveAmount = calculateDay == 0 ? 0 : (calculateDay * rewardPerStakingAllowed) - stakingInfo[_tokenId].accRewardAmount;

        return receiveAmount;
    }

    // hen withdraw 기능
    function henWithdraw(uint256 _tokenId) isBlackListWallet(msg.sender) public nonReentrant{
        require(!henManager.info(_tokenId).isDead, "Hen is Dead");
        uint256 calculateDay = calculateRewardPerStakingAllowed(_tokenId);
        uint256 receiveAmount = reward(_tokenId);
        Info memory prevInfo = stakingInfo[_tokenId];
        stakingInfo[_tokenId] = Info(address(this), 0, calculateDay * stakingAllowedTimestamp, stakingInfo[_tokenId].accRewardAmount + receiveAmount);


        super.transferFrom(prevInfo.owner, address(this), _tokenId);

        henManager.transferFrom(address(this), prevInfo.owner, _tokenId);

        erc20TokenManager.safeTransfer(prevInfo.owner, receiveAmount);
        accWithdrawAmount += receiveAmount;

        totalHenStakingAmount -= 1;

        if(stakingInfo[_tokenId].accRewardAmount == maxReward){
            henManager.updateIsDead(_tokenId, true);
        }

        emit WithdrawHenReceipt(prevInfo.owner, _tokenId, stakingInfo[_tokenId]);

    }

    // 강제로 hen withdraw 기능
    function henWithdrawManager(uint256 _tokenId) public isWhiteListControl(msg.sender) {
        uint256 calculateDay = calculateRewardPerStakingAllowed(_tokenId);
        uint256 receiveAmount = reward(_tokenId);
        Info memory prevInfo = stakingInfo[_tokenId];
        stakingInfo[_tokenId] = Info(address(this), 0, calculateDay * stakingAllowedTimestamp, stakingInfo[_tokenId].accRewardAmount + receiveAmount);


        henManager.transferFrom(address(this), prevInfo.owner, _tokenId);
        
        erc20TokenManager.safeTransfer(prevInfo.owner, receiveAmount);
        accWithdrawAmount += receiveAmount;
        
        _transfer(prevInfo.owner, address(this), _tokenId);
        
        totalHenStakingAmount -= 1;

        if(stakingInfo[_tokenId].accRewardAmount >= maxReward){
            henManager.updateIsDead(_tokenId, true);
        }

        emit WithdrawManagerHenReceipt(msg.sender, prevInfo.owner, _tokenId, stakingInfo[_tokenId]);
    }

    // multiCall
    function aggregate(bytes[] calldata callDatas) public isWhiteListControl(msg.sender) returns(bytes[] memory returnData){
        uint256 callCount = callDatas.length;
        returnData = new bytes[](callCount);

        for (uint256 i = 0; i < callCount; i++) {
            (bool success, bytes memory data) = address(this).call(callDatas[i]);

            require(success, "Call failed");
            returnData[i] = data;
        }
    }


    function _transfer( address _from, address _to, uint256 _tokenId) internal override isBlackListWallet(_from) isBlackListWallet(_to){
        require(_to != address(0), "Transfer to zero address not allowed");
        require(_to == address(this) || _from == address(this), "Transfer to contract not allowed");
        
        super._transfer(_from, _to, _tokenId);
    }

    event Withdraw(address indexed walletAddress, uint256 withdrawAmount);
    event WithdrawToken(
        address indexed walletAddress,
        uint256 withdrawAmount,
        address tokenContract
    );

    // 토큰 전체 출금
    function withdrawTokenAll() public isWhiteListControl(msg.sender) {
        require(receiveWallet != address(0), "Cannot be null address");

        uint256 tokenAmount = erc20TokenManager.balanceOf(address(this));
        require(tokenAmount > 0, "Amount must be greater than 0");
        require(tokenAmount > 0, "Not enough token balance.");

        erc20TokenManager.transfer(receiveWallet, tokenAmount);

        emit WithdrawToken(receiveWallet, tokenAmount, address(erc20TokenManager));
    }

    // 토큰 원하는 수량 출금
    function withdrawToken(
        uint256 _amount
    ) public isWhiteListControl(msg.sender) {
        require(receiveWallet != address(0), "Cannot be null address");
        require(_amount > 0, "Amount must be greater than 0");

        uint256 tokenAmount = erc20TokenManager.balanceOf(address(this));

        require(tokenAmount >= _amount, "Not enough token balance.");

        erc20TokenManager.transfer(receiveWallet, _amount);

        emit WithdrawToken(receiveWallet, _amount, address(erc20TokenManager));
    }

    // 코인 전체 출금
    function withdrawCoinAll() public isWhiteListControl(msg.sender) {
        require(receiveWallet != address(0), "Cannot be null address");

        uint256 balance = address(this).balance;
        require(balance > 0, "Not enough coin balance.");

        (bool success, ) = receiveWallet.call{value: balance}("");
        require(success, "Transfer failed.");

        emit Withdraw(receiveWallet, balance);
    }

    // 코인 원하는 수량 출금
    function withdrawCoin(
        uint256 _amount
    ) public isWhiteListControl(msg.sender) {
        require(receiveWallet != address(0), "Cannot be null address");
        require(_amount > 0, "Amount must be greater than 0");

        uint256 balance = address(this).balance;
        require(balance >= _amount, "Not enough coin balance.");

        (bool success, ) = receiveWallet.call{value: _amount}("");
        require(success, "Transfer failed.");

        emit Withdraw(receiveWallet, _amount);
    }

    function setReceiveWallet(
        address _receiveWallet
    ) public isWhiteListControl(msg.sender) {
        receiveWallet = payable(_receiveWallet);

        emit UpdateReceiveWallet(_receiveWallet);
    }

    // 스테이킹 정보 보기 (frontend 사용할려고)
    function getStakingInfo(uint256 _tokenId) public view returns(address owner, uint256 startTimestamp, uint256 receiveReward ,uint256 accRewardAmount) {
        owner = stakingInfo[_tokenId].owner;
        startTimestamp = stakingInfo[_tokenId].startTimestamp;
        receiveReward = reward(_tokenId);
        accRewardAmount = stakingInfo[_tokenId].accRewardAmount;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        return henManager.tokenURI(tokenId);
    }
}
