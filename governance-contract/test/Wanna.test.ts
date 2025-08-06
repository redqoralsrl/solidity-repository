import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { parseEther } from "viem";
import { network } from "hardhat";

let viem: Awaited<ReturnType<typeof network.connect>>["viem"];
let publicClient: Awaited<ReturnType<typeof viem.getPublicClient>>;
let deployer: any;

describe("WANNA", () => {
  let wanna: any;

  before(async () => {
    const connected = await network.connect();
    viem = connected.viem;
    publicClient = await viem.getPublicClient();

    const walletClients = await viem.getWalletClients();
    [deployer] = walletClients.values();

    wanna = await viem.deployContract("WANNA");
  });

  it("ERC20 - 초기 발행량이 1억 WANNA인지 확인", async () => {
    const totalSupply = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "totalSupply",
      args: [],
    })) as bigint;

    const balance = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [deployer.account.address],
    })) as bigint;

    const expectedAmount = parseEther("100000000");

    assert.equal(totalSupply.toString(), expectedAmount.toString());
    assert.equal(balance.toString(), expectedAmount.toString());
  });

  it("ERC20 - transfer 기능 테스트 확인", async () => {
    const [_, receiver] = (await viem.getWalletClients()).values();
    const amount = parseEther("100");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [receiver.account.address, amount],
    });

    const receiverBalance = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(receiverBalance.toString(), amount.toString());
  });

  it("ERC20 - approve 및 transform 테스트 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const [_, receiver] = (await viem.getWalletClients()).values();
    const amount = parseEther("50");

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [receiver.account.address, amount],
    });

    const receiverBalance = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(receiverBalance.toString(), amount.toString());

    await receiver.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "approve",
      args: [deployer.account.address, amount],
    });

    const allowance = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "allowance",
      args: [receiver.account.address, deployer.account.address],
    })) as bigint;

    assert.equal(allowance.toString(), amount.toString());

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transferFrom",
      args: [receiver.account.address, deployer.account.address, amount],
    });

    const receiverAfterBalance = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [receiver.account.address],
    })) as bigint;

    assert.equal(receiverAfterBalance.toString(), "0");

    const expectedAmount = parseEther("100000000");

    const receiverAfterDeployerBalance = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [deployer.account.address],
    })) as bigint;

    assert.equal(
      expectedAmount.toString(),
      receiverAfterDeployerBalance.toString()
    );
  });

  it("ERC20Permit - 서명 approve 테스트 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user] = (await viem.getWalletClients()).values();

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1시간 후
    const chainId = await publicClient.getChainId();

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

    const r = `0x${signature.slice(2).slice(0, 64)}`;
    const s = `0x${signature.slice(2).slice(64, 128)}`;
    const v = parseInt(signature.slice(2).slice(128, 130), 16);

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

    const allowance = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "allowance",
      args: [user.account.address, deployer.account.address],
    })) as bigint;

    assert.equal(allowance.toString(), amount.toString());
  });

  it("ERC20Permit - permit은 서명 1회만 유효하며 중복 호출 시 실패 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user] = (await viem.getWalletClients()).values();

    const chainId = await publicClient.getChainId();
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

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
        nonce: 0n, // 최초 nonce
        deadline,
      },
    });

    const r = `0x${signature.slice(2, 66)}`;
    const s = `0x${signature.slice(66, 130)}`;
    const v = parseInt(signature.slice(130, 132), 16);

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

    await assert.rejects(async () => {
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
    });
  });

  it("ERC20Permit - permit 과거 만료된 서명은 실패 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user] = (await viem.getWalletClients()).values();

    const chainId = await publicClient.getChainId();
    const nonce = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "nonces",
      args: [user.account.address],
    })) as bigint;

    const deadline = BigInt(Math.floor(Date.now() / 1000) - 60);

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
        nonce,
        deadline,
      },
    });

    const r = `0x${signature.slice(2, 66)}`;
    const s = `0x${signature.slice(66, 130)}`;
    const v = parseInt(signature.slice(130, 132), 16);

    await assert.rejects(async () => {
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
    }, /ERC20Permit: expired deadline/);
  });

  it("ERC20Permit - permit 서명 후 시간 지난 값은 실패 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user] = (await viem.getWalletClients()).values();

    const chainId = await publicClient.getChainId();
    const nonce = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "nonces",
      args: [user.account.address],
    })) as bigint;

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 60); // 1분 뒤 만료

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
        nonce,
        deadline,
      },
    });

    const r = `0x${signature.slice(2, 66)}`;
    const s = `0x${signature.slice(66, 130)}`;
    const v = parseInt(signature.slice(130, 132), 16);

    await publicClient.transport.request({
      method: "evm_increaseTime",
      params: [60],
    });
    await publicClient.transport.request({
      method: "evm_mine",
    });

    await assert.rejects(async () => {
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
    }, /ERC20Permit: expired deadline/);
  });

  it("ERC20Permit - permit 후 transferFrom 정상 동작 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user] = (await viem.getWalletClients()).values();

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user.account.address, amount],
    });

    const chainId = await publicClient.getChainId();
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

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
        nonce: 0n, // 최초 nonce
        deadline,
      },
    });

    const r = `0x${signature.slice(2, 66)}`;
    const s = `0x${signature.slice(66, 130)}`;
    const v = parseInt(signature.slice(130, 132), 16);

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

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transferFrom",
      args: [user.account.address, deployer.account.address, amount],
    });

    const userBalance = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [user.account.address],
    })) as bigint;

    const deployerBalance = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "balanceOf",
      args: [deployer.account.address],
    })) as bigint;

    const totalSupply = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "totalSupply",
      args: [],
    })) as bigint;

    assert.equal(userBalance.toString(), "0");
    assert.equal(deployerBalance.toString(), totalSupply.toString());
  });

  it("ERC20Votes - delegate 투표권 반영 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user] = (await viem.getWalletClients()).values();

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user.account.address, amount],
    });

    await user.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    const votes = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user.account.address],
    })) as bigint;

    assert.equal(votes.toString(), amount.toString());
  });

  it("ERC20Votes - getPastVotes로 과거 블록 기준 투표권 조회 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user] = (await viem.getWalletClients()).values();

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user.account.address, amount],
    });

    const blockBefore = await publicClient.getBlockNumber();

    await user.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user.account.address],
    });

    await publicClient.transport.request({
      method: "evm_mine",
    });

    const votesNow = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user.account.address],
    })) as bigint;

    const votesPast = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getPastVotes",
      args: [user.account.address, blockBefore],
    })) as bigint;

    assert.equal(votesNow.toString(), amount.toString());
    assert.equal(votesPast.toString(), "0");
  });

  it("ERC20Votes - delegate() 위임 테스트 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user, delegatee] = (await viem.getWalletClients()).values();

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user.account.address, amount],
    });

    await user.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [delegatee.account.address],
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const votes = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [delegatee.account.address],
    })) as bigint;

    assert.equal(votes.toString(), amount.toString());

    const votesUser = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user.account.address],
    })) as bigint;

    assert.equal(votesUser.toString(), "0");
  });

  it("ERC20Votes - delegate 이후 토큰 전송 시 위임된 투표권 감소 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const transferAmount = parseEther("600");

    const [_, user, recipient] = (await viem.getWalletClients()).values();

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user.account.address, amount],
    });

    await user.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegate",
      args: [user.account.address],
    });

    await publicClient.transport.request({ method: "evm_mine" });

    let votes = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user.account.address],
    })) as bigint;

    assert.equal(votes.toString(), amount.toString());

    await user.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [recipient.account.address, transferAmount],
    });

    await publicClient.transport.request({ method: "evm_mine" });

    votes = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user.account.address],
    })) as bigint;

    assert.equal(votes.toString(), parseEther("400").toString());
  });

  it("ERC20Votes - delegateBySig() 위임 정상 작동 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user, delegatee] = (await viem.getWalletClients()).values();

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user.account.address, amount],
    });

    const nonce = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "nonces",
      args: [user.account.address],
    })) as bigint;

    const chainId = await publicClient.getChainId();
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

    const signature = await user.signTypedData({
      domain: {
        name: "WANNA TOKEN",
        version: "1",
        chainId,
        verifyingContract: wanna.address,
      },
      types: {
        Delegation: [
          { name: "delegatee", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "expiry", type: "uint256" },
        ],
      },
      primaryType: "Delegation",
      message: {
        delegatee: delegatee.account.address,
        nonce,
        expiry: deadline,
      },
    });

    const r = `0x${signature.slice(2, 66)}`;
    const s = `0x${signature.slice(66, 130)}`;
    const v = parseInt(signature.slice(130, 132), 16);

    await delegatee.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegateBySig",
      args: [delegatee.account.address, nonce, deadline, v, r, s],
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const userVotes = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [user.account.address],
    })) as bigint;

    assert.equal(userVotes.toString(), "0");

    const votes = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [delegatee.account.address],
    })) as bigint;

    assert.equal(votes.toString(), amount.toString());
  });

  it("ERC20Votes - delegateBySig()로 위임 후 토큰 전송하면 위임 토큰 제거 되는지 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user, delegatee] = (await viem.getWalletClients()).values();

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user.account.address, amount],
    });

    const nonce = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "nonces",
      args: [user.account.address],
    })) as bigint;

    const chainId = await publicClient.getChainId();
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

    const signature = await user.signTypedData({
      domain: {
        name: "WANNA TOKEN",
        version: "1",
        chainId,
        verifyingContract: wanna.address,
      },
      types: {
        Delegation: [
          { name: "delegatee", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "expiry", type: "uint256" },
        ],
      },
      primaryType: "Delegation",
      message: {
        delegatee: delegatee.account.address,
        nonce,
        expiry: deadline,
      },
    });

    const r = `0x${signature.slice(2, 66)}`;
    const s = `0x${signature.slice(66, 130)}`;
    const v = parseInt(signature.slice(130, 132), 16);

    await delegatee.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegateBySig",
      args: [delegatee.account.address, nonce, deadline, v, r, s],
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const votes = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [delegatee.account.address],
    })) as bigint;

    assert.equal(votes.toString(), amount.toString());

    await user.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [deployer.account.address, amount],
    });

    const afterVotes = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [delegatee.account.address],
    })) as bigint;

    assert.equal(afterVotes.toString(), "0");
  });

  it("ERC20Votes - delegateBySig() 같은 서명으로 재사용 시 실패 확인", async () => {
    wanna = await viem.deployContract("WANNA");

    const amount = parseEther("1000");
    const [_, user, delegatee] = (await viem.getWalletClients()).values();

    await deployer.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "transfer",
      args: [user.account.address, amount],
    });

    const nonce = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "nonces",
      args: [user.account.address],
    })) as bigint;

    const chainId = await publicClient.getChainId();
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

    const signature = await user.signTypedData({
      domain: {
        name: "WANNA TOKEN",
        version: "1",
        chainId,
        verifyingContract: wanna.address,
      },
      types: {
        Delegation: [
          { name: "delegatee", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "expiry", type: "uint256" },
        ],
      },
      primaryType: "Delegation",
      message: {
        delegatee: delegatee.account.address,
        nonce,
        expiry: deadline,
      },
    });

    const r = `0x${signature.slice(2, 66)}`;
    const s = `0x${signature.slice(66, 130)}`;
    const v = parseInt(signature.slice(130, 132), 16);

    await delegatee.writeContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "delegateBySig",
      args: [delegatee.account.address, nonce, deadline, v, r, s],
    });

    await publicClient.transport.request({ method: "evm_mine" });

    const votes = (await publicClient.readContract({
      address: wanna.address,
      abi: wanna.abi,
      functionName: "getVotes",
      args: [delegatee.account.address],
    })) as bigint;

    assert.equal(votes.toString(), amount.toString());

    await assert.rejects(async () => {
      await delegatee.writeContract({
        address: wanna.address,
        abi: wanna.abi,
        functionName: "delegateBySig",
        args: [delegatee.account.address, nonce, deadline, v, r, s],
      });
    }, /ERC20Votes: invalid nonce/);
  });
});
