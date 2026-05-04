"""
FBX (Freightos Baltic Index) 스크래퍼
출처: https://www.freightos.com/enterprise/terminal/fbx-01-china-to-north-america-west-coast/

robots.txt 및 이용약관 확인 권장:
  https://www.freightos.com/robots.txt
  https://www.freightos.com/terms-of-service/

공식 FBX API 대안: https://fbx.freightos.com/
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup

from route_map import ROUTE_MAP, ROUTE_ORDER

# ── 상수 ──────────────────────────────────────────────────────────────
TARGET_URL = (
    "https://www.freightos.com/enterprise/terminal/"
    "fbx-01-china-to-north-america-west-coast/"
)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}
MAX_RETRIES = 3

# ── 로깅 설정 ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── 1차: requests ─────────────────────────────────────────────────────
def fetch_with_requests(url: str) -> Optional[str]:
    """
    requests + 지수 백오프 3회 재시도.
    성공하면 HTML 문자열, 실패하면 None.
    """
    import requests  # 런타임 import (playwright 전용 실행 시 불필요)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            resp.raise_for_status()
            logger.info(f"[requests] 성공 (HTTP {resp.status_code})")
            return resp.text
        except requests.exceptions.HTTPError as e:
            logger.warning(f"[requests] HTTP 오류 {e} (시도 {attempt}/{MAX_RETRIES})")
        except requests.exceptions.RequestException as e:
            logger.warning(f"[requests] 연결 오류 {e} (시도 {attempt}/{MAX_RETRIES})")

        if attempt < MAX_RETRIES:
            wait = 2 ** attempt
            logger.info(f"[requests] {wait}초 후 재시도...")
            time.sleep(wait)

    logger.error("[requests] 모든 재시도 실패")
    return None


# ── 2차: playwright 폴백 ──────────────────────────────────────────────
def fetch_with_playwright(url: str) -> Optional[str]:
    """
    JS 렌더링이 필요한 경우의 폴백.
    playwright install chromium 을 먼저 실행해야 한다.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.error("[playwright] 미설치: pip install playwright && playwright install chromium")
        return None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(extra_http_headers=HEADERS)
                page.goto(url, timeout=30_000, wait_until="networkidle")
                # 티커가 렌더링될 때까지 대기
                page.wait_for_selector(
                    ".fr-product-intro__ticker-item", timeout=15_000
                )
                html = page.content()
                browser.close()
                logger.info("[playwright] 성공")
                return html
        except Exception as e:
            logger.warning(f"[playwright] 오류 {e} (시도 {attempt}/{MAX_RETRIES})")
            if attempt < MAX_RETRIES:
                time.sleep(2 ** attempt)

    logger.error("[playwright] 모든 재시도 실패")
    return None


# ── 파싱 ──────────────────────────────────────────────────────────────
def parse_ticker(html: str) -> list[dict]:
    """
    HTML에서 FBX 티커 항목을 추출한다.
    - 중복 제거 (ticker는 애니메이션을 위해 항목을 2회 복제)
    - ROUTE_ORDER 순서로 정렬
    """
    soup = BeautifulSoup(html, "lxml")
    items_raw = soup.select("span.fr-product-intro__ticker-item")

    if not items_raw:
        logger.error("티커 항목을 하나도 찾지 못했습니다. JS 렌더링이 필요할 수 있습니다.")
        return []

    seen: set[str] = set()
    raw: dict[str, dict] = {}

    for item in items_raw:
        label_el  = item.select_one(".fr-product-intro__ticker-item-label")
        value_el  = item.select_one(".fr-product-intro__ticker-item-value")
        change_el = item.select_one(".fr-product-intro__ticker-item-change")

        if not (label_el and value_el and change_el):
            continue

        code = label_el.get_text(strip=True).rstrip(":")
        if code in seen:
            continue  # 중복 제거
        seen.add(code)

        if code not in ROUTE_MAP:
            logger.warning(f"ROUTE_MAP에 없는 코드 스킵: {code!r}")
            continue

        raw[code] = {
            "code":   code,
            "route":  ROUTE_MAP[code],
            "value":  value_el.get_text(strip=True),
            "change": change_el.get_text(strip=True),
        }

    # ROUTE_ORDER 순서로 정렬
    result = [raw[c] for c in ROUTE_ORDER if c in raw]

    missing = [c for c in ROUTE_ORDER if c not in raw]
    if missing:
        logger.warning(f"누락된 항로: {missing}")

    logger.info(f"추출 완료: {len(result)}/12 항로")
    return result


# ── JSON 저장 ──────────────────────────────────────────────────────────
def save_json(data: list[dict], output_dir: str) -> None:
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    filename = f"fbx_{now.strftime('%Y-%m-%d')}.json"
    path = Path(output_dir) / filename
    path.parent.mkdir(parents=True, exist_ok=True)

    payload = {
        "scraped_at": now.isoformat(),
        "source_url": TARGET_URL,
        "data": data,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"JSON 저장: {path.resolve()}")


# ── 메인 ──────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="FBX 운임지수 스크래퍼")
    parser.add_argument(
        "--save", action="store_true", help="JSON 파일로 저장"
    )
    parser.add_argument(
        "--output", default=".", metavar="DIR", help="JSON 저장 경로 (기본: 현재 디렉터리)"
    )
    parser.add_argument(
        "--force-playwright", action="store_true",
        help="requests를 건너뛰고 바로 playwright 사용"
    )
    args = parser.parse_args()

    html: Optional[str] = None

    if not args.force_playwright:
        logger.info("1차 시도: requests")
        html = fetch_with_requests(TARGET_URL)

    if html is None:
        logger.info("2차 시도: playwright 폴백")
        html = fetch_with_playwright(TARGET_URL)

    if html is None:
        logger.error("HTML을 가져오지 못했습니다. 종료합니다.")
        sys.exit(1)

    data = parse_ticker(html)

    if not data:
        logger.error("파싱된 항목이 없습니다. 종료합니다.")
        sys.exit(1)

    # 콘솔 출력
    print()
    for item in data:
        print(f"{item['code']} {item['route']}: {item['value']} {item['change']}")
    print()

    if args.save:
        save_json(data, args.output)


if __name__ == "__main__":
    main()
