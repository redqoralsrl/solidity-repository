import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import {
  decodeEventLog,
  getAbiItem,
  parseEther,
  padHex,
  keccak256,
  toBytes,
} from "viem";
import { network } from "hardhat";

let viem: Awaited<ReturnType<typeof network.connect>>["viem"];
let publicClient: Awaited<ReturnType<typeof viem.getPublicClient>>;
let deployer: any;

describe("WANNA GOVERNANCE", () => {
  let wanna: any;
  let governor: any;
  let timelock: any;

  let minDelay: any;
  let proposers: any;
  let executors: any;

  before(async () => {
    const connected = await network.connect();
    viem = connected.viem;
    publicClient = await viem.getPublicClient();

    const walletClients = await viem.getWalletClients();
    [deployer] = walletClients.values();
    minDelay = 3600n; // 예: 1시간
    proposers = [deployer.account.address];
    executors = [deployer.account.address];

    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });
  });

  // it("WannaGovernance - votingDelay, votingPeriod, proposalThreshold 값 확인", async () => {
  //   const delay = await publicClient.readContract({
  //     address: governor.address,
  //     abi: governor.abi,
  //     functionName: "votingDelay",
  //     args: [],
  //   });

  //   const period = await publicClient.readContract({
  //     address: governor.address,
  //     abi: governor.abi,
  //     functionName: "votingPeriod",
  //     args: [],
  //   });

  //   const threshold = await publicClient.readContract({
  //     address: governor.address,
  //     abi: governor.abi,
  //     functionName: "proposalThreshold",
  //     args: [],
  //   });

  //   assert.equal(delay, 28800n);
  //   assert.equal(period, 201600n);
  //   assert.equal(threshold, 100000000000000000000n);
  // });

  it("WannaGovernance - 프라이빗 지갑 등록 되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "privateList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPrivateAddress",
      args: [user1.account.address, true],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "privateList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);
  });

  it("WannaGovernance - 프라이빗 지갑 여러개 등록 되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1, user2, user3] = (await viem.getWalletClients()).values();

    const userList = [user1, user2, user3];
    for (let i = 0; i < userList.length; i++) {
      let isRegist = await publicClient.readContract({
        address: governor.address,
        abi: governor.abi,
        functionName: "privateList",
        args: [userList[i].account.address],
      });

      assert.equal(isRegist, false);
    }

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPrivateAddressList",
      args: [
        [user1.account.address, user2.account.address, user3.account.address],
        true,
      ],
    });

    for (let i = 0; i < userList.length; i++) {
      let isRegist = await publicClient.readContract({
        address: governor.address,
        abi: governor.abi,
        functionName: "privateList",
        args: [userList[i].account.address],
      });

      assert.equal(isRegist, true);
    }
  });

  it("WaanaGovernance - 프라이빗 지갑 제안 등록 후 해제 되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "privateList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPrivateAddress",
      args: [user1.account.address, true],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "privateList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPrivateAddress",
      args: [user1.account.address, false],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "privateList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);
  });

  it("WannaGovernance - 퍼블릭 지갑 등록 되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);
  });

  it("WaanaGovernance - 퍼블릭 지갑 제안 등록 후 전체 해제 되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    let publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    let publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "clearPublicAddresses",
      args: [],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 0);
  });

  it("WannaGovernance - 등록된 프라이빗 지갑 제안 등록 잘되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "privateList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPrivateAddress",
      args: [user1.account.address, true],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "privateList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const amount = parseEther("1000");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    const votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    const votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);
  });

  it("WannaGovernance - 등록된 퍼블릭 지갑 제안 등록 잘되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("1000");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    const votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    const votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);
  });

  it("WannaGovernance - 등록되지 않은 지갑 제안 등록 막히는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1] = (await viem.getWalletClients()).values();

    const amount = parseEther("1000");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    const votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    const votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    await assert.rejects(async () => {
      await user1.writeContract({
        address: governor.address,
        abi: governor.abi,
        functionName: "propose",
        args: [targets, values, calldatas, description],
      });
    }, /Not authorized to propose/);
  });

  it("WannaGovernance - 제안 등록후 등록된 제안 가져오는 함수 문제없는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("1000");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    const votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    const votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    const forVotes = proposal[5];
    const againstVotes = proposal[6];
    const abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);
  });

  it("WannaGovernance - 제안 등록 후 제안 활성화 되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("1000");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    const votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    const votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    const forVotes = proposal[5];
    const againstVotes = proposal[6];
    const abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active
  });

  it("WannaGovernance - 제안 등록 후 제안 활성화 후 투표 되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1, user2] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("1000");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user2.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await user2.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user2.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    let votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user2.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    let forVotes = proposal[5];
    let againstVotes = proposal[6];
    let abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active

    await user2.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "castVote",
      args: [proposalId, 0], // 0=Against, 1=For, 2=Abstain
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const hasVotedUser = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    forVotes = proposalResult[5];
    againstVotes = proposalResult[6];
    abstainVotes = proposalResult[7];

    assert.equal(againstVotes.toString(), amount.toString());
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
  });

  it("WannaGovernance - 투표 기능 0개의 power를 가진 상태로 투표 결과는 0 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1, user2] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("1000");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    let votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user2.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), "0");
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    let forVotes = proposal[5];
    let againstVotes = proposal[6];
    let abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active

    await user2.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "castVote",
      args: [proposalId, 0], // 0=Against, 1=For, 2=Abstain
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const hasVotedUser = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    forVotes = proposalResult[5];
    againstVotes = proposalResult[6];
    abstainVotes = proposalResult[7];

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
  });

  it("WannaGovernance - 제안을 관리자가 취소할 수 있는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("1000");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    const votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    const votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    let proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    const forVotes = proposal[5];
    const againstVotes = proposal[6];
    const abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active

    const descriptionHash = keccak256(toBytes(description)); // 정확한 proposalId와 일치

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "cancelOwnerPower",
      args: [targets, values, calldatas, descriptionHash],
    });

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 2); // cancel

    proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    assert.equal(proposal[8], true);
  });

  it("WannaGovernance - [succeed 상태] 제안 등록 -> 제안 활성화 -> 최소 투표수 획득 및 찬성 과반수 획득 -> 찬성 활성화 되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1, user2] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("4000001");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user2.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await user2.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user2.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    let votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user2.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    let forVotes = proposal[5];
    let againstVotes = proposal[6];
    let abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active

    await user2.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const hasVotedUser = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    forVotes = proposalResult[5];
    againstVotes = proposalResult[6];
    abstainVotes = proposalResult[7];

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes.toString(), amount.toString());
    assert.equal(abstainVotes, 0n);

    const period = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingPeriod",
      args: [],
    })) as bigint;

    for (let i = 0n; i < period + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 4); // succeed
  });

  it("WannaGovernance - [defeated 상태] 제안 등록 -> 제안 활성화 - > 최소 투표수 실패 or 찬성이 부족한 경우 -> 찬성표 부족으로 부결 되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1, user2] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("4000000");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user2.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await user2.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user2.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    let votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user2.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    let forVotes = proposal[5];
    let againstVotes = proposal[6];
    let abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active

    await user2.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "castVote",
      args: [proposalId, 0], // 0=Against, 1=For, 2=Abstain
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const hasVotedUser = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    forVotes = proposalResult[5];
    againstVotes = proposalResult[6];
    abstainVotes = proposalResult[7];

    assert.equal(againstVotes.toString(), amount.toString());
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);

    const period = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingPeriod",
      args: [],
    })) as bigint;

    for (let i = 0n; i < period + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 3); // defeated
  });

  it("WannaGovernance - [queue 상태] 제안 등록 -> 제안 활성화 -> 최소 득표수 획득 및 찬성 과반수 획득 -> queue() 호출 -> queue 상태로 바뀌는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1, user2] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("4000001");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user2.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await user2.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user2.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    let votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user2.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    let forVotes = proposal[5];
    let againstVotes = proposal[6];
    let abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active

    await user2.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const hasVotedUser = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    forVotes = proposalResult[5];
    againstVotes = proposalResult[6];
    abstainVotes = proposalResult[7];

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes.toString(), amount.toString());
    assert.equal(abstainVotes, 0n);

    const period = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingPeriod",
      args: [],
    })) as bigint;

    for (let i = 0n; i < period + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 4); // succeed

    const descriptionHash = keccak256(toBytes(description));

    const queueProposeId = await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "queue",
      args: [targets, values, calldatas, descriptionHash],
    });

    assert.ok(queueProposeId, "Need proposalId");

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 5); // queue
  });

  it("WannaGovernance - [queue 가 executed 잘되는지] 제안 등록 -> 제안 활성화 -> 최소 득표수 획득 및 찬성 과반수 획득 -> queue() 호출 -> queue 상태 -> minDelay 지나기 -> execute() 실행 후 상태 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1, user2] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("4000001");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user2.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await user2.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user2.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    let votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user2.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    let forVotes = proposal[5];
    let againstVotes = proposal[6];
    let abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active

    await user2.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const hasVotedUser = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    forVotes = proposalResult[5];
    againstVotes = proposalResult[6];
    abstainVotes = proposalResult[7];

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes.toString(), amount.toString());
    assert.equal(abstainVotes, 0n);

    const period = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingPeriod",
      args: [],
    })) as bigint;

    for (let i = 0n; i < period + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 4); // succeed

    const descriptionHash = keccak256(toBytes(description));

    const queueProposeId = await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "queue",
      args: [targets, values, calldatas, descriptionHash],
    });

    assert.ok(queueProposeId, "Need proposalId");

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 5); // queue

    await publicClient.transport.request({
      method: "evm_increaseTime",
      params: [Number(minDelay) + 100],
    });

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "execute",
      args: [targets, values, calldatas, descriptionHash],
    });

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 7); // Executed
  });

  it("WannaGovernance - [queue 가 minDelay 시간이 지나지 않고 실행할시 에러] 제안 등록 -> 제안 활성화 -> 최소 득표수 획득 및 찬성 과반수 획득 -> queue() 호출 -> queue 상태 -> minDelay가 충분히 지나지 않고 execute시 에러 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1, user2] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("4000001");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user2.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await user2.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user2.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    let votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user2.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    let forVotes = proposal[5];
    let againstVotes = proposal[6];
    let abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active

    await user2.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const hasVotedUser = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    forVotes = proposalResult[5];
    againstVotes = proposalResult[6];
    abstainVotes = proposalResult[7];

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes.toString(), amount.toString());
    assert.equal(abstainVotes, 0n);

    const period = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingPeriod",
      args: [],
    })) as bigint;

    for (let i = 0n; i < period + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 4); // succeed

    const descriptionHash = keccak256(toBytes(description));

    const queueProposeId = await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "queue",
      args: [targets, values, calldatas, descriptionHash],
    });

    assert.ok(queueProposeId, "Need proposalId");

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 5); // queue

    await assert.rejects(async () => {
      await deployer.writeContract({
        address: governor.address,
        abi: governor.abi,
        functionName: "execute",
        args: [targets, values, calldatas, descriptionHash],
      });
    }, /TimelockController: operation is not ready/);

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 5); // queue
  });

  it("WannaGovernance - [queue 상태 중에 취소시 잘되는지] 제안 등록 -> 제안 활성화 -> 최소 득표수 획득 및 찬성 과반수 획득 -> queue() 호출 -> queue 상태 -> 제안 취소시 잘 작동하는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1, user2] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("4000001");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user2.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await user2.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user2.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    let votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user2.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    let forVotes = proposal[5];
    let againstVotes = proposal[6];
    let abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active

    await user2.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const hasVotedUser = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    forVotes = proposalResult[5];
    againstVotes = proposalResult[6];
    abstainVotes = proposalResult[7];

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes.toString(), amount.toString());
    assert.equal(abstainVotes, 0n);

    const period = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingPeriod",
      args: [],
    })) as bigint;

    for (let i = 0n; i < period + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 4); // succeed

    const descriptionHash = keccak256(toBytes(description));

    const queueProposeId = await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "queue",
      args: [targets, values, calldatas, descriptionHash],
    });

    assert.ok(queueProposeId, "Need proposalId");

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 5); // queue

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "cancelOwnerPower",
      args: [targets, values, calldatas, descriptionHash],
    });

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 2); // cancel
  });

  it("WannaGovernance - [queue 상태 중에 minDelay 이후에 취소해도 잘되는지] 제안 등록 -> 제안 활성화 -> 최소 득표수 획득 및 찬성 과반수 획득 -> queue() 호출 -> queue 상태 -> minDelay 지나기-> 제안 취소시 잘 작동하는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");
    timelock = await viem.deployContract("TimelockController", [
      minDelay,
      proposers,
      executors,
      deployer.account.address,
    ]);
    governor = await viem.deployContract("WannaGovernance", [
      wanna.address,
      timelock.address,
    ]);

    await deployer.writeContract({
      address: timelock.address,
      abi: timelock.abi,
      functionName: "setRoleAdmin",
      args: [[governor.address], [governor.address]],
    });

    const [_, user1, user2] = (await viem.getWalletClients()).values();

    let isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, false);

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "setPublicAddressList",
      args: [[user1.account.address]],
    });

    isRegist = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicList",
      args: [user1.account.address],
    });

    assert.equal(isRegist, true);

    const publicAddressesOne = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "publicAddresses",
      args: [0],
    })) as string;

    assert.equal(
      user1.account.address.toLowerCase(),
      publicAddressesOne.toString().toLowerCase()
    );

    const publicAddresses = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "getPublicAddressesList",
      args: [],
    })) as string[];

    assert.equal(publicAddresses.length, 1);

    const amount = parseEther("4000001");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user1.account.address, amount],
    });

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user2.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await user2.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user2.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    let votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user1.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user2.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");

    const targets = [user1.account.address];
    const values = [0n];
    const calldatas = ["0x"];
    const description = "https://naver.com";

    const txHash = await user1.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === governor.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: governor.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;
    const proposer = decoded.args.proposer;
    const eventTargets = decoded.args.targets;
    const eventValues = decoded.args.values;
    const eventCalldatas = decoded.args.calldatas;
    const eventDescription = decoded.args.description;

    assert.ok(proposalId, "Need proposalId");
    assert.equal(proposer.toLowerCase(), user1.account.address.toLowerCase());
    assert.equal(eventTargets[0].toLowerCase(), targets[0].toLowerCase());
    assert.equal(eventValues[0], values[0]);
    assert.equal(eventCalldatas[0], calldatas[0]);
    assert.equal(eventDescription, description);

    const proposal = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    let forVotes = proposal[5];
    let againstVotes = proposal[6];
    let abstainVotes = proposal[7];

    assert.equal(proposal[0], proposalId);
    assert.equal(
      proposal[1].toString().toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);
    assert.equal(proposal[8], false);
    assert.equal(proposal[9], false);

    let state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 0); // pending

    const delay = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingDelay",
      args: [],
    })) as bigint;

    for (let i = 0n; i < delay + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 1); // active

    await user2.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const hasVotedUser = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    forVotes = proposalResult[5];
    againstVotes = proposalResult[6];
    abstainVotes = proposalResult[7];

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes.toString(), amount.toString());
    assert.equal(abstainVotes, 0n);

    const period = (await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "votingPeriod",
      args: [],
    })) as bigint;

    for (let i = 0n; i < period + 1n; i++) {
      await publicClient.transport.request({
        method: "evm_mine",
      });
    }

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 4); // succeed

    const descriptionHash = keccak256(toBytes(description));

    const queueProposeId = await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "queue",
      args: [targets, values, calldatas, descriptionHash],
    });

    assert.ok(queueProposeId, "Need proposalId");

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 5); // queue

    await publicClient.transport.request({
      method: "evm_increaseTime",
      params: [Number(minDelay) + 100],
    });

    await deployer.writeContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "cancelOwnerPower",
      args: [targets, values, calldatas, descriptionHash],
    });

    state = await publicClient.readContract({
      address: governor.address,
      abi: governor.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(state, 2); // cancel
  });
});
