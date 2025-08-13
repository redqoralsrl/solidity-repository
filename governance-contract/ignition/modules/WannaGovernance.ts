import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("WannaGovernanceModule", (m) => {
  // 1. WANNA 토큰 배포
  const wanna = m.contract("WANNA");

  // 2. TimelockController 배포
  const minDelay = 3600n; // 1시간
  const deployer = m.getAccount(0); // 기본 계정 (테스트 시 deployer.account.address와 동일)
  const proposers = [deployer];
  const executors = [deployer];

  const timelock = m.contract("TimelockController", [
    minDelay,
    proposers,
    executors,
    deployer,
  ]);

  // 3. WannaGovernance 배포 (token, timelock)
  const governor = m.contract("WannaGovernance", [wanna, timelock]);

  // 4. timelock.setRoleAdmin(governor.address, governor.address) 호출
  m.call(timelock, "setRoleAdmin", [[governor], [governor]]);

  return { wanna, timelock, governor };
});
