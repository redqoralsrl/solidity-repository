````javascript
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { parseEther } from "viem";
import { network } from "hardhat";

let viem: Awaited<ReturnType<typeof network.connect>>["viem"];
let publicClient: Awaited<ReturnType<typeof viem.getPublicClient>>;
let deployer: any;
let receiver: any;

describe("WANNA", () => {
  let wanna: any;

  before(async () => {
    const connected = await network.connect();
    viem = connected.viem;
    publicClient = await viem.getPublicClient();

    const walletClients = await viem.getWalletClients();
    [deployer, receiver] = Array.from(walletClients.values());

    wanna = await deployer.deployContract("WANNA");
  });

  it("초기 발행량이 1억 WANNA인지 확인", async () => {
    const expected = parseEther("100000000");

    const totalSupply = await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "totalSupply",
    });

    const balance = await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [deployer.account.address],
    });

    assert.equal(totalSupply.toString(), expected.toString());
    assert.equal(balance.toString(), expected.toString());
  });

  it("transfer 기능 테스트", async () => {
    const amount = parseEther("100");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [receiver.account.address, amount],
    });

    const receiverBalance = await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [receiver.account.address],
    });

    assert.equal(receiverBalance.toString(), amount.toString());
  });

  it("approve 및 transferFrom 테스트", async () => {
    const amount = parseEther("50");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "approve",
      args: [receiver.account.address, amount],
    });

    const allowance = await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "allowance",
      args: [deployer.account.address, receiver.account.address],
    });

    assert.equal(allowance.toString(), amount.toString());

    await receiver.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transferFrom",
      args: [deployer.account.address, receiver.account.address, amount],
    });

    const receiverBalance = await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [receiver.account.address],
    });

    assert(receiverBalance > 0n);
  });

  it("delegate 후 getVotes 확인", async () => {
    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [deployer.account.address],
    });

    const votes = await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [deployer.account.address],
    });

    assert(votes > 0n);
  });

  it("owner가 배포자와 동일한지 확인", async () => {
    const owner = await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "owner",
    });

    assert.equal(owner.toLowerCase(), deployer.account.address.toLowerCase());
  });
});
u```
````

import { parseEther, zeroAddress } from "viem";
import { getAddress, pad, hashTypedData } from "viem/utils";

it("ERC20Permit: 서명을 통한 approve (permit)", async () => {
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1시간 후
const amount = parseEther("1000");
const chainId = await publicClient.getChainId();

const [_, user] = (await viem.getWalletClients()).values();

// permit 서명 구성
const signature = await user.signTypedData({
domain: {
name: "WANNA TOKEN",
version: "1",
chainId,
verifyingContract: wanna.address,
},
types: {
Permit: [
{ name: "owner", type: "address" },
{ name: "spender", type: "address" },
{ name: "value", type: "uint256" },
{ name: "nonce", type: "uint256" },
{ name: "deadline", type: "uint256" },
],
},
primaryType: "Permit",
message: {
owner: user.account.address,
spender: deployer.account.address,
value: amount,
nonce: 0n,
deadline,
},
});

const { r, s, v } = signature;

// permit 호출
await deployer.writeContract({
address: wanna.address,
abi: wanna.abi,
functionName: "permit",
args: [
user.account.address,
deployer.account.address,
amount,
deadline,
v,
r,
s,
],
});

// 확인
const allowance = await publicClient.readContract({
address: wanna.address,
abi: wanna.abi,
functionName: "allowance",
args: [user.account.address, deployer.account.address],
});

assert.equal(allowance.toString(), amount.toString());
});

it("ERC20Votes: delegate 및 투표 수 확인", async () => {
const [_, user] = (await viem.getWalletClients()).values();

// 토큰 일부 전송
const amount = parseEther("1000");

await deployer.writeContract({
address: wanna.address,
abi: wanna.abi,
functionName: "transfer",
args: [user.account.address, amount],
});

// 위임(delegate)
await user.writeContract({
address: wanna.address,
abi: wanna.abi,
functionName: "delegate",
args: [user.account.address],
});

// 블록 넘기기 (1블록 이상 필요할 수 있음)
const latestBlock = await publicClient.getBlock();
const currentBlockNumber = latestBlock.number;

const votes = await publicClient.readContract({
address: wanna.address,
abi: wanna.abi,
functionName: "getVotes",
args: [user.account.address],
});

assert.equal(votes.toString(), amount.toString());

// 과거 블록 기준 투표 수 확인
const pastVotes = await publicClient.readContract({
address: wanna.address,
abi: wanna.abi,
functionName: "getPastVotes",
args: [user.account.address, currentBlockNumber],
});

assert.equal(pastVotes.toString(), amount.toString());
});
