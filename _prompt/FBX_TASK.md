# 작업: Freightos FBX 운임지수 스크래퍼 작성

## 목적
Freightos Terminal 사이트의 상단 ticker에서 FBX(Freightos Baltic Index) 12개 항로의
운임지수, 변동률을 주기적으로 스크래핑해 한글 항로명과 함께 출력하는 Python 스크립트를 작성한다.

## 대상 URL
https://www.freightos.com/enterprise/terminal/fbx-01-china-to-north-america-west-coast/

## 스크래핑 대상 HTML 구조
페이지 상단의 `div.fr-product-intro__ticker-content` 안에 다음과 같은 항목이 반복된다.
ticker 애니메이션을 위해 동일 항목이 2번 복제되어 있으므로 **중복 제거 필수**.

```html
<span class="fr-product-intro__ticker-item">
  <span class="fr-product-intro__ticker-item-label">FBX01:</span>
  <span class="fr-product-intro__ticker-item-value">$3,456</span>
  <span class="fr-product-intro__ticker-item-change fr-product-intro__ticker-item-change--positive">+2.3%</span>
</span>
```

## 요구사항

### 1. 기술 스택
- Python 3.10+
- 1차 시도: `requests` + `beautifulsoup4` (정적 렌더링이면 충분)
- 1차가 실패하면(403 / 빈 결과) `playwright` 폴백 구현
- User-Agent는 일반 브라우저로 설정

### 2. 추출할 데이터
각 항목에서 아래 3가지를 추출:
- label (예: "FBX01:")
- value (예: "$3,456")
- change (예: "+2.3%")

### 3. 라벨 매핑
FBX 코드를 한글 항로명으로 변환하는 dict를 코드 상단에 상수로 정의:

| 코드 | 한글 항로명 |
|---|---|
| FBX01 | 중국 - 북미서안 |
| FBX02 | 북미서안 - 중국 |
| FBX03 | 중국 - 북미동안 |
| FBX04 | 북미동안 - 중국 |
| FBX11 | 중국 - 북유럽 |
| FBX12 | 북유럽 - 중국 |
| FBX13 | 중국 - 지중해 |
| FBX14 | 지중해 - 중국 |
| FBX21 | 북미동안 - 북유럽 |
| FBX22 | 북유럽 - 북미동안 |
| FBX24 | 유럽 - 남미동안 |
| FBX26 | 유럽 - 남미서안 |

### 4. 출력 형식
콘솔 출력 + JSON 파일 저장 둘 다 지원:

콘솔:
```
FBX01 중국 - 북미서안: $2,675 +0.85%
FBX02 북미서안 - 중국: $436 -9.76%
...
```

JSON (`fbx_YYYY-MM-DD.json`):
```json
{
  "scraped_at": "2026-05-05T14:30:00+09:00",
  "source_url": "https://...",
  "data": [
    {"code": "FBX01", "route": "중국 - 북미서안", "value": "$2,675", "change": "+0.85%"},
    ...
  ]
}
```

### 5. 정렬 규칙
사이트의 ticker는 애니메이션 때문에 시작 위치가 매번 다를 수 있다.
ROUTE_MAP 정의 순서대로 항상 정렬해서 출력한다.

### 6. 예외 처리
- HTTP 오류(타임아웃, 403, 5xx): 재시도 3회 (지수 백오프)
- ticker 항목을 하나도 못 찾은 경우: 명확한 에러 메시지와 함께 종료
- ROUTE_MAP에 없는 코드(예: 글로벌 "FBX:")는 경고 로그만 남기고 스킵
- 12개 중 누락된 항목이 있으면 경고

### 7. 코드 구조
```
fbx_scraper/
├── scraper.py          # 메인 스크래핑 로직
├── route_map.py        # ROUTE_MAP 상수
├── requirements.txt
└── README.md           # 사용법, cron 등록 예시 포함
```

함수 분리:
- `fetch_with_requests(url) -> str | None`
- `fetch_with_playwright(url) -> str | None` (폴백)
- `parse_ticker(html: str) -> list[dict]`
- `save_json(data: list[dict], path: str) -> None`
- `main()`

### 8. CLI 옵션
```bash
python scraper.py                    # 콘솔 출력만
python scraper.py --save             # JSON 파일도 저장
python scraper.py --output ./data    # 저장 경로 지정
python scraper.py --force-playwright # requests 건너뛰고 바로 playwright
```

`argparse` 사용.

### 9. 로깅
`logging` 모듈로 INFO/WARNING/ERROR 레벨 구분.
print 대신 logger 사용 (단, 최종 출력은 print 유지).

## 검증 기준 (이거 다 통과해야 완료)
1. 정확히 12개 항로가 추출되어야 한다 (중복 제거 후)
2. 출력 순서는 항상 ROUTE_MAP 정의 순서와 일치해야 한다
3. `--save` 옵션으로 생성된 JSON이 유효한 JSON이어야 한다
4. requests가 막혀도 playwright 폴백이 동작해야 한다
5. README의 사용 예시 그대로 실행했을 때 동작해야 한다

## 작업 순서 제안
1. 가상환경 생성 + requirements.txt 작성
2. `route_map.py`부터 작성
3. `requests` 버전 먼저 만들고 실제로 한 번 돌려서 12개 잡히는지 확인
4. 안 잡히면 그때 playwright 추가 (미리 만들지 말 것)
5. CLI/로깅/예외처리 붙이기
6. README 작성

## 참고
- 운임지수는 보통 주 1회(금요일) 갱신되므로 매분 돌릴 필요 없다.
  README에 "매주 토요일 새벽 cron 실행" 예시를 포함해줘.
- robots.txt와 이용약관은 확인 권장 (코드 주석에 명시)
- Freightos 공식 [FBX 데이터 API](https://fbx.freightos.com/)도 있다는 사실을
  README의 "장기적으로 고려할 대안" 섹션에 한 줄 적어줘.
