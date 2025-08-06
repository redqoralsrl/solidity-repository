npm install

npx hardhat clean

npx hardhat compile

npx hardhat test

// governance 상태 종류
| 상태 | 설명 |
| --------------- | -------------------------------------------------------------------- |
| `Pending` (0) | 제안이 제출됐지만 아직 투표 시작 전 (votingDelay 기간 대기 중) |
| `Active` (1) | 투표가 진행 중인 상태 (votingPeriod 안에 있음) |
| `Canceled` (2) | 제안이 `cancel()`로 취소됨 |
| `Defeated` (3) | 투표 종료 후, 찬성표 부족 등으로 부결됨 |
| `Succeeded` (4) | 투표 통과 (quorum 충족 + 찬성표 과반) → Timelock 대기 중 |
| `Queued` (5) | Timelock 큐에 등록됨 (`queue()` 실행됨) |
| `Expired` (6) | Timelock 큐에 등록되었지만, 일정 시간 내 `execute()`되지 않아 만료됨 |
| `Executed` (7) | 제안이 성공적으로 실행됨 (`execute()` 완료됨) |
