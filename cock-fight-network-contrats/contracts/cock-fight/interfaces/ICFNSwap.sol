pragma solidity ^0.8.1;

interface ICFNSwap {

    event UpdateReceiveWallet(address indexed wallet);
    event UpdateAccessControl(address indexed wallet);
    event UpdateErc20TokenManager(address indexed wallet);
    event UpdateIsSale(address indexed wallet, bool _isSale);
    event UpdateMaxCFNSwapAmount(address indexed wallet, uint256 _maxCFNSwapAmount);
    event UpdateRate(address indexed wallet, uint256 _rate);
    event SwapExactGMMTForExactTokens(address indexed _account, uint256 _gmmtAmount, uint256 _cfnAmount);
    event WithdrawCoin(address indexed wallet, uint256 amount);
    event WithdrawToken(address indexed wallet, uint256 amount);

    function maxCFNSwapAmount() external view returns(uint256 _maxCFNSwapAmount);
    function totalSwapBalance() external view returns(uint256 _totalSwapBalance);
    function rate() external view returns(uint256 _rate);
    function isSale() external view returns(bool _isSale);
    function getSwapCFNAmount(uint256 _amount) external view returns(uint256 _cfnAmount);
    function getSwapCoinAmount(uint256 _amount) external view returns(uint256 _coinAmount);
    
    function setAccessControl(address _ca) external;
    function setErc20TokenManager(address _ca) external;
    function setReceiveWallet(address _receiveWallet) external;
    function setMaxCFNSwapAmount(uint256 _maxCFNSwapAmount) external;
    function setRate(uint256 _rate) external;
    function setIsSale(bool _isSale) external;
    function swapExactGMMTForExactTokens() external payable;
    function withdrawTokenAll() external;
    function withdrawToken(uint256 _amount) external;
    function withdrawCoinAll() external;
    function withdrawCoin(uint256 _amount) external;


}
