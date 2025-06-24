// SPDX-License-Identifier: MIT
pragma solidity ^0.8.1;

import { ReentrancyGuard } from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IERC20, SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/ICFNAccessControl.sol";

contract CFNSwap is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public erc20TokenManager;
    ICFNAccessControl public accessControl;
    address payable public receiveWallet;

    uint256 public maxCFNSwapAmount = 1000000 * 1e18;
    uint256 public totalSwapBalance = 0;
    uint256 public rate = 100;
    bool public isSale = true;

    event UpdateReceiveWallet(address indexed wallet);
    event UpdateAccessControl(address indexed wallet);
    event UpdateErc20TokenManager(address indexed wallet);
    event UpdateMaxCFNSwapAmount(address indexed wallet, uint256 _maxCFNSwapAmount);
    event UpdateRate(address indexed wallet, uint256 _rate);
    event UpdateIsSale(address indexed wallet, bool _rate);
    event SwapExactGMMTForExactTokens(address indexed _account, uint256 _gmmtAmount, uint256 _cfnAmount);
    event WithdrawCoin(address indexed wallet, uint256 amount);
    event WithdrawToken(address indexed wallet, uint256 amount);

    constructor(
        address _accessControl,
        address _cfnContract,
        address _receiveWallet
    ){
        require(_cfnContract != address(0), "Invalid ERC20 address");
        require(_accessControl != address(0), "Invalid accessControl address");
        erc20TokenManager = IERC20(_cfnContract);
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

    function setErc20TokenManager(
        address _ca
    ) public isWhiteListControl(msg.sender) {
        erc20TokenManager = IERC20(_ca);
        
        emit UpdateErc20TokenManager(_ca);
    }

    function setAccessControl(
        address _ca
    ) public isWhiteListControl(msg.sender) {
        accessControl = ICFNAccessControl(_ca);
        
        emit UpdateAccessControl(_ca);
    }

    function setReceiveWallet(
        address _receiveWallet
    ) public isWhiteListControl(msg.sender) {
        receiveWallet = payable(_receiveWallet);

        emit UpdateReceiveWallet(_receiveWallet);
    }

    function setMaxCFNSwapAmount(
        uint256 _maxCFNSwapAmount
    ) public isWhiteListControl(msg.sender) {
        maxCFNSwapAmount = _maxCFNSwapAmount;
        
        emit UpdateMaxCFNSwapAmount(msg.sender, _maxCFNSwapAmount);
    }

    // decimal 생각안해도됨.
    function setRate(
        uint256 _rate
    ) public isWhiteListControl(msg.sender) {
        rate = _rate;
        
        emit UpdateRate(msg.sender, _rate);
    }

    function setIsSale(
        bool _isSale
    ) public isWhiteListControl(msg.sender) {
        isSale = _isSale;
        
        emit UpdateIsSale(msg.sender, _isSale);
    }

    function getSwapCFNAmount(uint256 _amount) public view returns(uint256){
        if(_amount < rate * 1e18){
            return 0;
        }else{
            uint256 cfnAmount = _amount / rate;
            return cfnAmount;
        }
    }

    function getSwapCoinAmount(uint256 _amount) public view returns(uint256){
        uint256 coinAmount = _amount * (rate * 1e18);
        return coinAmount;
    }

    function checkDecimal(uint256 _amount) internal pure returns (uint256) {
        return _amount % 1e18;
    }

    function swapExactGMMTForExactTokens() isBlackListWallet(msg.sender) public nonReentrant payable {
        uint256 receiveAmount = getSwapCFNAmount(msg.value);

        uint256 contractBalance = erc20TokenManager.balanceOf(address(this));
        uint256 getDecimal = checkDecimal(receiveAmount);

        require(isSale , "Do not sell.");
        require(msg.value >= rate * 1e18 , "It must be greater than the rate.");
        require(receiveAmount <= contractBalance , "Not enough CFN balance.");
        require(getDecimal <= 0 , "The existence of a decimal point.");
        require(totalSwapBalance < maxCFNSwapAmount , "End of the event.");
        require(totalSwapBalance + receiveAmount <= maxCFNSwapAmount , "Total amount paid has been exceeded.");

        totalSwapBalance += receiveAmount;
        erc20TokenManager.transfer(msg.sender, receiveAmount);
        emit SwapExactGMMTForExactTokens(msg.sender, msg.value, receiveAmount);
        if(totalSwapBalance >= maxCFNSwapAmount ){
            isSale = false;
            emit UpdateIsSale(address(this), false);
        }
    }

   // 토큰 전체 출금
    function withdrawTokenAll() public isWhiteListControl(msg.sender) {
        require(receiveWallet != address(0), "Cannot be null address");

        uint256 tokenAmount = erc20TokenManager.balanceOf(address(this));
        require(tokenAmount > 0, "Amount must be greater than 0");
        require(tokenAmount > 0, "Not enough token balance.");

        erc20TokenManager.transfer(receiveWallet, tokenAmount);

        emit WithdrawToken(receiveWallet, tokenAmount);
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

        emit WithdrawToken(receiveWallet, _amount);
    }

    // 코인 전체 출금
    function withdrawCoinAll() public isWhiteListControl(msg.sender) {
        require(receiveWallet != address(0), "Cannot be null address");

        uint256 balance = address(this).balance;
        require(balance > 0, "Not enough coin balance.");

        (bool success, ) = receiveWallet.call{value: balance}("");
        require(success, "Transfer failed.");

        emit WithdrawCoin(receiveWallet, balance);
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

        emit WithdrawCoin(receiveWallet, _amount);
    }

}