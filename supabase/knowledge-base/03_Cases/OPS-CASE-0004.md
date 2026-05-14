---
doc_type: case
case_id: OPS-CASE-0004
domain: operations
issue_type: TRANSIT_DELAY
secondary_issue_type: BORDER_ISSUE
region: CIS
mode: sea-rail
cargo_type: general
risk_level: medium
status: resolved
route: "Korea → Qingdao → CIS"
last_updated: 2026-05-14
owner: operations_team
source: delay3.md
---

# Case OPS-CASE-0004 — WJ 에이전트 일반화물 철도 운송 계획 중단 통보 + GPS 금지 규칙

## 1. Case Summary

WJ 에이전트(Ning)로부터 일반화물 철도 운송 계획이 현재 없다는 통보와 함께, 대안 루트(올트럭 또는 Kashgar 경유 트럭) 제안 및 GPS 장치 컨테이너 내외부 부착 금지 규정 공지 수신.

## 2. Route

- KR → Qingdao → CIS (일반화물 철도 구간)

## 3. Problem

WJ 에이전트로부터 현재 일반화물 철도 운송 계획 없음 통보.

## 4. Root Cause

### Confirmed Cause
- OPS-CASE-0002와 동일한 대규모 적체로 인한 일반화물 운송 계획 중단

## 5. Actions Taken

| Step | Action | Responsible | Result |
|---|---|---|---|
| 1 | 대안 루트 검토 | 운영팀 | 올트럭 또는 Kashgar 경유 트럭 옵션 |
| 2 | 화주에게 상황 안내 및 대안 제시 | 운영팀 | 진행 |

## 6. Customer Communication

현재 일반화물 철도 운송 계획이 없는 상황으로, 두 가지 대안을 제안드립니다:
1) 올트럭 운송
2) 철도 Kashgar 구간 + 목적지까지 트럭 운송
각 옵션의 비용과 리드타임 확인 후 안내드리겠습니다.

## 7. Final Result

대안 루트로 전환 (구체적 결과 미기록)

## 8. Lesson Learned

- 일반화물 TCR 진행 시 대안 루트(올트럭/Kashgar 트럭) 비용을 항상 미리 파악
- 적체 시 즉시 대안 제시 가능하도록 준비

## 9. New SOP Rule

> TCR 일반화물 발차 불가 통보 시:
> 즉시 다음 대안 비용/리드타임 확인 후 화주 제시:
> 1) 올트럭 (All Truck)
> 2) 철도 Kashgar + 트럭 (현지 운송사)

---

## ⚠️ 추가 규칙 공지 (GPS 금지)

**WJ 에이전트 Ning이 공지한 규정 (2026-05-12):**

```
GPS 또는 기타 전자 추적 장치 컨테이너 내외부 부착 절대 금지.
발견 시 역측에서 컨테이너 홀딩 조치.
```

**필수 작업사진 (WJ 기준):**
1. 공컨테이너
2. 절반 적재 (cargo 1/2)
3. 문 열린 상태 풀 적재
4. 오른쪽 문만 닫은 상태 (왼쪽 오픈)
5. 씰 봉인 완료 양문 닫은 사진

## 13. Tags

`#wj_agent` `#general_cargo` `#railway_plan_suspended` `#gps_prohibited`
`#transit_delay` `#alternative_route`
