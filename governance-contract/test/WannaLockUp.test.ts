import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { decodeEventLog, getAbiItem, parseEther } from "viem";
import { network } from "hardhat";

let viem: Awaited<ReturnType<typeof network.connect>>["viem"];
let publicClient: Awaited<ReturnType<typeof viem.getPublicClient>>;
let deployer: any;

interface LockInfo {
  startTime: bigint;
  endTime: bigint;
  amount: bigint;
  isUnlock: boolean;
}

describe("WannaLockUp", () => {
  let wanna: any;
  let wannaLockUp: any;

  before(async () => {
    const connected = await network.connect();
    viem = connected.viem;
    publicClient = await viem.getPublicClient();

    const walletClients = await viem.getWalletClients();
    [deployer] = walletClients.values();

    wanna = await viem.deployContract("WANNA");

    wannaLockUp = await viem.deployContract("WannaLockUp", [wanna.address]);
  });

  it("WannaLockUp - 락업 잘되는지 확인, 컨트랙트 토큰 잔액 알맞게 들어갔는지, 락업 조회 문제없는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    wannaLockUp = await viem.deployContract("WannaLockUp", [wanna.address]);

    const [_, receiver] = (await viem.getWalletClients()).values();

    const amount = parseEther("100");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "approve",
      args: [wannaLockUp.address, amount],
    });

    const txHash = await deployer.writeContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "lockUp",
      args: [receiver.account.address, amount, 100],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const block = await publicClient.getBlock({ blockNumber: tx.blockNumber });
    const blockTimestamp = block.timestamp;

    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === wannaLockUp.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: wannaLockUp.abi,
          name: "Lock",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const recipient = decoded.args.recipient;
    const amountReceive = decoded.args.amount;
    const lockTime = decoded.args.lockTime;
    const startTime = decoded.args.startTime;
    const endTime = decoded.args.endTime;

    assert.equal(
      recipient.toLowerCase(),
      receiver.account.address.toLowerCase()
    );
    assert.equal(amountReceive.toString(), amount.toString());
    assert.equal(
      recipient.toLowerCase(),
      receiver.account.address.toLowerCase()
    );
    assert.equal(lockTime, 100n);
    assert.equal(startTime, blockTimestamp);
    assert.equal(startTime + lockTime, endTime);

    let state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getTokenBalance",
      args: [],
    })) as bigint;

    assert.equal(state, amount);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getLockCount",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, 1n);

    let stateInfo = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getLockInfo",
      args: [receiver.account.address, 0],
    })) as LockInfo;

    assert.equal(stateInfo.startTime, blockTimestamp);
    assert.equal(stateInfo.endTime, stateInfo.startTime + lockTime);
    assert.equal(stateInfo.amount, amount);
    assert.equal(stateInfo.isUnlock, false);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getLockedAmountOfAddress",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, amount);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getClaimableAmount",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, 0n);
  });

  it("WannaLockUp - 락업 후 시간 경과 후 클레임 잘되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    wannaLockUp = await viem.deployContract("WannaLockUp", [wanna.address]);

    const [_, receiver] = (await viem.getWalletClients()).values();

    const amount = parseEther("100");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "approve",
      args: [wannaLockUp.address, amount],
    });

    let txHash = await deployer.writeContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "lockUp",
      args: [receiver.account.address, amount, 100],
    });

    let tx = await publicClient.getTransactionReceipt({ hash: txHash });
    let block = await publicClient.getBlock({ blockNumber: tx.blockNumber });
    let blockTimestamp = block.timestamp;

    let log = tx.logs.find(
      (log) => log.address.toLowerCase() === wannaLockUp.address.toLowerCase()
    ) as any;

    let decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: wannaLockUp.abi,
          name: "Lock",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const recipient = decoded.args.recipient;
    const amountReceive = decoded.args.amount;
    const lockTime = decoded.args.lockTime;
    const startTime = decoded.args.startTime;
    const endTime = decoded.args.endTime;

    assert.equal(
      recipient.toLowerCase(),
      receiver.account.address.toLowerCase()
    );
    assert.equal(amountReceive.toString(), amount.toString());
    assert.equal(
      recipient.toLowerCase(),
      receiver.account.address.toLowerCase()
    );
    assert.equal(lockTime, 100n);
    assert.equal(startTime, blockTimestamp);
    assert.equal(startTime + lockTime, endTime);

    await publicClient.transport.request({
      method: "evm_increaseTime",
      params: [Number(lockTime) + 10],
    });
    await publicClient.transport.request({
      method: "evm_mine",
    });

    let state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getLockedAmountOfAddress",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, amount);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getClaimableAmount",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, amount);

    txHash = await receiver.writeContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "claimAll",
      args: [],
    });

    tx = await publicClient.getTransactionReceipt({ hash: txHash });

    log = tx.logs.find(
      (log) => log.address.toLowerCase() === wannaLockUp.address.toLowerCase()
    ) as any;

    decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: wannaLockUp.abi,
          name: "Claim",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const arg1 = decoded.args.recipient;
    const arg2 = decoded.args.amount;
    const arg3 = decoded.args.lockIndexs;

    assert.equal(arg1.toLowerCase(), receiver.account.address.toLowerCase());
    assert.equal(arg2, amount);
    assert.equal(arg3[0], 0n);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getLockedAmountOfAddress",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, 0n);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getClaimableAmount",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, 0n);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getTokenBalance",
      args: [],
    })) as bigint;

    assert.equal(state, 0n);
  });

  it("WannaLockUp - 락업 후 시간 경과 후 클레임2 잘되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    wannaLockUp = await viem.deployContract("WannaLockUp", [wanna.address]);

    const [_, receiver] = (await viem.getWalletClients()).values();

    const amount = parseEther("100");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "approve",
      args: [wannaLockUp.address, amount],
    });

    let txHash = await deployer.writeContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "lockUp",
      args: [receiver.account.address, amount, 100],
    });

    let tx = await publicClient.getTransactionReceipt({ hash: txHash });
    let block = await publicClient.getBlock({ blockNumber: tx.blockNumber });
    let blockTimestamp = block.timestamp;

    let log = tx.logs.find(
      (log) => log.address.toLowerCase() === wannaLockUp.address.toLowerCase()
    ) as any;

    let decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: wannaLockUp.abi,
          name: "Lock",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const recipient = decoded.args.recipient;
    const amountReceive = decoded.args.amount;
    const lockTime = decoded.args.lockTime;
    const startTime = decoded.args.startTime;
    const endTime = decoded.args.endTime;

    assert.equal(
      recipient.toLowerCase(),
      receiver.account.address.toLowerCase()
    );
    assert.equal(amountReceive.toString(), amount.toString());
    assert.equal(
      recipient.toLowerCase(),
      receiver.account.address.toLowerCase()
    );
    assert.equal(lockTime, 100n);
    assert.equal(startTime, blockTimestamp);
    assert.equal(startTime + lockTime, endTime);

    await publicClient.transport.request({
      method: "evm_increaseTime",
      params: [Number(lockTime) + 10],
    });
    await publicClient.transport.request({
      method: "evm_mine",
    });

    let state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getLockedAmountOfAddress",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, amount);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getClaimableAmount",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, amount);

    txHash = await receiver.writeContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "claimSelected",
      args: [[0]],
    });

    tx = await publicClient.getTransactionReceipt({ hash: txHash });

    log = tx.logs.find(
      (log) => log.address.toLowerCase() === wannaLockUp.address.toLowerCase()
    ) as any;

    decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: wannaLockUp.abi,
          name: "Claim",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const arg1 = decoded.args.recipient;
    const arg2 = decoded.args.amount;
    const arg3 = decoded.args.lockIndexs;

    assert.equal(arg1.toLowerCase(), receiver.account.address.toLowerCase());
    assert.equal(arg2, amount);
    assert.equal(arg3[0], 0n);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getLockedAmountOfAddress",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, 0n);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getClaimableAmount",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(state, 0n);

    state = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getTokenBalance",
      args: [],
    })) as bigint;

    assert.equal(state, 0n);
  });

  it("WannaLockUp - 락업 후 기간 안지났는데 클레임 시 에러가 나는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    wannaLockUp = await viem.deployContract("WannaLockUp", [wanna.address]);

    const [_, receiver] = (await viem.getWalletClients()).values();

    const amount = parseEther("100");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "approve",
      args: [wannaLockUp.address, amount],
    });

    await deployer.writeContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "lockUp",
      args: [receiver.account.address, amount, 100],
    });

    await assert.rejects(async () => {
      await receiver.writeContract({
        address: wannaLockUp.address,
        abi: wannaLockUp.abi,
        functionName: "claimAll",
        args: [],
      });
    }, /NoUnlockedTokens()/);
  });
});
