import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { parseEther } from "viem";
import { network } from "hardhat";

let viem: Awaited<ReturnType<typeof network.connect>>["viem"];
let publicClient: Awaited<ReturnType<typeof viem.getPublicClient>>;
let deployer: any;

describe("WannaLockUp", () => {
  let wanna: any;
  let lockUp: any;
  let user1: any;
  let user2: any;
  let user3: any;
  let user4: any;

  beforeEach(async () => {
    const connected = await network.connect();
    viem = connected.viem;
    publicClient = await viem.getPublicClient();

    const walletClients = await viem.getWalletClients();
    [deployer, user1, user2, user3, user4] = walletClients.values();

    wanna = await viem.deployContract("WANNA");

    lockUp = await viem.deployContract("WannaLockUp", [wanna.address]);
  });

  it("기본 상태 값 확인", async () => {
    const name = await lockUp.read.name();
    const symbol = await lockUp.read.symbol();

    assert.equal(name, "Wanna Lockup Contract");
    assert.equal(symbol, "WLC");

    const up = await lockUp.read.unLockPercentage();
    const tp = await lockUp.read.totalPercentage();
    assert.equal(up, 0n);
    assert.equal(tp, 100n);

    const tokenManager = await lockUp.read.tokenManager();
    assert.equal(tokenManager.toLowerCase(), wanna.address.toLowerCase());
  });

  it("WannaLockUp - 락업 퍼센테이지 잘 증가하는지 확인", async () => {
    let up = await lockUp.read.unLockPercentage();
    assert.equal(up, 0n);

    await lockUp.write.increaseUnlockPercent([10], {
      account: deployer.account,
    });

    up = await lockUp.read.unLockPercentage();
    assert.equal(up, 10n);

    await lockUp.write.increaseUnlockPercent([30], {
      account: deployer.account,
    });

    up = await lockUp.read.unLockPercentage();
    assert.equal(up, 40n);

    await assert.rejects(async () => {
      await lockUp.write.increaseUnlockPercent([61], {
        account: deployer.account,
      }),
        /UnLockSettingError()/;
    });

    await lockUp.write.increaseUnlockPercent([60], {
      account: deployer.account,
    });

    up = await lockUp.read.unLockPercentage();
    assert.equal(up, 100n);
  });

  it("WannaLockUp - 락업 정보 확인", async () => {
    await lockUp.write.increaseUnlockPercent([10], {
      account: deployer.account,
    });
    await lockUp.write.increaseUnlockPercent([30], {
      account: deployer.account,
    });

    let up = await lockUp.read.unLockPercentage();
    assert.equal(up, 40n);

    const list = await lockUp.read.getUnLockList();
    assert.deepEqual(
      list.map((x: bigint) => x),
      [10n, 30n]
    );
  });

  it("WannaLockUp - lockup 오너만 가능, 락 정보 저장 잘되는지 확인", async () => {
    const amount = parseEther("1000");

    await assert.rejects(async () => {
      await lockUp.write.lockUp([user1.account.address, amount], {
        account: user1.account,
      });
    }, /Ownable: caller is not the owner/);

    await lockUp.write.lockUp([user1.account.address, amount], {
      account: deployer.account,
    });

    const unLockPercentage = await lockUp.read.unLockPercentage();
    assert.equal(unLockPercentage, 0n);

    const unLockList = await lockUp.read.getUnLockList();
    assert.equal(unLockList.length, 0);

    const tokenBalance = await lockUp.read.getTokenBalance();
    assert.equal(tokenBalance, 0n);

    let lockCont = await lockUp.read.getLockCount([user1.account.address]);
    assert.equal(lockCont, 1n);

    lockCont = await lockUp.read.getLockCount([user2.account.address]);
    assert.equal(lockCont, 0n);

    let lockInfo = await lockUp.read.getLockInfo([user1.account.address, 0]);
    assert.equal(lockInfo.amount, amount);
    assert.equal(lockInfo.percentage, 0n);
    assert.equal(lockInfo.withdrawAmount, 0n);

    await assert.rejects(async () => {
      await lockUp.read.getLockInfo([user1.account.address, 1]);
    }, /InvalidIndex()/);

    let lockInfoList = await lockUp.read.getLockInfoAll([
      user1.account.address,
    ]);
    assert.equal(lockInfoList.length, 1);

    let status = await lockUp.read.getLockClaimStatus([user1.account.address]);
    assert.equal(status, false);

    let lockedAmount = await lockUp.read.getLockedAmountOfAddress([
      user1.account.address,
    ]);
    assert.equal(lockedAmount, amount);

    let claimableAmount = await lockUp.read.getClaimableAmount([
      user1.account.address,
    ]);
    assert.equal(claimableAmount, 0n);

    const totalInit = await lockUp.read.initialLockedSupply();
    assert.equal(totalInit, amount);

    const totalClaim = await lockUp.read.totalClaimed();
    assert.equal(totalClaim, 0n);
  });

  it("WannaLockUp - claim 되는지 확인", async () => {
    const a1 = parseEther("1000");
    const a2 = parseEther("500");
    const a3 = parseEther("200");

    await lockUp.write.lockUp([user1.account.address, a1], {
      account: deployer.account,
    });
    await lockUp.write.lockUp([user2.account.address, a2], {
      account: deployer.account,
    });
    await lockUp.write.lockUp([user3.account.address, a3], {
      account: deployer.account,
    });

    const totalInit = await lockUp.read.initialLockedSupply();
    assert.equal(totalInit, a1 + a2 + a3);

    await wanna.write.transfer([lockUp.address, totalInit], {
      account: deployer.account,
    });

    const tokenBalance = await lockUp.read.getTokenBalance();
    assert.equal(tokenBalance, totalInit);

    await assert.rejects(async () => {
      await lockUp.write.claimAll([], { account: user1.account.address });
    }, /NoUnlockedTokens()/);

    await lockUp.write.increaseUnlockPercent([10n], {
      account: deployer.account,
    });

    const claimableUser1 = await lockUp.read.getClaimableAmount([
      user1.account.address,
    ]);
    assert.equal(claimableUser1, a1 / 10n);

    const claimableStatus = await lockUp.read.getLockClaimStatus([
      user1.account.address,
    ]);
    assert.equal(claimableStatus, true);

    const beforeUser1 = await wanna.read.balanceOf([user1.account.address]);
    await lockUp.write.claimSelected([[0n]], { account: user1.account });
    const afterUser1 = await wanna.read.balanceOf([user1.account.address]);

    assert.equal(afterUser1 - beforeUser1, a1 / 10n);

    let lockUser1 = await lockUp.read.getLockInfo([user1.account.address, 0n]);
    assert.equal(lockUser1.withdrawAmount, a1 / 10n);
    assert.equal(lockUser1.percentage, 10n);

    let lockUser2 = await lockUp.read.getLockInfo([user2.account.address, 0n]);
    assert.equal(lockUser2.withdrawAmount, 0n);
    assert.equal(lockUser2.percentage, 0n);

    await lockUp.write.increaseUnlockPercent([5n], {
      account: deployer.account,
    });

    const lockUpPercentage = await lockUp.read.unLockPercentage();
    assert.equal(lockUpPercentage, 15n);

    const claimBeforeUser1 = await wanna.read.balanceOf([
      user1.account.address,
    ]);

    await lockUp.write.claimAll([], { account: user1.account });

    lockUser1 = await lockUp.read.getLockInfo([user1.account.address, 0n]);
    assert.equal(lockUser1.withdrawAmount, (a1 * 15n) / 100n);
    assert.equal(lockUser1.percentage, 15n);

    const claimAfterUser1 = await wanna.read.balanceOf([user1.account.address]);
    assert.equal(claimAfterUser1, (a1 * 15n) / 100n);

    assert.equal(claimAfterUser1 - claimBeforeUser1, (a1 * 5n) / 100n);

    const beforeUser2 = await wanna.read.balanceOf([user2.account.address]);
    await lockUp.write.claimSelected([[0n]], { account: user2.account });
    const afterUser2 = await wanna.read.balanceOf([user2.account.address]);

    assert.equal(beforeUser2, 0n);
    assert.equal(afterUser2 - beforeUser2, (a2 * 15n) / 100n);

    lockUser2 = await lockUp.read.getLockInfo([user2.account.address, 0n]);

    assert.equal(lockUser2.withdrawAmount, (a2 * 15n) / 100n);
    assert.equal(lockUser2.percentage, 15n);

    await assert.rejects(async () => {
      await lockUp.write.claimSelected([[0n]], { account: user2.account });
    }, /NoUnlockedTokens()/);

    await assert.rejects(async () => {
      await lockUp.write.claimAll([], { account: user2.account });
    }, /NoUnlockedTokens()/);
  });

  it("WannaLockUp - 여러 단계 락업을 올려 100% 도달시 전량 수령되는지 검증", async () => {
    const a1 = parseEther("1001");
    const a2 = parseEther("1002");
    const a3 = parseEther("1003");
    const a4 = parseEther("9999");

    await lockUp.write.lockUp([user1.account.address, a1], {
      account: deployer.account,
    });
    await lockUp.write.lockUp([user2.account.address, a2], {
      account: deployer.account,
    });
    await lockUp.write.lockUp([user3.account.address, a3], {
      account: deployer.account,
    });

    const initial = await lockUp.read.initialLockedSupply();
    await wanna.write.transfer([lockUp.address, initial], {
      account: deployer.account,
    });

    const steps = [7n, 3n, 17n, 13n, 10n, 50n];

    await lockUp.write.increaseUnlockPercent([steps[0]], {
      account: deployer.account,
    });
    await lockUp.write.claimSelected([[0n]], { account: user1.account });

    await lockUp.write.increaseUnlockPercent([steps[1]], {
      account: deployer.account,
    });
    await lockUp.write.claimSelected([[0n]], { account: user1.account });
    await lockUp.write.claimSelected([[0n]], { account: user2.account });

    await lockUp.write.increaseUnlockPercent([steps[2]], {
      account: deployer.account,
    });
    await lockUp.write.claimSelected([[0n]], { account: user1.account });

    await lockUp.write.increaseUnlockPercent([steps[3]], {
      account: deployer.account,
    });
    await lockUp.write.claimSelected([[0n]], { account: user1.account });

    await lockUp.write.increaseUnlockPercent([steps[4]], {
      account: deployer.account,
    });
    await lockUp.write.claimSelected([[0n]], { account: user1.account });

    await lockUp.write.increaseUnlockPercent([steps[5]], {
      account: deployer.account,
    });
    await lockUp.write.claimSelected([[0n]], { account: user1.account });
    await lockUp.write.claimSelected([[0n]], { account: user2.account });
    await lockUp.write.claimAll([], { account: user3.account });

    await wanna.write.transfer([lockUp.address, a4], {
      account: deployer.account,
    });
    await lockUp.write.lockUp([user4.account.address, a4], {
      account: deployer.account,
    });
    await lockUp.write.claimAll([], { account: user4.account });

    const user1Balance = await wanna.read.balanceOf([user1.account.address]);
    const user2Balance = await wanna.read.balanceOf([user2.account.address]);
    const user3Balance = await wanna.read.balanceOf([user3.account.address]);
    const user4Balance = await wanna.read.balanceOf([user4.account.address]);

    assert.equal(user1Balance, a1);
    assert.equal(user2Balance, a2);
    assert.equal(user3Balance, a3);
    assert.equal(user4Balance, a4);

    const user4Info = await lockUp.read.getLockInfo([user4.account.address, 0]);

    assert.equal(user4Info.amount, a4);
    assert.equal(user4Info.percentage, 100n);
    assert.equal(user4Info.withdrawAmount, a4);

    await assert.rejects(async () => {
      await lockUp.write.claimAll([], { account: user4.account });
    }, /NoUnlockedTokens()/);
  });

  it("WannaLockUp - user1이 여러 락업을 선택/전체 청구로 단계적으로 받아서 최종 100% 수령", async () => {
    const a0 = parseEther("1000");
    const a1 = parseEther("333");
    const a2 = parseEther("777");

    await lockUp.write.lockUp([user1.account.address, a0], {
      account: deployer.account,
    });
    await lockUp.write.lockUp([user1.account.address, a1], {
      account: deployer.account,
    });
    await lockUp.write.lockUp([user1.account.address, a2], {
      account: deployer.account,
    });

    const initial = await lockUp.read.initialLockedSupply();
    await wanna.write.transfer([lockUp.address, initial], {
      account: deployer.account,
    });

    const sum = a0 + a1 + a2;

    await lockUp.write.increaseUnlockPercent([10n], {
      account: deployer.account,
    });

    const beforeStep1 = await wanna.read.balanceOf([user1.account.address]);
    await lockUp.write.claimSelected([[0n, 2n]], { account: user1.account });
    const afterStep1 = await wanna.read.balanceOf([user1.account.address]);

    const expectedStep1 = (a0 * 10n) / 100n + (a2 * 10n) / 100n;
    assert.equal(afterStep1 - beforeStep1, expectedStep1);

    let li0 = await lockUp.read.getLockInfo([user1.account.address, 0n]);
    let li1 = await lockUp.read.getLockInfo([user1.account.address, 1n]);
    let li2 = await lockUp.read.getLockInfo([user1.account.address, 2n]);
    assert.equal(li0.withdrawAmount, (a0 * 10n) / 100n);
    assert.equal(li0.percentage, 10n);
    assert.equal(li1.withdrawAmount, 0n);
    assert.equal(li1.percentage, 0n);
    assert.equal(li2.withdrawAmount, (a2 * 10n) / 100n);
    assert.equal(li2.percentage, 10n);

    await lockUp.write.increaseUnlockPercent([15n], {
      account: deployer.account,
    });

    const beforeStep2 = await wanna.read.balanceOf([user1.account.address]);
    await lockUp.write.claimSelected([[1n]], { account: user1.account });
    const afterStep2 = await wanna.read.balanceOf([user1.account.address]);

    const expectedStep2 = (a1 * 25n) / 100n;
    assert.equal(afterStep2 - beforeStep2, expectedStep2);

    li1 = await lockUp.read.getLockInfo([user1.account.address, 1n]);
    assert.equal(li1.withdrawAmount, (a1 * 25n) / 100n);
    assert.equal(li1.percentage, 25n);

    await lockUp.write.increaseUnlockPercent([35n], {
      account: deployer.account,
    });

    const beforeStep3 = await wanna.read.balanceOf([user1.account.address]);
    await lockUp.write.claimAll([], { account: user1.account });
    const afterStep3 = await wanna.read.balanceOf([user1.account.address]);

    const expectedStep3 =
      (a0 * 50n) / 100n + (a1 * 35n) / 100n + (a2 * 50n) / 100n;

    assert.equal(afterStep3 - beforeStep3, expectedStep3);

    const bal60 = await wanna.read.balanceOf([user1.account.address]);
    assert.equal(bal60, (sum * 60n) / 100n);

    await lockUp.write.increaseUnlockPercent([40n], {
      account: deployer.account,
    });

    const beforeStep4 = await wanna.read.balanceOf([user1.account.address]);
    await lockUp.write.claimAll([], { account: user1.account });
    const afterStep4 = await wanna.read.balanceOf([user1.account.address]);

    const expectedStep4 = (sum * 40n) / 100n;
    assert.equal(afterStep4 - beforeStep4, expectedStep4);

    const finalBal = await wanna.read.balanceOf([user1.account.address]);
    assert.equal(finalBal, sum);

    li0 = await lockUp.read.getLockInfo([user1.account.address, 0n]);
    li1 = await lockUp.read.getLockInfo([user1.account.address, 1n]);
    li2 = await lockUp.read.getLockInfo([user1.account.address, 2n]);
    assert.equal(li0.withdrawAmount, a0);
    assert.equal(li1.withdrawAmount, a1);
    assert.equal(li2.withdrawAmount, a2);
    assert.equal(li0.percentage, 100n);
    assert.equal(li1.percentage, 100n);
    assert.equal(li2.percentage, 100n);

    const claimableEnd = await lockUp.read.getClaimableAmount([
      user1.account.address,
    ]);
    assert.equal(claimableEnd, 0n);
    const remaining = await lockUp.read.getLockedAmountOfAddress([
      user1.account.address,
    ]);
    assert.equal(remaining, 0n);
    const status = await lockUp.read.getLockClaimStatus([
      user1.account.address,
    ]);
    assert.equal(status, false);

    const totalClaimed = await lockUp.read.totalClaimed();
    assert.equal(totalClaimed, initial);

    await assert.rejects(async () => {
      await lockUp.write.claimAll([], { account: user1.account });
    }, /NoUnlockedTokens\(\)/);
  });
});
