# FBX 운임지수 스크래퍼

Freightos Baltic Index(FBX) 12개 항로의 운임지수·변동률을 스크래핑하는 Python 스크립트.

## 요구사항

- Python 3.10+
- `pip install -r requirements.txt`

playwright 폴백을 쓸 경우 추가 설치 필요:

```bash
playwright install chromium
```

## 사용법

```bash
# 콘솔 출력만
python scraper.py

# JSON 파일도 저장 (fbx_YYYY-MM-DD.json)
python scraper.py --save

# 저장 경로 지정
python scraper.py --save --output ./data

# playwright 즉시 사용 (requests 생략)
python scraper.py --force-playwright
```

## 출력 예시

```
FBX01 중국 - 북미서안: $2,675 +0.85%
FBX02 북미서안 - 중국: $436 -9.76%
FBX03 중국 - 북미동안: $3,102 +1.20%
...
```

JSON 파일(`fbx_2026-05-05.json`):

```json
{
  "scraped_at": "2026-05-05T14:30:00+09:00",
  "source_url": "https://www.freightos.com/enterprise/terminal/...",
  "data": [
    {"code": "FBX01", "route": "중국 - 북미서안", "value": "$2,675", "change": "+0.85%"},
    ...
  ]
}
```

## cron 등록 (매주 토요일 새벽 2시 실행)

FBX 운임지수는 보통 금요일에 갱신되므로 토요일 새벽에 실행하면 최신값을 얻을 수 있다.

```cron
0 2 * * 6 cd /path/to/fbx_scraper && /usr/bin/python3 scraper.py --save --output /path/to/data >> /var/log/fbx_scraper.log 2>&1
```

Windows Task Scheduler를 쓴다면:

```
프로그램: C:\Python312\python.exe
인수: C:\path\to\fbx_scraper\scraper.py --save --output C:\path\to\data
트리거: 매주 토요일 02:00
```

## 동작 방식

1. `requests`로 Freightos Terminal 페이지 HTML 요청 (3회 재시도, 지수 백오프)
2. BeautifulSoup으로 `.fr-product-intro__ticker-item` 블록 파싱
3. 티커 애니메이션 중복 제거 → ROUTE_MAP 순서로 정렬
4. `requests`가 실패(403 / 빈 결과)하면 playwright 폴백으로 JS 렌더링 후 재파싱

## 장기적으로 고려할 대안

Freightos 공식 FBX 데이터 API(`https://fbx.freightos.com/`)를 이용하면 스크래핑 없이 안정적으로 데이터를 얻을 수 있다.
