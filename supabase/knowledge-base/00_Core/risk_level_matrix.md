---
doc_type: core
category: risk_matrix
version: 1.0
last_updated: 2026-05-14
---

# Risk Level Matrix (Escalation 통합)

## 목적

운영 이슈의 위험도를 표준화하고, **위험도에 따라 자동으로 에스컬레이션 대상이 결정**되도록 한다.

원본의 Escalation Matrix(Level 0~4)는 Risk Level과 90% 중복되어 통합했다.
**Risk Level이 결정되면 Escalation 대상도 자동 결정된다.**

## 4단계 Risk Level

| Level | 정의 | 대응 시점 | 자동 에스컬레이션 |
|---|---|---|---|
| **Low** | 정상 운영 follow-up | 모니터링 | 없음 (담당자 자체 처리) |
| **Medium** | 잠재적 지연/비용/화주 우려 | **당일 내** follow-up | 운영팀 매니저 통보 |
| **High** | 확정된 지연/비용 노출/통관 이슈/클레임 가능성 | **즉시** 대응 | 팀장 / 지점장 |
| **Critical** | 법적·재무·화물 손실·중대 클레임 위험 | **즉시** 임원 보고 | CEO / Legal (Critical은 항상 임원 라인) |

## Risk Level 판단 규칙

### ETA 관련

| 조건 | Risk Level |
|---|---|
| ETA 미확정 (정상 운송 중) | Medium |
| ETA 지연 1~3일 | Medium |
| ETA 지연 3일 초과 | High |
| 화주가 end-user에게 납기 약속 완료 + ETA 변경 | High |
| 생산 라인/주요 고객 운영 영향 가능 | Critical |

### 통관 관련

| 조건 | Risk Level |
|---|---|
| 일반 서류 보완 요청 | Medium |
| 세관 추가 서류 요청 (긴급) | High |
| 세관 검사 지정 | High |
| 세관 페널티 가능성 | Critical |
| 수입 라이센스 이슈 | High |
| HS 코드 분쟁 (재분류 가능성) | High |

### 비용 관련

| 조건 | Risk Level |
|---|---|
| 사전 고지된 추가 비용 | Low |
| 사전 미고지 추가 비용 발생 | High |
| Demurrage/Detention 누적 시작 | High |
| 페널티/벌금 가능성 | Critical |
| 비용 한도 초과 (관리자 승인 필요) | High |

### 화물 관련 (Critical 기본)

| 조건 | Risk Level |
|---|---|
| 화물 손상 보고 | **Critical** |
| 화물 분실 / 단포 | **Critical** |
| 침수 / 오염 | **Critical** |
| 위험물 누출 | **Critical** |

### 파트너 응답

| 조건 | Risk Level |
|---|---|
| 12시간 이내 응답 | Low |
| 24시간 무응답 | Medium |
| 48시간 무응답 | High |
| 파트너가 책임 회피 | High |
| 파트너 정보 불일치 (반복) | High |

### 화주 클레임

| 조건 | Risk Level |
|---|---|
| 화주가 추가 정보 요청 | Low |
| 화주가 항의 표명 | Medium |
| 화주가 손해배상 언급 | High |
| 화주가 법적 조치 / 변호사 언급 | **Critical** |
| 서면 클레임 접수 | **Critical** |

## 에스컬레이션 자동 결정

Risk Level이 결정되면 다음이 **자동으로** 정해진다:

| Risk Level | 통보 대상 | 통보 방법 | 응답 기한 |
|---|---|---|---|
| Low | 담당자 본인 | 일반 채널 | 정상 업무 시간 |
| Medium | + 운영팀 매니저 | 채널 멘션 (@매니저) | 당일 내 |
| High | + 팀장 / 지점장 | 채널 멘션 + 별도 DM | 4시간 내 |
| Critical | + CEO + (필요시) 법무 자문 | 즉시 전화 + 서면 보고 | 즉시 |

## 강제 에스컬레이션 케이스

다음은 **다른 조건과 무관하게 Critical로 분류**하고 즉시 에스컬레이션한다:

1. 화물 손상·분실·침수
2. 세관 페널티 가능성
3. 화주의 법적 조치/변호사 언급
4. 파트너의 명시적 책임 회피
5. 승인 한도 초과 비용
6. 생산 라인 / 주요 고객 운영에 영향 가능한 ETA 지연
7. 서류 위조 의심
8. 결제 분쟁으로 인한 화물 보류

## 출력 규칙

Risk 평가는 반드시 다음 형식으로 출력한다:

```
Risk Level: High
Reason: 세관 검사 지정 + ETA 지연 4일 (3일 초과 기준 충족)
Possible Impact: 화주 납기 지연, demurrage 발생 가능, 잠재적 클레임
Escalation Required: Yes
Escalate To: 운영팀 팀장
Response Deadline: 4시간 내
```

## Risk Level 판단 시 주의

- **여러 조건 중 가장 높은 Level**을 적용한다 (Low + High = High)
- 추정 기반 Risk는 한 단계 낮춰서 표시 + "추정" 명시
- 화주가 직접 언급한 우려는 무시하지 않는다 (Medium 이상)
- 불확실하면 **상향 분류** (under-classify보다 over-classify가 안전)
