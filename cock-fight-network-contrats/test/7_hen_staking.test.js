const Hen = artifacts.require("Hen");
const CFNAccessControl = artifacts.require("CFNAccessControl");
const Cfn = artifacts.require("CFN");
const HenStaking = artifacts.require("HenStaking");

const {
    expectRevert,
    time,
    BN,
    expectEvent,
} = require("@openzeppelin/test-helpers");
const { assert } = require("chai");

contract("HenStaking",
    (accounts) => {
        const [deployer, receiveWallet, user, user2, other] = accounts;
        let tokenInstance;
        let cfnAccessControlInstance;
        let henInstance;
        let henStakingInstance;

        beforeEach(async () => {
            tokenInstance = await Cfn.new({ from: deployer });
            cfnAccessControlInstance = await CFNAccessControl.new({ from: deployer });
            henInstance = await Hen.new(cfnAccessControlInstance.address, {
                from: deployer,
            });

            henStakingInstance = await HenStaking.new(
                cfnAccessControlInstance.address,
                tokenInstance.address,
                henInstance.address,
                receiveWallet,
                {
                    from: deployer,
                }
            )

            await cfnAccessControlInstance.addWhiteListControl(
                henStakingInstance.address,
                {
                    from: deployer,
                }
            );
        });

        const henMintFunc = async (address) => {
            console.log("***********hen mint 작동***********")
            const receipt = await henInstance.mint(address, { from: deployer });
            const log = receipt.logs.find((log) => log.event === "HenMint");
            const tokenId = log.args._tokenId.toString();

            return tokenId;
        }

        const henSetApprovalForAllFunc = async (address) => {
            console.log("***********hen setApprovalForAll 작동***********")
            await henInstance.setApprovalForAll(henStakingInstance.address, true, { from: address });
        }

        const getStakingInfoFunc = async (tokenId) => {
            let getStakingInfo = await henStakingInstance.getStakingInfo(tokenId);
            console.log("startTimestamp : ", getStakingInfo.startTimestamp.toString());
            console.log("receiveReward : ", getStakingInfo.receiveReward.toString(), `(${await fromWei(getStakingInfo.receiveReward.toString())})`);
            console.log("accRewardAmount : ", getStakingInfo.accRewardAmount.toString(), `(${await fromWei(getStakingInfo.accRewardAmount.toString())})`);
        }

        const henStakingFunc = async (tokenId, address) => {
            console.log(`*********** ${tokenId} tokenId staking 작동***********`)
            try {
                const receipt = await henStakingInstance.henStaking(tokenId, { from: address });
                await cfnBalanceOf(address);
                await getStakingInfoFunc(tokenId);
                const log = receipt.logs.find((log) => log.event === "StakingHenReceipt");
                return log.args._tokenId.toString()
            } catch (error) {
                console.error("staking error : ", error.reason);
            }
        }

        const henWithDrawFunc = async (tokenId, address) => {
            console.log(`*********** ${tokenId} tokenId withdraw 작동***********`)
            try {
                await henStakingInstance.henWithdraw(tokenId, { from: address });
                await cfnBalanceOf(address);
                await getStakingInfoFunc(tokenId);
                await checkHenDead(tokenId);
            } catch (error) {
                console.error("withdraw error : ", error.reason)
            }
        }

        const fromWei = async (amount) => {
            return await web3.utils.fromWei(amount, "ether");
        }

        const whatAddress = (address) => {
            switch (address.toLowerCase()) {
                case cfnAccessControlInstance.address.toLowerCase():
                    return "cfnAccessControlInstance";
                case tokenInstance.address.toLowerCase():
                    return "tokenInstance";
                case henStakingInstance.address.toLowerCase():
                    return "henStakingInstance";
                case deployer.toLowerCase():
                    return "deployer";
                case user.toLowerCase():
                    return "user";
                case user2.toLowerCase():
                    return "user2";
                case receiveWallet.toLowerCase():
                    return "receiveWallet";
            }
        }

        const cfnBalanceOf = async (address) => {
            const balanceOf = await tokenInstance.balanceOf(address);
            console.log(`현재 ${address}(${whatAddress(address)})의 cfn balance = `, balanceOf.toString(), `(${await fromWei(balanceOf.toString())})`);
        }

        const increaseDays = async (days) => {
            await time.increase(time.duration.days(days));
            console.log(`\n****** ${days}일 후 ******\n`);
        }

        const checkHenDead = async (tokenId) => {
            const henInfo = await henInstance.info(tokenId);

            if (henInfo.isDead) {
                console.log(`tokenId ${tokenId} hen dead`)
            } else {
                console.log(`tokenId ${tokenId} hen live`)
            }
        }

        const setStakingActiveFunc = async (bool) => {
            await henStakingInstance.setStakingActive(bool, { from: deployer });
            const isActive = await henStakingInstance.stakingActive();
            console.log(`staking ${isActive ? "active" : "inactive"}`)
        }

        const accWithdrawAmountFunc = async () => {
            let accWithdrawAmount = await henStakingInstance.accWithdrawAmount();
            accWithdrawAmount = accWithdrawAmount.toString()
            console.log("accWithdrawAmount : ", accWithdrawAmount, `(${await fromWei(accWithdrawAmount)})`)
        }

        const henWithdrawManagerFunc = async (tokenId, address) => {
            console.log(`*********** ${tokenId} tokenId henWithdrawManager 작동***********`)
            try {
                await henStakingInstance.henWithdrawManager(tokenId, { from: address });
            } catch (error) {
                console.error("henWithdrawManager error : ", error.reason);
            }
        }

        const withdrawTokenAllFunc = async (address) => {
            console.log("***********withdrawTokenAll 작동***********")
            try {
                await henStakingInstance.withdrawTokenAll({ from: address });
                await cfnBalanceOf(henStakingInstance.address);
                await cfnBalanceOf(receiveWallet);
            } catch (error) {
                console.error("withdrawTokenAll error : ", error.reason);
            }
        }
        const withdrawTokenFunc = async (amount, address) => {
            console.log("***********withdrawToken 작동***********")
            try {
                await henStakingInstance.withdrawToken(web3.utils.toWei(amount, "ether"), { from: address });
                await cfnBalanceOf(henStakingInstance.address);
                await cfnBalanceOf(receiveWallet);
            } catch (error) {
                console.error("withdrawToken error : ", error.reason);
            }
        }

        describe("########## HenStaking 테스트 ##########", () => {

            it("1. henStaking 시 henContract NFT, henStaking NFT 번호가 같은지 확인", async() => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });

                const henTokenId = await henMintFunc(user);
                const henTokenId2 = await henMintFunc(user);
                const henTokenId3 = await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                const henReceiptTokenId3 = await henStakingFunc(henTokenId3, user);

                assert.equal(henTokenId3, henReceiptTokenId3, `${henTokenId3} != ${henReceiptTokenId3}`);
            });

            it("2. n일 후 reward가 예상치와 같은지 확인", async() => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });

                const henTokenId = await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                const henReceiptTokenId = await henStakingFunc(henTokenId, user);
                
                const n = 5;
                await increaseDays(n);

                const rewardPerStakingAllowed = await henStakingInstance.rewardPerStakingAllowed();
                const estimatedReward = new BN(rewardPerStakingAllowed.toString()).mul(new BN(`${n}`)).toString();
                const reward = await henStakingInstance.reward(henTokenId);

                assert.equal(estimatedReward, reward.toString(),`${estimatedReward} != ${reward.toString()}`);
            });

            it("3. n일 후 예상치 리워드와 받는 리워드가 같은지 확인", async() => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });

                const henTokenId = await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                const henReceiptTokenId = await henStakingFunc(henTokenId, user);
                
                const n = 5;
                await increaseDays(n);

                const rewardPerStakingAllowed = await henStakingInstance.rewardPerStakingAllowed();
                const estimatedReward = new BN(rewardPerStakingAllowed.toString()).mul(new BN(`${n}`)).toString();
                const reward = await henStakingInstance.reward(henTokenId);
                await henWithDrawFunc(henReceiptTokenId, user);
                const userCFNAmount = await tokenInstance.balanceOf(user);

                assert.equal(estimatedReward, reward.toString());
                assert.equal(estimatedReward, userCFNAmount.toString());
                assert.equal(reward.toString(), userCFNAmount.toString());
            });

            it("4. 365일 후 닭이 죽었는지 확인", async() => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });

                const henTokenId = await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                const henReceiptTokenId = await henStakingFunc(henTokenId, user);
                
                const n = 365;
                await increaseDays(n);
                
                await henWithDrawFunc(henReceiptTokenId, user);

                const henInfo = await henInstance.info(henTokenId);
                const henTokenURI = await henInstance.tokenURI(henTokenId);
                const henStakingTokenURI = await henStakingInstance.tokenURI(henTokenId);

                assert.equal(henInfo.isDead, true);
                console.log(henTokenURI)
                console.log(henStakingTokenURI)
            });

            it("5. withdraw 후 다시 staking 가능한지 확인", async() => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });

                const henTokenId = await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                let henReceiptTokenId = await henStakingFunc(henTokenId, user);
                
                let n = 50;
                await increaseDays(n);
                
                await getStakingInfoFunc(henReceiptTokenId)
                await henWithDrawFunc(henReceiptTokenId, user);

                henReceiptTokenId = await henStakingFunc(henTokenId, user);

                await increaseDays(n);

                await henWithDrawFunc(henReceiptTokenId, user);
                henReceiptTokenId = await henStakingFunc(henTokenId, user);

                n = 465 - 100;
                await increaseDays(n);
                await getStakingInfoFunc(henReceiptTokenId)

                await henWithDrawFunc(henReceiptTokenId, user);
                henReceiptTokenId = await henStakingFunc(henTokenId, user);
            });

            it("6. staking 후 암탉을 죽이고 나서 withdraw 가능한지 확인", async() => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });

                const henTokenId = await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                let henReceiptTokenId = await henStakingFunc(henTokenId, user);
                
                let n = 50;
                await increaseDays(n);
                
                await getStakingInfoFunc(henReceiptTokenId);
                await henInstance.updateIsDead(henTokenId, true);
                await henWithDrawFunc(henReceiptTokenId, user);
            });

            it("6. 1.5일 후 withdraw 1.5일 후 withdraw", async() => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });

                const henTokenId = await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                let henReceiptTokenId = await henStakingFunc(henTokenId, user);
                let currentTime = await time.latest();
                let n = 1.9;
                await time.increase(time.duration.hours(46));

                let currentTime2 = await time.latest();
                console.log(currentTime.toString())
                await getStakingInfoFunc(henReceiptTokenId);
                n = 1.2;
                await time.increase(time.duration.hours(26));
                let currentTime3 = await time.latest();

                let sub1 = new BN(`${currentTime2.toString()}`).sub(new BN(`${currentTime.toString()}`));
                let sub2 = new BN(`${currentTime3.toString()}`).sub(new BN(`${currentTime2.toString()}`));


                await getStakingInfoFunc(henReceiptTokenId);
                await henWithDrawFunc(henReceiptTokenId, user);
                henReceiptTokenId = await henStakingFunc(henTokenId, user);
                await getStakingInfoFunc(henReceiptTokenId);
                await henWithDrawFunc(henReceiptTokenId, user);
            });

            it("********************* henStaking henStaking && 365일 이후 henWithdraw 테스트 *********************", async () => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });

                const henTokenId = await henMintFunc(user);

                await henSetApprovalForAllFunc(user);

                const henReceiptTokenId = await henStakingFunc(henTokenId, user);

                assert.equal(henTokenId, henReceiptTokenId);

                let i = 365;
                await increaseDays(i);

                await getStakingInfoFunc(henReceiptTokenId);
                await henWithDrawFunc(henReceiptTokenId, user);
                await accWithdrawAmountFunc();
            });

            it("********************* henStaking staking && i일 이후 withdraw  테스트 *********************", async () => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });
                console.log("");
                await cfnBalanceOf(henStakingInstance.address);

                const tokenId = new BN(1);
                await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                await henStakingFunc(tokenId, user);

                let i = 50;
                await increaseDays(i);

                await cfnBalanceOf(user);
                await getStakingInfoFunc(tokenId);

                await henWithDrawFunc(tokenId, user);
                await accWithdrawAmountFunc();
                await henStakingFunc(tokenId, user);
                console.log("");
            });

            it("********************* henStaking stakingActive가 false 일때 henStaking이 작동이 되는지 *********************", async () => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });
                console.log("");
                await cfnBalanceOf(henStakingInstance.address);

                const tokenId = new BN(1);
                await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                await setStakingActiveFunc(false)
                await henStakingFunc(tokenId, user);
            });

            it("********************* henStaking staking 후 stakingActive가 false 일때 i일 뒤 henWithdraw가 작동이 되는지 *********************", async () => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });
                console.log("");
                await cfnBalanceOf(henStakingInstance.address);

                const tokenId = new BN(1);
                await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                await henStakingFunc(tokenId, user);
                await setStakingActiveFunc(false)
                let i = 50;
                await increaseDays(i);

                await cfnBalanceOf(user);
                await getStakingInfoFunc(tokenId);

                await henWithDrawFunc(tokenId, user);
                await accWithdrawAmountFunc();
                await henStakingFunc(tokenId, user);
            });

            it("********************* henStaking 다른 사람의 스테이킹을 뺄 수 있는지 *********************", async () => {

                console.log("user ==> ", user)
                console.log("user2 ==> ", user2)
                const tokenId = new BN(1);
                await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                await henStakingFunc(tokenId, user);

                const tokenId2 = new BN(2);
                await henMintFunc(user2);
                await henSetApprovalForAllFunc(user2);
                await henStakingFunc(tokenId2, user2);

                let i = 365;
                await increaseDays(i);

                await henWithDrawFunc(tokenId2, user);
                await henWithDrawFunc(tokenId, user2);
            });

            it("********************* henStaking 최대 staking 암탉 수를 넘는지 확인 / 50일 이후 withdraw 후 누적된 withdraw cfn 양 보기 *********************", async () => {
                await henStakingInstance.setMaxHenStakingAmount("10", { from: deployer });
                let maxHenStakingAmount = await henStakingInstance.maxHenStakingAmount();
                maxHenStakingAmount = Number.parseInt(maxHenStakingAmount)
                console.log("maxHenStakingAmount : ", maxHenStakingAmount);
                await henSetApprovalForAllFunc(user);
                for (let i = 1; i <= maxHenStakingAmount + 1; i++) {
                    await henMintFunc(user);
                    await henStakingFunc(i.toString(), user);
                }

                let totalHenStakingAmount = await henStakingInstance.totalHenStakingAmount();
                console.log("totalHenStakingAmount : ", totalHenStakingAmount.toString())


                let henBalance = await henInstance.balanceOf(user);
                henBalance = Number.parseInt(henBalance)
                console.log("henBalance : ", henBalance);

                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });
                console.log("");
                await cfnBalanceOf(henStakingInstance.address);
                let i = 365;
                await increaseDays(i);
                for (let i = 1; i <= maxHenStakingAmount; i++) {
                    await henWithDrawFunc(i, user)
                }
                await accWithdrawAmountFunc();
                await cfnBalanceOf(henStakingInstance.address);
                await cfnBalanceOf(user);
            });

            it("********************* henStaking staking 되어있는 암탉 강제로 withdraw 기능 (whiteListControl, otherAddress) *********************", async () => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });
                const tokenId = new BN("1");
                await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                await henStakingFunc(tokenId, user);

                let i = 50;
                await increaseDays(i);
                await getStakingInfoFunc(tokenId);

                // whiteListControl
                await henWithdrawManagerFunc(tokenId, deployer);
                await cfnBalanceOf(user)
                await getStakingInfoFunc(tokenId);

                await henStakingFunc(tokenId, user);
                await increaseDays(i);
                await getStakingInfoFunc(tokenId);
                // otherAddress
                await henWithdrawManagerFunc(tokenId, user);
                await henWithdrawManagerFunc(tokenId, user2);
            });

            it("********************* henStaking ===> henstaking contract에 cfn이 부족할 경우 *********************", async () => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("1820", "ether"), {
                    from: deployer,
                });
                const tokenId = new BN("1");
                await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                await henStakingFunc(tokenId, user);

                let i = 365;
                await increaseDays(i);
                await getStakingInfoFunc(tokenId);
                await henWithDrawFunc(tokenId, user);
                await getStakingInfoFunc(tokenId);
            });

            it("********************* henStaking cfn 토큰 인출 / coin 인출 *********************", async () => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });

                await cfnBalanceOf(henStakingInstance.address);
                await withdrawTokenFunc("5", deployer);
                await withdrawTokenFunc("5", user);
                await withdrawTokenAllFunc(user);
                await withdrawTokenAllFunc(deployer);
            });

            it("********************* henStaking CFN Hen Receipt tokenURI *********************", async () => {
                await tokenInstance.transfer(henStakingInstance.address, web3.utils.toWei("182500", "ether"), {
                    from: deployer,
                });

                const tokenId = new BN(1);
                await henMintFunc(user);
                await henSetApprovalForAllFunc(user);
                await henStakingFunc(tokenId, user);

                let tokenURI = await henStakingInstance.tokenURI(tokenId);
                console.log("tokenURI : ", tokenURI);

                let i = 365;
                await increaseDays(i);
                await getStakingInfoFunc(tokenId);
                await henWithDrawFunc(tokenId, user);


                tokenURI = await henStakingInstance.tokenURI(tokenId);
                console.log("tokenURI : ", tokenURI);
            });
        
        });
    
    }
);