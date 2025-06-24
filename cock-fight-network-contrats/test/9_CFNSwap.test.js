const CFNAccessControl = artifacts.require("CFNAccessControl");
const Cfn = artifacts.require("CFN");
const CFNSwap = artifacts.require("CFNSwap");

const {
    expectRevert,
    time,
    BN,
    expectEvent,
} = require("@openzeppelin/test-helpers");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { assert } = require("chai");

contract("CFNSwap Test", (accounts) => {
    const [deployer, receiveWallet, user, user2, user3, other] = accounts;
    let tokenInstance;
    let cfnAccessControlInstance;
    let CFNSwapInstance;

    beforeEach(async () => {
        tokenInstance = await Cfn.new({ from: deployer });
        cfnAccessControlInstance = await CFNAccessControl.new({ from: deployer });
        CFNSwapInstance = await CFNSwap.new(
            cfnAccessControlInstance.address,
            tokenInstance.address,
            receiveWallet,
            {
                from: deployer,
            });

        await tokenInstance.transfer(
            CFNSwapInstance.address,
            web3.utils.toWei("1000000", "ether"),
            {
                from: deployer,
            }
        );
    });

    const getCFNBalance = async (address) => {
        const balanceOf = await tokenInstance.balanceOf(address);
        console.log(`${address} = ${web3.utils.fromWei(balanceOf.toString(), "ether")}CFN`)
        return balanceOf;
    }


    const setMaxCFNSwapAmountFunc = async (_maxCFNSwapAmount) => {
        let toWei = web3.utils.toWei(_maxCFNSwapAmount);
        await CFNSwapInstance.setMaxCFNSwapAmount(toWei, { from: deployer });
    }
    const setRateFunc = async (_rate) => {
        await CFNSwapInstance.setRate(_rate, { from: deployer });
        const rate = await CFNSwapInstance.rate();
        console.log("rate update", rate.toString())
    }

    const getSwapCoinAmountFunc = async (input) => {
        const coinAmount = await CFNSwapInstance.getSwapCoinAmount(input);
        return coinAmount
    }

    const getSwapCFNAmountFunc = async (input) => {
        const CFNAmount = await CFNSwapInstance.getSwapCFNAmount(input);
        return CFNAmount
    }

    const swapExactGMMTForExactTokensFunc = async (
        amount,
        address
    ) => {
        const receipt = await CFNSwapInstance.swapExactGMMTForExactTokens({ value: amount, from: address });
        const event = receipt.logs.find((log) => log.event === "SwapExactGMMTForExactTokens");

        return event.args;
    }

    const withdrawTokenAll = async () => {
        await CFNSwapInstance.withdrawTokenAll({ from: deployer });
    }

    describe("#### Setting Test ####", () => {
        it("------------- access control 컨트랙트 교체 -------------", async () => {
            const accessContract = await CFNSwapInstance.accessControl();

            assert.equal(accessContract, cfnAccessControlInstance.address);

            const newAccessContract = await CFNAccessControl.new({
                from: deployer,
            });
            await CFNSwapInstance.setAccessControl(newAccessContract.address, {
                from: deployer,
            });
            const chageAccessContract = await CFNSwapInstance.accessControl();

            assert.equal(chageAccessContract, newAccessContract.address);
            assert.notEqual(newAccessContract.address, accessContract);
        });

        it("------------- access control 컨트랙트 교체했을 경우 권한 에러 -------------", async () => {
            const receiveWalletAddress = await CFNSwapInstance.receiveWallet();

            assert.notEqual(receiveWallet.address, receiveWalletAddress);

            await CFNSwapInstance.setReceiveWallet(user, {
                from: deployer,
            });

            const changeReceivedWalletAddress =
                await CFNSwapInstance.receiveWallet();

            assert.equal(user, changeReceivedWalletAddress);

            const newAccessContract = await CFNAccessControl.new({
                from: user2,
            });
            await CFNSwapInstance.setAccessControl(newAccessContract.address, {
                from: deployer,
            });

            await expectRevert(
                CFNSwapInstance.setReceiveWallet(user2, {
                    from: deployer,
                }),
                "Unverified owner address."
            );

            await CFNSwapInstance.setReceiveWallet(user2, {
                from: user2,
            });

            const change2ReceivedWalletAddress =
                await CFNSwapInstance.receiveWallet();

            assert.equal(user2, change2ReceivedWalletAddress);
        });

        it("------------- swap test -------------", async () => {
            // await setRateFunc("1");
            const CFNInputAmount = "1";
            const CFNInputAmountTowei = web3.utils.toWei(CFNInputAmount);
            const coinAmount = await getSwapCoinAmountFunc(CFNInputAmount);
            const estimatedReceiveCFN = await getSwapCFNAmountFunc(coinAmount);
            const result = await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user);
            const receiveCFN = result._cfnAmount.toString();
            await getCFNBalance(CFNSwapInstance.address);
            const userBalanceOf = await getCFNBalance(user)

            assert.equal(CFNInputAmountTowei, receiveCFN, "other CFN balance")
            assert.equal(estimatedReceiveCFN, receiveCFN, "other CFN balance")
            assert.equal(userBalanceOf.toString(), receiveCFN, "other CFN balance")
        })

        /* 100 coin 마다하면 실행 불가능 하므로 1로 설정 */

        it("------------- [Error Check] event maxCFNAmount 10으로 설정 1씩 10번 수행 후 그 이상 넘는지 test -------------", async () => {
            // await setRateFunc("1");
            // const count = 10
            const count = 10
            await setMaxCFNSwapAmountFunc(`${count}`)

            const CFNInputAmount = "1";
            const coinAmount = await getSwapCoinAmountFunc(CFNInputAmount);
            const estimatedReceiveCFN = await getSwapCFNAmountFunc(coinAmount);
            console.log(web3.utils.fromWei(coinAmount.toString()), web3.utils.fromWei(estimatedReceiveCFN.toString()))

            for (let i = 0; i < 5; i++) {
                await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user);
                await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user2);
            }
            const totalEstimatedReceivedCFN = new BN(`${estimatedReceiveCFN}`).mul(new BN(`${count / 2}`)).toString();
            const totalEstimatedReceivedCFN2 = new BN(`${estimatedReceiveCFN}`).mul(new BN(`${count / 2}`)).toString();
            const userBalanceOf = await getCFNBalance(user)
            const userBalanceOf2 = await getCFNBalance(user2)

            assert.equal(userBalanceOf.toString(), totalEstimatedReceivedCFN, "other CFN balance")
            assert.equal(userBalanceOf2.toString(), totalEstimatedReceivedCFN2, "other CFN balance")
            await expectRevert(
                CFNSwapInstance.swapExactGMMTForExactTokens({ value: web3.utils.toWei("100"), from: user }),
                "Do not sell"
            );
        })

        it("------------- [Error Check] event maxCFNAmount 10으로 설정 1씩 9번 수행 후 2이상 수행하면 그 이상 넘는지 test -------------", async () => {
            // await setRateFunc("1");
            const count = 10
            await setMaxCFNSwapAmountFunc(`${count}`)

            const CFNInputAmount = "1";
            const coinAmount = await getSwapCoinAmountFunc(CFNInputAmount);
            const estimatedReceiveCFN = await getSwapCFNAmountFunc(coinAmount);

            for (let i = 0; i < 4; i++) {
                await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user);
                await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user2);
            }
            await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user2);

            const totalEstimatedReceivedCFN = new BN(`${estimatedReceiveCFN}`).mul(new BN(`${4}`)).toString();
            const totalEstimatedReceivedCFN2 = new BN(`${estimatedReceiveCFN}`).mul(new BN(`${5}`)).toString();
            const userBalanceOf = await getCFNBalance(user)
            const userBalanceOf2 = await getCFNBalance(user2)

            assert.equal(userBalanceOf.toString(), totalEstimatedReceivedCFN, "other CFN balance")
            assert.equal(userBalanceOf2.toString(), totalEstimatedReceivedCFN2, "other CFN balance")

            const CFNInputAmount2 = "2";
            const coinAmount2 = await getSwapCoinAmountFunc(CFNInputAmount2);

            await expectRevert(
                CFNSwapInstance.swapExactGMMTForExactTokens({ value: web3.utils.toWei("200"), from: user2 }),
                "Total amount paid has been exceeded."
            );
        })

        it("------------- [Error Check] 이벤트 기간이 아닌 경우 test -------------", async () => {
            // await setRateFunc("1");
            await CFNSwapInstance.setIsSale(false)

            await expectRevert(
                CFNSwapInstance.swapExactGMMTForExactTokens({ value: web3.utils.toWei("100"), from: user2 }),
                "Do not sell."
            );
        })

        it("------------- [Error Check] GMMT가 소수점 및 비율 단위가 아닌 경우 test -------------", async () => {
            // await setRateFunc("1");

            await expectRevert(
                CFNSwapInstance.swapExactGMMTForExactTokens({ value: web3.utils.toWei("100.1"), from: user2 }),
                "The existence of a decimal point."
            );

            // await setRateFunc("10");

            await expectRevert(
                CFNSwapInstance.swapExactGMMTForExactTokens({ value: web3.utils.toWei("110"), from: user2 }),
                "The existence of a decimal point."
            );

            await expectRevert(
                CFNSwapInstance.swapExactGMMTForExactTokens({ value: web3.utils.toWei("9"), from: user2 }),
                "It must be greater than the rate."
            );

        })

        it("------------- [Error Check] contract가 보유한 cfn보다 높은 금액을 인출할 경우 test -------------", async () => {
            // await setRateFunc("10");

            await withdrawTokenAll();

            await expectRevert(
                CFNSwapInstance.swapExactGMMTForExactTokens({ value: web3.utils.toWei("100"), from: user2 }),
                "Not enough CFN balance."
            );
        });
        
        const isBuyOne = false;
        // const isBuyOne = false;
        it(`------------- ${isBuyOne ? "한번에" : "2번 나눠서"} 구매 test -------------`, async () => {
            
            if(isBuyOne){
                const CFNInputAmount = "1000000";
                const coinAmount = await getSwapCoinAmountFunc(CFNInputAmount);
                const result = await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user3);
                console.log(user3, web3.utils.fromWei(result._cfnAmount.toString()), web3.utils.fromWei(result._gmmtAmount.toString()))
                assert.equal(result._cfnAmount.toString(), web3.utils.toWei(CFNInputAmount), "other amount")
            }else{
                const CFNInputAmount = "500000";
                const coinAmount = await getSwapCoinAmountFunc(CFNInputAmount);
                const result = await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user3);
                console.log(user3, web3.utils.fromWei(result._cfnAmount.toString()), web3.utils.fromWei(result._gmmtAmount.toString()))
                assert.equal(result._cfnAmount.toString(), web3.utils.toWei(CFNInputAmount), "other amount")
                const result2 = await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user3);
                console.log(user3, web3.utils.fromWei(result2._cfnAmount.toString()), web3.utils.fromWei(result2._gmmtAmount.toString()))
                assert.equal(result2._cfnAmount.toString(), web3.utils.toWei(CFNInputAmount), "other amount")
            }

            await expectRevert(
                CFNSwapInstance.swapExactGMMTForExactTokens({ value: web3.utils.toWei("200"), from: user3 }),
                'Do not sell.'
            )

        });


        it("------------- coin 출금 test -------------", async () => {
            // await setRateFunc("10");
            const count = 4;
            const CFNInputAmount = "1";
            const coinAmount = await getSwapCoinAmountFunc(CFNInputAmount);

            for (let i = 0; i < count; i++) {
                await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user);
                await swapExactGMMTForExactTokensFunc(coinAmount.toString(), user2);
            }

            const totalSwapCoinAmount = new BN(`${coinAmount.toString()}`).mul(new BN(`${4}`)).toString();
            const totalSwapCoinAmount2 = new BN(`${coinAmount.toString()}`).mul(new BN(`${4}`)).toString();
            const estimatedTotalSwapCoinAmount = new BN(`${totalSwapCoinAmount}`).add(new BN(`${totalSwapCoinAmount2}`)).toString();
            const balance = await web3.eth.getBalance(CFNSwapInstance.address);
            assert.equal(
                estimatedTotalSwapCoinAmount,
                balance.toString(),
                "same"
            )

            await expectRevert(
                CFNSwapInstance.withdrawCoinAll({ from: user2 }),
                "Unverified owner address"
            );

            const receipt = await CFNSwapInstance.withdrawCoinAll({ from: deployer });
            const event = receipt.logs.find((log) => log.event === "WithdrawCoin");

            console.log(event.args.amount.toString())
        });
    });
});