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

contract("Hen Staking Test", (accounts) => {
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
    );

    await cfnAccessControlInstance.addWhiteListControl(
      henStakingInstance.address,
      {
        from: deployer,
      }
    );

    await tokenInstance.transfer(
      henStakingInstance.address,
      web3.utils.toWei("182500", "ether"),
      {
        from: deployer,
      }
    );
  });

  const henMintOperator = async (address) => {
    const receipt = await henInstance.mint(address, { from: deployer });

    const event = receipt.logs.find((log) => log.event === "HenMint");

    return event.args._tokenId.toString();
  };

  const henApproveForAllOperator = async (address) => {
    await henInstance.setApprovalForAll(henStakingInstance.address, true, {
      from: address,
    });
  };

  const henStakingOperator = async (tokenId, address) => {
    const receipt = await henStakingInstance.henStaking(tokenId, {
      from: address,
    });

    const event = receipt.logs.find((log) => log.event === "MintHenReceipt");

    return event.args._tokenId.toString();
  };

  const henWithdrawOperator = async (tokenId, address) => {
    await henStakingInstance.henWithdraw(tokenId, { from: address });
  };

  const henStakingSetting = async (address) => {
    const tokenId = await henMintOperator(address);

    await henApproveForAllOperator(address);

    const receivedTokenId = await henStakingOperator(tokenId, address);

    assert.equal(tokenId, receivedTokenId);

    return { tokenId, receivedTokenId };
  };

  describe("#### Setting Test ####", () => {
    it("------------- access control 컨트랙트 교체 -------------", async () => {
      const accessContract = await henStakingInstance.accessControl();

      assert.equal(accessContract, cfnAccessControlInstance.address);

      const newAccessContract = await CFNAccessControl.new({
        from: deployer,
      });
      await henStakingInstance.setAccessControl(newAccessContract.address, {
        from: deployer,
      });
      const chageAccessContract = await henStakingInstance.accessControl();

      assert.equal(chageAccessContract, newAccessContract.address);
      assert.notEqual(newAccessContract.address, accessContract);
    });

    it("------------- access control 컨트랙트 교체했을 경우 권한 에러 -------------", async () => {
      const receiveWalletAddress = await henStakingInstance.receiveWallet();

      assert.notEqual(receiveWallet.address, receiveWalletAddress);

      await henStakingInstance.setReceiveWallet(user, {
        from: deployer,
      });

      const changeReceivedWalletAddress =
        await henStakingInstance.receiveWallet();

      assert.equal(user, changeReceivedWalletAddress);

      const newAccessContract = await CFNAccessControl.new({
        from: user2,
      });
      await henStakingInstance.setAccessControl(newAccessContract.address, {
        from: deployer,
      });

      await expectRevert(
        henStakingInstance.setReceiveWallet(user2, {
          from: deployer,
        }),
        "Unverified owner address."
      );

      await henStakingInstance.setReceiveWallet(user2, {
        from: user2,
      });

      const change2ReceivedWalletAddress =
        await henStakingInstance.receiveWallet();

      assert.equal(user2, change2ReceivedWalletAddress);
    });

    it("------------- hen mint function test -------------", async () => {
      const tokenId = await henMintOperator(user);

      const owner = await henInstance.ownerOf(tokenId);

      assert.equal(owner, user);
    });

    it("------------- hen staking 잘되는지? -------------", async () => {
      const tokenId = await henMintOperator(user);

      await henApproveForAllOperator(user);

      const receivedTokenId = await henStakingOperator(tokenId, user);

      const henOwner = await henInstance.ownerOf(tokenId);

      assert.notEqual(user, henOwner);
      assert.equal(henStakingInstance.address, henOwner);

      const receivedStakingOwner =
        await henStakingInstance.ownerOf(receivedTokenId);

      assert.equal(receivedStakingOwner, user);
    });

    it("------------- hen staking 후 withdraw 잘되는지? -------------", async () => {
      const tokenId = await henMintOperator(user);

      await henApproveForAllOperator(user);

      const receivedTokenId = await henStakingOperator(tokenId, user);

      assert.equal(tokenId, receivedTokenId);

      const henOwner = await henInstance.ownerOf(tokenId);

      assert.notEqual(user, henOwner);
      assert.equal(henStakingInstance.address, henOwner);

      const receivedStakingOwner =
        await henStakingInstance.ownerOf(receivedTokenId);

      assert.equal(receivedStakingOwner, user);

      await henWithdrawOperator(tokenId, user);

      const isReturnHenTokenOwner = await henInstance.ownerOf(tokenId);
      assert.equal(isReturnHenTokenOwner, user);

      const isReturnStakingHenOwner =
        await henStakingInstance.ownerOf(receivedTokenId);
      assert.equal(henStakingInstance.address, isReturnStakingHenOwner);
    });

    it("------------- hen staking 후 365일 후 withdraw 및 리워드 입금 잘되는지 / 암탉이 잘 죽는지? -------------", async () => {
      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      const tokenId = await henMintOperator(user);

      await henApproveForAllOperator(user);

      const receivedTokenId = await henStakingOperator(tokenId, user);

      assert.equal(tokenId, receivedTokenId);

      await time.increase(time.duration.days(365));

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      assert.equal(web3.utils.toWei("1825", "ether"), afterBalance.toString());

      const henInfo = await henInstance.info(tokenId);

      assert.equal(henInfo.isDead, true);
      assert.equal(henInfo.maxDay.toString(), "31536000");
    });

    it("------------- hen staking 비활성화시 스테이킹 에러나는지? -------------", async () => {
      const beforeActive = await henStakingInstance.stakingActive();

      assert.equal(beforeActive, true);

      await henStakingInstance.setStakingActive(false, {
        from: deployer,
      });

      const isActive = await henStakingInstance.stakingActive();

      assert.equal(isActive, false);

      const tokenId = await henMintOperator(user);

      await henApproveForAllOperator(user);

      await expectRevert(
        henStakingOperator(tokenId, user),
        "Hen staking is not available."
      );
    });

    it("------------- hen staking 시 받는 NFT 전송 안되는지? -------------", async () => {
      const tokenId = await henMintOperator(user);

      await henApproveForAllOperator(user);

      const receivedTokenId = await henStakingOperator(tokenId, user);

      assert.equal(tokenId, receivedTokenId);

      await expectRevert(
        henStakingInstance.safeTransferFrom(user, user2, receivedTokenId, {
          from: user,
        }),
        "Transfer to contract not allowed."
      );

      const receivedStakingOwner =
        await henStakingInstance.ownerOf(receivedTokenId);

      assert.equal(receivedStakingOwner, user);
    });

    it("------------- hen staking 1일 후 받는 양 맞는지? -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(1));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      assert.equal(dailyReward.toString(), afterBalance.toString());
    });
    it("------------- hen staking 1.5일 후 받는 양 맞는지? -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(1.5));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      assert.equal(dailyReward.toString(), afterBalance.toString());
    });
    it("------------- hen staking 1일 후 1일 지나서 받는 양 맞는지? -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(1));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await time.increase(time.duration.days(1));

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      const dailyRewardBN = new web3.utils.BN(dailyReward.toString());

      const expectedBalance = dailyRewardBN
        .mul(new web3.utils.BN("2"))
        .toString();

      assert.equal(expectedBalance.toString(), afterBalance.toString());
    });
    it("------------- hen staking 1.5일 후 0.3일 지나서 받는 양 맞는지? -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(1.5));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await time.increase(time.duration.days(0.3));

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      assert.equal(dailyReward.toString(), afterBalance.toString());
    });
    it("------------- hen staking 1.5일 후 1.1일 지나서 받는 양 맞는지? -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(1.5));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await time.increase(time.duration.days(1.1));

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      const dailyRewardBN = new web3.utils.BN(dailyReward.toString());

      const expectedBalance = dailyRewardBN
        .mul(new web3.utils.BN("2"))
        .toString();

      assert.equal(expectedBalance.toString(), afterBalance.toString());
    });

    it("------------- hen staking 1일 후 1일 지나서 받는 양 맞는지? -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(1));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await time.increase(time.duration.days(1));

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      const dailyRewardBN = new web3.utils.BN(dailyReward.toString());

      const expectedBalance = dailyRewardBN
        .mul(new web3.utils.BN("2"))
        .toString();

      assert.equal(expectedBalance.toString(), afterBalance.toString());
    });

    it("------------- hen staking 10일 후 받는 양 맞는지? -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(10));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      const dailyRewardBN = new web3.utils.BN(dailyReward.toString());

      const expectedBalance = dailyRewardBN
        .mul(new web3.utils.BN("10"))
        .toString();

      assert.equal(expectedBalance.toString(), afterBalance.toString());
    });

    it("------------- hen staking 10일 후 언스테이킹 후 다시 스테이킹 후 355일 지나서 받는 양 맞는지? -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(10));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      const dailyRewardBN = new web3.utils.BN(dailyReward.toString());

      const expectedBalance = dailyRewardBN
        .mul(new web3.utils.BN("10"))
        .toString();

      assert.equal(expectedBalance.toString(), afterBalance.toString());

      await henStakingInstance.henStaking(tokenId, {
        from: user,
      });

      await time.increase(time.duration.days(356));

      await henWithdrawOperator(tokenId, user);

      const finalBalance = await tokenInstance.balanceOf(user);

      const expectedFinalBalance = dailyRewardBN
        .mul(new web3.utils.BN("365"))
        .toString();

      assert.equal(expectedFinalBalance.toString(), finalBalance.toString());
    });

    it("------------- hen staking 10개가 최대일시 10개 이상 시 안들어가는지? -------------", async () => {
      await henStakingInstance.setMaxHenStakingAmount("10", {
        from: deployer,
      });

      for (let i = 0; i < 10; i++) {
        await henStakingSetting(user);
      }

      const tokenId = await henMintOperator(user2);

      await henApproveForAllOperator(user2);

      await expectRevert(
        henStakingInstance.henStaking(tokenId, {
          from: user2,
        }),
        "Staking the maximum hen."
      );
    });

    it("------------- hen staking A가 10일 하고 나머지 B가 2일 할 경우 잔액 여부 -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(10));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      const dailyRewardBN = new web3.utils.BN(dailyReward.toString());

      const expectedBalance = dailyRewardBN
        .mul(new web3.utils.BN("10"))
        .toString();

      assert.equal(expectedBalance.toString(), afterBalance.toString());

      await henInstance.transferFrom(user, user2, tokenId, {
        from: user,
      });

      const owner = await henInstance.ownerOf(tokenId);

      assert.equal(owner, user2);

      await henApproveForAllOperator(user2);

      await henStakingInstance.henStaking(tokenId, {
        from: user2,
      });

      await time.increase(time.duration.days(2));

      await henWithdrawOperator(tokenId, user2);

      const aBalance = await tokenInstance.balanceOf(user);
      assert.equal(
        dailyRewardBN.mul(new web3.utils.BN("10")).toString(),
        aBalance.toString()
      );

      const bBalance = await tokenInstance.balanceOf(user2);
      assert.equal(
        dailyRewardBN.mul(new web3.utils.BN("2")).toString(),
        bBalance.toString()
      );
    });
    it("------------- hen staking A가 10일 하고 나머지 B가 마저 355일 할 경우 잔액 여부 -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(10));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      const dailyRewardBN = new web3.utils.BN(dailyReward.toString());

      const expectedBalance = dailyRewardBN
        .mul(new web3.utils.BN("10"))
        .toString();

      assert.equal(expectedBalance.toString(), afterBalance.toString());

      await henInstance.transferFrom(user, user2, tokenId, {
        from: user,
      });

      const owner = await henInstance.ownerOf(tokenId);

      assert.equal(owner, user2);

      await henApproveForAllOperator(user2);

      await henStakingInstance.henStaking(tokenId, {
        from: user2,
      });

      await time.increase(time.duration.days(355));

      await henWithdrawOperator(tokenId, user2);

      const aBalance = await tokenInstance.balanceOf(user);
      assert.equal(
        dailyRewardBN.mul(new web3.utils.BN("10")).toString(),
        aBalance.toString()
      );

      const bBalance = await tokenInstance.balanceOf(user2);
      assert.equal(
        dailyRewardBN.mul(new web3.utils.BN("355")).toString(),
        bBalance.toString()
      );

      const henInfo = await henInstance.info(tokenId);

      assert.equal(henInfo.isDead, true);
      assert.equal(henInfo.maxDay.toString(), "31536000");
    });
  });

  describe("#### 에러 케이스 ####", () => {
    it("------------- hen staking apporve 없이 staking 에러 -------------", async () => {
      const tokenId = await henMintOperator(user);

      await expectRevert(
        henStakingInstance.henStaking(tokenId, {
          from: user,
        }),
        "ERC721: caller is not token owner or approved"
      );
    });
    it("------------- hen staking 다른 사람이 다른 사람 NFT staking 에러 -------------", async () => {
      const tokenId = await henMintOperator(user);

      await expectRevert(
        henStakingInstance.henStaking(tokenId, {
          from: user2,
        }),
        "Token does not exist."
      );
    });
    it("------------- hen staking approve 다 된 상태에서 다른 사람이 다른 사람 NFT staking 에러 -------------", async () => {
      const tokenId = await henMintOperator(user);

      await henApproveForAllOperator(user);
      await henApproveForAllOperator(user2);

      await expectRevert(
        henStakingInstance.henStaking(tokenId, {
          from: user2,
        }),
        "Token does not exist."
      );
    });
    it("------------- hen staking A가 했지만 B가 staking 출금 시 에러 -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await expectRevert(
        henStakingInstance.henWithdraw(tokenId, { from: user2 }),
        "ERC721: caller is not token owner or approved"
      );
    });
    it("------------- hen staking 완료 후 다시 스테이킹 시 에러인지? -------------", async () => {
      const { tokenId, receivedTokenId } = await henStakingSetting(user);

      await time.increase(time.duration.days(365));

      const beforeBalance = await tokenInstance.balanceOf(user);

      assert.equal("0", beforeBalance.toString());

      await henWithdrawOperator(tokenId, user);

      const afterBalance = await tokenInstance.balanceOf(user);

      const dailyReward = await henStakingInstance.rewardPerStakingAllowed();

      const dailyRewardBN = new web3.utils.BN(dailyReward.toString());

      const expectedBalance = dailyRewardBN
        .mul(new web3.utils.BN("365"))
        .toString();

      assert.equal(expectedBalance.toString(), afterBalance.toString());

      await expectRevert(
        henStakingInstance.henStaking(tokenId, {
          from: user,
        }),
        "Hen is Dead."
      );
    });
  });
});