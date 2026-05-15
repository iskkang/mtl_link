"""
중국 HS-code CSV → Supabase knowledge_base RAG 적재 스크립트
한국 KB(hs_code_kr)에서 6자리별 한/영 키워드를 끌어와 임베딩 텍스트 보강
실행: python scripts/load_hs_code_cn.py
재실행 시 이미 적재된 항목은 건너뜀 (체크포인트 방식)
"""
import os
import sys
import csv
import json
import time

import httpx
from openai import OpenAI
from tqdm import tqdm
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')

load_dotenv('.env.local')
load_dotenv('.env')

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
OPENAI_KEY   = os.getenv('OPENAI_API_KEY')

if not SUPABASE_URL:
    sys.exit('SUPABASE_URL 또는 VITE_SUPABASE_URL 환경변수 필요')
if not SUPABASE_KEY:
    sys.exit('SUPABASE_SERVICE_ROLE_KEY 환경변수 필요')
if not OPENAI_KEY:
    sys.exit('OPENAI_API_KEY 환경변수 필요')

openai_client = OpenAI(api_key=OPENAI_KEY)

HEADERS = {
    'apikey':        SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
}
REST_URL = f'{SUPABASE_URL}/rest/v1/knowledge_base'

CSV_PATH   = 'supabase/knowledge-base/10_Data/cn_hs_parsed.csv'
BATCH_SIZE = 20
MODEL      = 'text-embedding-3-small'


# ── Supabase 헬퍼 ─────────────────────────────────────────────────────────────

def sb_insert(rows: list[dict]):
    h = {**HEADERS, 'Prefer': 'resolution=ignore-duplicates,return=minimal'}
    resp = httpx.post(REST_URL, headers=h, content=json.dumps(rows), timeout=90)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f'Insert {resp.status_code}: {resp.text[:300]}')


def sb_get_existing_filenames() -> set[str]:
    page_size = 1000
    offset = 0
    result = set()
    print('기존 적재 항목 조회 중...')
    while True:
        h = {**HEADERS, 'Prefer': 'return=representation'}
        resp = httpx.get(
            f'{REST_URL}?doc_type=eq.hs_code_cn&select=filename'
            f'&limit={page_size}&offset={offset}',
            headers=h, timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break
        result.update(r['filename'] for r in data)
        offset += page_size
        if len(data) < page_size:
            break
    print(f'  기존 {len(result)}개 항목 확인')
    return result


def sb_count(doc_type: str) -> int:
    h = {**HEADERS, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0'}
    resp = httpx.get(f'{REST_URL}?doc_type=eq.{doc_type}&select=id', headers=h, timeout=30)
    return int(resp.headers.get('content-range', '0/0').split('/')[-1])


# ── 한국 KB에서 6자리별 키워드 매핑 ──────────────────────────────────────────

def fetch_kr_mappings() -> dict[str, dict]:
    """
    knowledge_base(doc_type='hs_code_kr')에서 6자리 코드별
    한글품목명·영문품목명·분류 집합을 반환.
    형식: {'0104.10': {'ko_names': {'...', ...}, 'en_names': {...}, 'classifications': {...}}}
    """
    page_size = 1000
    offset = 0
    mappings: dict[str, dict] = {}
    print('한국 KB에서 6자리 키워드 매핑 추출 중...')

    while True:
        h = {**HEADERS, 'Prefer': 'return=representation'}
        resp = httpx.get(
            f'{REST_URL}?doc_type=eq.hs_code_kr&select=hs_code_6digit,content'
            f'&limit={page_size}&offset={offset}',
            headers=h, timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data:
            break

        for row in data:
            code_6  = row.get('hs_code_6digit')
            content = row.get('content', '')
            if not code_6:
                continue

            ko_name = en_name = classification = ''
            for line in content.split('\n'):
                if line.startswith('한글품목명:'):
                    ko_name = line[7:].strip()
                elif line.startswith('영문품목명:'):
                    en_name = line[7:].strip()
                elif line.startswith('분류:'):
                    classification = line[3:].strip()

            entry = mappings.setdefault(code_6, {
                'ko_names': set(), 'en_names': set(), 'classifications': set(),
            })
            if ko_name:        entry['ko_names'].add(ko_name)
            if en_name:        entry['en_names'].add(en_name)
            if classification: entry['classifications'].add(classification)

        offset += page_size
        if len(data) < page_size:
            break

    print(f'  추출 완료: {len(mappings)}개 6자리 코드 매핑')
    return mappings


# ── 청크 빌더 ─────────────────────────────────────────────────────────────────

def build_chunk(row: dict, kr_mappings: dict[str, dict]) -> dict:
    hs_full = row['hs_code_cn']       # '0104.1090'
    hs_6    = row['hs_code_6digit']   # '0104.10'
    name_cn = row.get('name_cn', '') or ''
    mfn     = row.get('mfn_rate', '') or ''
    kr_fta  = row.get('kr_fta_rate', '') or ''
    general = row.get('general_rate', '') or ''

    kr_data  = kr_mappings.get(hs_6, {})
    ko_names        = sorted(kr_data.get('ko_names', set()))[:3]
    en_names        = sorted(kr_data.get('en_names', set()))[:3]
    classifications = sorted(kr_data.get('classifications', set()))[:2]

    lines = [
        f'HS-code: {hs_full} [중국 HS 8자리]',
        f'국제 공통 코드(6자리): {hs_6}',
        f'중문 품명: {name_cn}',
    ]
    if ko_names:        lines.append(f'한글 관련 품명: {", ".join(ko_names)}')
    if en_names:        lines.append(f'영문 관련 품명: {", ".join(en_names)}')
    if classifications: lines.append(f'분류: {", ".join(classifications)}')
    lines.append('')
    if mfn:     lines.append(f'MFN 세율(최혜국): {mfn}')
    if kr_fta:  lines.append(f'한국 협정세율: {kr_fta}')
    if general: lines.append(f'일반세율: {general}')
    lines += ['', '출처: 中华人民共和国进出口税则 2026']

    content = '\n'.join(lines)

    # 임베딩용 텍스트: 한/영 키워드를 앞에 배치해 검색성 강화
    if ko_names or en_names:
        prefix = ', '.join(ko_names + en_names)
        embed_text = f'{prefix}\n{content}'
    else:
        embed_text = content

    filename = f'HSK_CN_{hs_full.replace(".", "_")}'

    return {
        'filename':       filename,
        'chunk_index':    0,
        'content':        content,       # DB 저장용
        '_embed_text':    embed_text,    # 임베딩 전용 (DB 미저장)
        'hs_code_full':   hs_full,
        'hs_code_6digit': hs_6,
        'country_code':   'CN',
        'doc_type':       'hs_code_cn',
        'status':         'verified',
    }


# ── 임베딩 ────────────────────────────────────────────────────────────────────

def embed_batch(texts: list[str]) -> list[list[float]]:
    response = openai_client.embeddings.create(model=MODEL, input=texts)
    return [d.embedding for d in response.data]


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    # 1. 한국 KB 키워드 매핑
    kr_mappings = fetch_kr_mappings()

    # 2. 중국 CSV 읽기
    print(f'\nCSV 읽는 중: {CSV_PATH}')
    with open(CSV_PATH, encoding='utf-8-sig') as f:
        raw_rows = list(csv.DictReader(f))
    print(f'{len(raw_rows)}행 로드')

    all_records = [build_chunk(r, kr_mappings) for r in raw_rows]

    # 매핑률 통계
    mapped = sum(1 for r in all_records if kr_mappings.get(r['hs_code_6digit']))
    print(f'한국 키워드 매핑: {mapped}/{len(all_records)} ({mapped/len(all_records)*100:.1f}%)')

    # 3. 체크포인트: 이미 적재된 항목 건너뜀
    existing = sb_get_existing_filenames()
    records = [r for r in all_records if r['filename'] not in existing]
    skip_count = len(all_records) - len(records)
    if skip_count:
        print(f'이미 적재됨: {skip_count}개 건너뜀 → 남은 작업: {len(records)}개')
    else:
        print(f'신규 적재 대상: {len(records)}개')

    if not records:
        print('모든 항목이 이미 적재되어 있습니다.')
        count = sb_count('hs_code_cn')
        print(f'DB 검증: hs_code_cn 행 수 = {count}')
        return

    # 4. 임베딩 + 적재
    total   = len(records)
    t_start = time.time()
    loaded  = 0

    print(f'\n임베딩 + 적재 시작 ({total}개, {BATCH_SIZE}개씩)')
    for i in tqdm(range(0, total, BATCH_SIZE), desc='배치'):
        batch = records[i:i + BATCH_SIZE]
        texts = [r['_embed_text'] for r in batch]

        embeddings = embed_batch(texts)

        rows = []
        for rec, emb in zip(batch, embeddings):
            db_row = {k: v for k, v in rec.items() if not k.startswith('_')}
            db_row['embedding'] = emb
            rows.append(db_row)

        for attempt in range(3):
            try:
                sb_insert(rows)
                break
            except (RuntimeError, httpx.ReadError, httpx.RemoteProtocolError,
                    httpx.ConnectError, httpx.TimeoutException) as e:
                if attempt < 2:
                    wait = (attempt + 1) * 5
                    tqdm.write(f'[재시도 {attempt+1}] 배치 {i}: {e} — {wait}초 대기')
                    time.sleep(wait)
                else:
                    tqdm.write(f'[오류] 배치 {i} 실패 (3회): {e}')

        loaded += len(rows)

    elapsed = time.time() - t_start
    print(f'\n완료: {loaded}개 적재')
    print(f'소요 시간: {elapsed:.0f}초 ({elapsed/60:.1f}분)')
    tokens = total * 1536
    print(f'예상 비용: ${tokens * 0.00000002:.4f} (text-embedding-3-small)')

    count = sb_count('hs_code_cn')
    print(f'\nDB 검증: knowledge_base 내 hs_code_cn 행 수 = {count}')


if __name__ == '__main__':
    main()
