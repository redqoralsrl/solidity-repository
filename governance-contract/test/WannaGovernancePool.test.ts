import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  decodeEventLog,
  getAbiItem,
  keccak256,
  Hex,
  encodePacked,
  parseEther,
} from "viem";
import { network } from "hardhat";
import { MerkleTree } from "merkletreejs";
import _keccak256 from "keccak256";

let viem: Awaited<ReturnType<typeof network.connect>>["viem"];
let publicClient: Awaited<ReturnType<typeof viem.getPublicClient>>;

function leafFor(addr: Hex) {
  return Buffer.from(
    keccak256(encodePacked(["address"], [addr])).slice(2),
    "hex"
  );
}

function buildMerkle(addrs: Hex[]) {
  const leaves = addrs.map(leafFor);
  const tree = new MerkleTree(leaves, _keccak256, { sortPairs: true });
  const root = `0x${tree.getRoot().toString("hex")}` as Hex;
  const getProof = (addr: Hex) =>
    tree.getHexProof(leafFor(addr)).map((p: string) => p as Hex);
  return { tree, root: root as Hex, getProof };
}

async function mine(publicClient: any, blocks = 1) {
  for (let i = 0; i < blocks; i++) {
    await publicClient.transport.request({
      method: "evm_mine",
    });
  }
}

describe("WannaGovernancePool", () => {
  let wanna: any;
  let wannaLockUp: any;
  let gov: any;
  let deployer: any;
  let user1: any; // public
  let user2: any; // public
  let user3: any; // public
  let user4: any; // just user
  let user5: any; // private
  let user6: any; // private

  let getProofFunc: any;
  let merkleRoot: Hex;
  let proofUser1: Hex[];
  let proofUser2: Hex[];

  let proposalThreshold = parseEther("0"); // 최소 제안 보유 수량 0 token
  let votingPeriod = 10n; // 10 블록
  let quorumVotes = parseEther("1000"); // 제안 통과 될 최소 토큰 수 1000 tokens

  const amount = parseEther("1000");

  beforeEach(async () => {
    const connected = await network.connect();
    viem = connected.viem;
    publicClient = await viem.getPublicClient();

    const walletClients = await viem.getWalletClients();
    [deployer, user1, user2, user3, user4, user5, user6] =
      walletClients.values();

    wanna = await viem.deployContract("WANNA");

    wannaLockUp = await viem.deployContract("WannaLockUp", [wanna.address]);

    const { root, getProof } = buildMerkle([
      user1.account.address as Hex,
      user2.account.address as Hex,
    ]);
    getProofFunc = getProof;
    merkleRoot = root;
    proofUser1 = getProof(user1.account.address);
    proofUser2 = getProof(user2.account.address);

    gov = await viem.deployContract("WannaGovernancePool", [
      merkleRoot,
      wanna.address,
      wannaLockUp.address,
    ]);

    await deployer.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "setPrivateAddress",
      args: [user5.account.address, true],
    });
    await deployer.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "setPrivateAddress",
      args: [user6.account.address, true],
    });

    await deployer.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "setProposalThreshold",
      args: [proposalThreshold],
    });
    await deployer.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "setVotingPeriod",
      args: [votingPeriod],
    });
    await deployer.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "setQuorumVotes",
      args: [quorumVotes],
    });

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
    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user3.account.address, amount],
    });
    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user4.account.address, amount],
    });
    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user5.account.address, amount],
    });
    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user6.account.address, amount],
    });
  });

  it("WannaGovernancePool - 머클 포함 유저가 제안 생성 성공", async () => {
    const title = "come on";
    const url = "https://....com";

    const txHash = await user1.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, proofUser1],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });

    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(
      decoded.args.proposer.toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(decoded.args.title, title);
    assert.equal(decoded.args.url, url);

    const proposalId = decoded.args.proposalId;

    let currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 0); // pending

    await mine(publicClient, 1);

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 1); // active
  });

  it("WannaGovernancePool - 프라이빗 포함 유저가 제안 생성 성공", async () => {
    const title = "come on";
    const url = "https://....com";

    const txHash = await user5.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, []],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });

    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(
      decoded.args.proposer.toLowerCase(),
      user5.account.address.toLowerCase()
    );
    assert.equal(decoded.args.title, title);
    assert.equal(decoded.args.url, url);

    const proposalId = decoded.args.proposalId;

    let currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 0); // pending

    await mine(publicClient, 1);

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 1); // active
  });

  it("WannaGovernancePool - 어드민 제안 생성 성공", async () => {
    const title = "come on";
    const url = "https://....com";

    const txHash = await deployer.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, []],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });

    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(
      decoded.args.proposer.toLowerCase(),
      deployer.account.address.toLowerCase()
    );
    assert.equal(decoded.args.title, title);
    assert.equal(decoded.args.url, url);

    const proposalId = decoded.args.proposalId;

    let currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 0); // pending

    await mine(publicClient, 1);

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 1); // active
  });

  it("WannaGovernancePool - 등록되지 않은 유저가 제안 생성 실패", async () => {
    const title = "come on";
    const url = "https://....com";

    const proofUser4 = getProofFunc(user4.account.address);

    await assert.rejects(async () => {
      await user4.writeContract({
        address: gov.address,
        abi: gov.abi,
        functionName: "propose",
        args: [title, url, proofUser4],
      });
    }, /NotAllow()/);
  });

  it("WannaGovernancePool - 제안에 투표 잘되는지 테스트, 중복 투표시 에러 테스트", async () => {
    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), "0");

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await mine(publicClient, 1);

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());

    const title = "come on";
    const url = "https://....com";

    const txHash = await user5.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, []],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });

    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(
      decoded.args.proposer.toLowerCase(),
      user5.account.address.toLowerCase()
    );
    assert.equal(decoded.args.title, title);
    assert.equal(decoded.args.url, url);

    const proposalId = decoded.args.proposalId;

    let currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 0); // pending

    await mine(publicClient, 1);

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 1); // active

    await user1.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await mine(publicClient, 1);

    const hasVotedUser = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "hasVoted",
      args: [proposalId, user1.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    const forVotes = proposalResult.forVotes;
    const againstVotes = proposalResult.againstVotes;
    const abstainVotes = proposalResult.abstainVotes;

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes.toString(), amount.toString());
    assert.equal(abstainVotes, 0n);

    const proposalVotes = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalVotes",
      args: [proposalId],
    })) as any;

    assert.equal(proposalVotes[0], 0n);
    assert.equal(proposalVotes[1].toString(), amount.toString());
    assert.equal(proposalVotes[2], 0n);

    await assert.rejects(async () => {
      await user1.writeContract({
        address: gov.address,
        abi: gov.abi,
        functionName: "castVote",
        args: [proposalId, 1],
      });
    }, /AlreadyVoted()/);
  });

  it("WannaGovernancePool - 제안에 투표 후 통과 잘되는지 - Succeeded", async () => {
    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), "0");

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

    await mine(publicClient, 1);

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());

    const title = "come on";
    const url = "https://....com";

    const txHash = await user5.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, []],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });

    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(
      decoded.args.proposer.toLowerCase(),
      user5.account.address.toLowerCase()
    );
    assert.equal(decoded.args.title, title);
    assert.equal(decoded.args.url, url);

    const proposalId = decoded.args.proposalId;

    let currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 0); // pending

    await mine(publicClient, 1);

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 1); // active

    await user1.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await user2.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await mine(publicClient, 1);

    let hasVotedUser = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "hasVoted",
      args: [proposalId, user1.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    hasVotedUser = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    const forVotes = proposalResult.forVotes;
    const againstVotes = proposalResult.againstVotes;
    const abstainVotes = proposalResult.abstainVotes;

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes.toString(), (amount + amount).toString());
    assert.equal(abstainVotes, 0n);

    const proposalVotes = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalVotes",
      args: [proposalId],
    })) as any;

    assert.equal(proposalVotes[0], 0n);
    assert.equal(proposalVotes[1].toString(), (amount + amount).toString());
    assert.equal(proposalVotes[2], 0n);

    await mine(publicClient, Number(votingPeriod));

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 4);
  });

  it("WannaGovernancePool - 제안에 투표 후 만료 잘되는지 - Expired", async () => {
    const title = "come on";
    const url = "https://....com";

    const txHash = await user5.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, []],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });

    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(
      decoded.args.proposer.toLowerCase(),
      user5.account.address.toLowerCase()
    );
    assert.equal(decoded.args.title, title);
    assert.equal(decoded.args.url, url);

    const proposalId = decoded.args.proposalId;

    let currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 0); // pending

    await mine(publicClient, 1);

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 1); // active

    const proposalResult = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    const forVotes = proposalResult.forVotes;
    const againstVotes = proposalResult.againstVotes;
    const abstainVotes = proposalResult.abstainVotes;

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes, 0n);
    assert.equal(abstainVotes, 0n);

    const proposalVotes = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalVotes",
      args: [proposalId],
    })) as any;

    assert.equal(proposalVotes[0], 0n);
    assert.equal(proposalVotes[1], 0n);
    assert.equal(proposalVotes[2], 0n);

    await mine(publicClient, Number(votingPeriod));

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 5);
  });

  it("WannaGovernancePool - 제안에 투표 후 실패 잘되는지 - Defeated", async () => {
    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), "0");

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

    await mine(publicClient, 1);

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user3.account.address, parseEther("1")],
    });

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    assert.equal(votesNow, parseEther("999"));

    const title = "come on";
    const url = "https://....com";

    const txHash = await user5.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, []],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });

    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(
      decoded.args.proposer.toLowerCase(),
      user5.account.address.toLowerCase()
    );
    assert.equal(decoded.args.title, title);
    assert.equal(decoded.args.url, url);

    const proposalId = decoded.args.proposalId;

    let currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 0); // pending

    await mine(publicClient, 1);

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 1); // active

    await user1.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await user2.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "castVote",
      args: [proposalId, 0], // 0=Against, 1=For, 2=Abstain
    });

    await mine(publicClient, 1);

    let hasVotedUser = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "hasVoted",
      args: [proposalId, user1.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    hasVotedUser = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "hasVoted",
      args: [proposalId, user2.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    const forVotes = proposalResult.forVotes;
    const againstVotes = proposalResult.againstVotes;
    const abstainVotes = proposalResult.abstainVotes;

    assert.equal(againstVotes, parseEther("1000"));
    assert.equal(forVotes, parseEther("999"));
    assert.equal(abstainVotes, 0n);

    const proposalVotes = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalVotes",
      args: [proposalId],
    })) as any;

    assert.equal(proposalVotes[0], parseEther("1000"));
    assert.equal(proposalVotes[1], parseEther("999"));
    assert.equal(proposalVotes[2], 0n);

    await mine(publicClient, Number(votingPeriod));

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 3);
  });

  it("WannaGovernancePool - 제안에 투표 후 취소 잘되는지 - Canceled", async () => {
    const title = "come on";
    const url = "https://....com";

    let txHash = await user5.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, []],
    });

    let tx = await publicClient.getTransactionReceipt({ hash: txHash });

    let log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    let decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(
      decoded.args.proposer.toLowerCase(),
      user5.account.address.toLowerCase()
    );
    assert.equal(decoded.args.title, title);
    assert.equal(decoded.args.url, url);

    const proposalId = decoded.args.proposalId;

    let currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 0); // pending

    await mine(publicClient, 1);

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 1); // active

    txHash = await user5.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "cancel",
      args: [title, url],
    });

    tx = await publicClient.getTransactionReceipt({ hash: txHash });

    log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCanceled",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(proposalId, decoded.args.proposalId);

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 2);
  });

  it("WannaGovernancePool - 중복 제안 잘 막혔는지", async () => {
    const title = "come on";
    const url = "https://....com";

    const txHash = await user1.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, proofUser1],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });

    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(
      decoded.args.proposer.toLowerCase(),
      user1.account.address.toLowerCase()
    );
    assert.equal(decoded.args.title, title);
    assert.equal(decoded.args.url, url);

    const proposalId = decoded.args.proposalId;

    let currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 0); // pending

    await assert.rejects(async () => {
      await user1.writeContract({
        address: gov.address,
        abi: gov.abi,
        functionName: "propose",
        args: [title, url, proofUser1],
      });
    }, /ExistPropose()/);
  });

  it("WannaGovernancePool - user1 먼저 투표하고 이후 토큰을 user2에 보내도 user2의 가중치는 0", async () => {
    let votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), "0");

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), "0");

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user1.account.address],
    });

    await mine(publicClient, 1);

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());

    const title = "come on";
    const url = "https://....com";

    const txHash = await user5.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, []],
    });

    const tx = await publicClient.getTransactionReceipt({ hash: txHash });

    const log = tx.logs.find(
      (log) => log.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;

    const decoded = decodeEventLog({
      abi: [
        getAbiItem({
          abi: gov.abi,
          name: "ProposalCreated",
        }),
      ],
      data: log.data,
      topics: log.topics,
    }) as any;

    assert.equal(
      decoded.args.proposer.toLowerCase(),
      user5.account.address.toLowerCase()
    );
    assert.equal(decoded.args.title, title);
    assert.equal(decoded.args.url, url);

    const proposalId = decoded.args.proposalId;

    let currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 0); // pending

    await mine(publicClient, 1);

    currentState = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "state",
      args: [proposalId],
    });

    assert.equal(currentState, 1); // active

    let delegateWeight = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalDelegateAmount",
      args: [proposalId, user1.account.address],
    });

    assert.equal(delegateWeight, amount);

    await user1.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "castVote",
      args: [proposalId, 1], // 0=Against, 1=For, 2=Abstain
    });

    await mine(publicClient, 1);

    const hasVotedUser = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "hasVoted",
      args: [proposalId, user1.account.address],
    })) as any;

    assert.equal(hasVotedUser, true);

    const proposalResult = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;

    const forVotes = proposalResult.forVotes;
    const againstVotes = proposalResult.againstVotes;
    const abstainVotes = proposalResult.abstainVotes;

    assert.equal(againstVotes, 0n);
    assert.equal(forVotes.toString(), amount.toString());
    assert.equal(abstainVotes, 0n);

    const proposalVotes = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalVotes",
      args: [proposalId],
    })) as any;

    assert.equal(proposalVotes[0], 0n);
    assert.equal(proposalVotes[1].toString(), amount.toString());
    assert.equal(proposalVotes[2], 0n);

    await user1.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user2.account.address, parseEther("100")],
    });

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user1.account.address],
    })) as bigint;

    assert.equal(votesNow, parseEther("900"));

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    assert.equal(votesNow, parseEther("0"));

    let voteWeight = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalVotesWeight",
      args: [proposalId, user1.account.address],
    })) as bigint[];

    assert.equal(voteWeight[0], 0n);
    assert.equal(voteWeight[1], amount);
    assert.equal(voteWeight[2], 0n);

    voteWeight = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalVotesWeight",
      args: [proposalId, user2.account.address],
    })) as bigint[];

    assert.equal(voteWeight[0], 0n);
    assert.equal(voteWeight[1], 0n);
    assert.equal(voteWeight[2], 0n);

    let weight = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalDelegateAmount",
      args: [proposalId, user1.account.address],
    });

    assert.equal(weight, amount);
    assert.equal(weight, delegateWeight);

    weight = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalDelegateAmount",
      args: [proposalId, user2.account.address],
    });

    assert.equal(weight, 0n);

    let balance = await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [user2.account.address],
    });

    await user2.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user2.account.address],
    });

    await mine(publicClient, 1);

    votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user2.account.address],
    })) as bigint;

    assert.equal(votesNow, balance);

    delegateWeight = await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalDelegateAmount",
      args: [proposalId, user2.account.address],
    });

    assert.equal(delegateWeight, 0n);
  });

  it("WannaGovernancePool - 락업물량 voting power에 잘 반영되는지", async () => {
    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [wannaLockUp.address, parseEther("5000")],
    });

    const lockAmt = parseEther("400");

    await deployer.writeContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "lockUp",
      args: [user3.account.address, lockAmt],
    });

    let lockedNow = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getLockedAmountOfAddress",
      args: [user3.account.address],
    })) as bigint;
    assert.equal(lockedNow, lockAmt);

    const title = "lock power reflected";
    const url = "https://....com/lock-power";

    const txHash = await user5.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, []],
    });
    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (l) => l.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;
    const decoded = decodeEventLog({
      abi: [getAbiItem({ abi: gov.abi, name: "ProposalCreated" })],
      data: log.data,
      topics: log.topics,
    }) as any;

    const proposalId = decoded.args.proposalId;

    await mine(publicClient, 1);

    const expectedWeight = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalDelegateAmount",
      args: [proposalId, user3.account.address],
    })) as bigint;
    assert.equal(expectedWeight, lockAmt);

    const voteTxHash = await user3.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "castVote",
      args: [proposalId, 1],
    });

    const voteTx = await publicClient.getTransactionReceipt({
      hash: voteTxHash,
    });
    const voteLog = voteTx.logs.find(
      (l) => l.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;
    const voteDecoded = decodeEventLog({
      abi: [getAbiItem({ abi: gov.abi, name: "VoteCast" })],
      data: voteLog.data,
      topics: voteLog.topics,
    }) as any;

    assert.equal(voteDecoded.args.weight, lockAmt);

    const proposalResult = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;
    assert.equal(proposalResult.forVotes, lockAmt);
    assert.equal(proposalResult.againstVotes, 0n);
    assert.equal(proposalResult.abstainVotes, 0n);

    const perVoterWeights = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalVotesWeight",
      args: [proposalId, user3.account.address],
    })) as bigint[];
    assert.equal(perVoterWeights[0], 0n);
    assert.equal(perVoterWeights[1], lockAmt);
    assert.equal(perVoterWeights[2], 0n);
  });

  it("WannaGovernancePool - 락업물량 꺼내고 투표시 voting power에 잘반영되는지", async () => {
    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [wannaLockUp.address, parseEther("5000")],
    });

    const lockAmt = parseEther("600");
    await deployer.writeContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "lockUp",
      args: [user3.account.address, lockAmt],
    });

    const title = "unlock then vote";
    const url = "https://....com/unlock-then-vote";
    const txHash = await user5.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "propose",
      args: [title, url, []],
    });
    const tx = await publicClient.getTransactionReceipt({ hash: txHash });
    const log = tx.logs.find(
      (l) => l.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;
    const decoded = decodeEventLog({
      abi: [getAbiItem({ abi: gov.abi, name: "ProposalCreated" })],
      data: log.data,
      topics: log.topics,
    }) as any;
    const proposalId = decoded.args.proposalId;

    await mine(publicClient, 1);

    await deployer.writeContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "increaseUnlockPercent",
      args: [100n],
    });

    await user3.writeContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "claimSelected",
      args: [[0n]],
    });

    const lockedAfterClaim = (await publicClient.readContract({
      address: wannaLockUp.address,
      abi: wannaLockUp.abi,
      functionName: "getLockedAmountOfAddress",
      args: [user3.account.address],
    })) as bigint;
    assert.equal(lockedAfterClaim, 0n);

    const weightPreview = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalDelegateAmount",
      args: [proposalId, user3.account.address],
    })) as bigint;
    assert.equal(weightPreview, 0n);

    const voteTxHash = await user3.writeContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "castVote",
      args: [proposalId, 1],
    });
    const voteTx = await publicClient.getTransactionReceipt({
      hash: voteTxHash,
    });
    const voteLog = voteTx.logs.find(
      (l) => l.address.toLowerCase() === gov.address.toLowerCase()
    ) as any;
    const voteDecoded = decodeEventLog({
      abi: [getAbiItem({ abi: gov.abi, name: "VoteCast" })],
      data: voteLog.data,
      topics: voteLog.topics,
    }) as any;

    assert.equal(voteDecoded.args.weight, 0n);

    const proposalResult = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposals",
      args: [proposalId],
    })) as any;
    assert.equal(proposalResult.forVotes, 0n);
    assert.equal(proposalResult.againstVotes, 0n);
    assert.equal(proposalResult.abstainVotes, 0n);

    const perVoterWeights = (await publicClient.readContract({
      address: gov.address,
      abi: gov.abi,
      functionName: "proposalVotesWeight",
      args: [proposalId, user3.account.address],
    })) as bigint[];
    assert.equal(perVoterWeights[0], 0n);
    assert.equal(perVoterWeights[1], 0n);
    assert.equal(perVoterWeights[2], 0n);
  });
});
