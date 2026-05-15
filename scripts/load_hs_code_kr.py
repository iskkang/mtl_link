"""
한국 HSK 2026 Excel → Supabase knowledge_base RAG 적재 스크립트
실행: python scripts/load_hs_code_kr.py
재실행 시 이미 적재된 항목은 건너뜀 (체크포인트 방식)
"""
import os
import sys
import time
import json
import pandas as pd
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
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
}
REST_URL = f'{SUPABASE_URL}/rest/v1/knowledge_base'

FILE_PATH  = 'supabase/knowledge-base/10_Data/HS_Coide_20260101.xlsx'
BATCH_SIZE = 20   # 타임아웃 방지: 작은 배치
MODEL      = 'text-embedding-3-small'


def sb_insert(rows: list[dict]):
    h = {**HEADERS, 'Prefer': 'resolution=ignore-duplicates,return=minimal'}
    resp = httpx.post(REST_URL, headers=h, content=json.dumps(rows), timeout=90)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f'Insert {resp.status_code}: {resp.text[:300]}')


def sb_get_existing_filenames() -> set[str]:
    """이미 적재된 hs_code_kr 의 filename 목록 조회 (재개용)"""
    page_size = 1000
    offset = 0
    result = set()
    print('기존 적재 항목 조회 중...')
    while True:
        h = {**HEADERS, 'Prefer': 'return=representation'}
        resp = httpx.get(
            f'{REST_URL}?doc_type=eq.hs_code_kr&select=filename&limit={page_size}&offset={offset}',
            headers=h, timeout=30
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


def build_chunk(row) -> dict:
    hs_full = str(row['HS부호']).strip().zfill(10)
    hs_6    = hs_full[:6]
    hs_6_dotted = f'{hs_6[:4]}.{hs_6[4:6]}'

    def safe(col):
        v = row.get(col)
        return str(v).strip() if pd.notna(v) and str(v).strip() not in ('None', 'nan') else ''

    content = (
        f"HS-code: {hs_full} [한국 HSK 10자리]\n"
        f"국제 공통 코드(6자리): {hs_6_dotted}\n"
        f"한글품목명: {safe('한글품목명')}\n"
        f"영문품목명: {safe('영문품목명')}\n"
        f"분류: {safe('성질통합분류코드명')}\n"
        f"설명: {safe('HS부호내용')}\n"
        f"단위: 수량 {safe('수량단위코드')} / 중량 {safe('중량단위코드')}\n"
        f"수출성질: {safe('수출성질코드')} / 수입성질: {safe('수입성질코드')}\n"
        f"출처: 한국 관세청 HSK 2026"
    )
    return {
        'filename':       f'HSK_KR_{hs_full}',
        'chunk_index':    0,
        'content':        content,
        'hs_code_full':   hs_full,
        'hs_code_6digit': hs_6_dotted,
        'country_code':   'KR',
        'doc_type':       'hs_code_kr',
        'status':         'verified',
    }


def embed_batch(texts: list[str]) -> list[list[float]]:
    response = openai_client.embeddings.create(model=MODEL, input=texts)
    return [d.embedding for d in response.data]


def main():
    print(f'Excel 읽는 중: {FILE_PATH}')
    df = pd.read_excel(FILE_PATH, dtype={'HS부호': str})
    print(f'{len(df)}행 로드')

    all_records = [build_chunk(row) for _, row in df.iterrows()]

    # 기존 적재 항목 확인 → 건너뜀 (체크포인트 재개)
    existing = sb_get_existing_filenames()
    records = [r for r in all_records if r['filename'] not in existing]
    skip_count = len(all_records) - len(records)
    if skip_count:
        print(f'이미 적재됨: {skip_count}개 건너뜀 → 남은 작업: {len(records)}개')
    else:
        print(f'신규 적재 대상: {len(records)}개')

    if not records:
        print('모든 항목이 이미 적재되어 있습니다.')
        count = sb_count('hs_code_kr')
        print(f'DB 검증: hs_code_kr 행 수 = {count}')
        return

    total   = len(records)
    t_start = time.time()
    loaded  = 0

    print(f'\n임베딩 + 적재 시작 ({total}개, {BATCH_SIZE}개씩)')
    for i in tqdm(range(0, total, BATCH_SIZE), desc='배치'):
        batch  = records[i:i + BATCH_SIZE]
        texts  = [r['content'] for r in batch]

        embeddings = embed_batch(texts)
        rows = [{**r, 'embedding': emb} for r, emb in zip(batch, embeddings)]

        # 재시도 1회
        for attempt in range(2):
            try:
                sb_insert(rows)
                break
            except RuntimeError as e:
                if attempt == 0:
                    time.sleep(3)
                else:
                    raise e

        loaded += len(rows)

    elapsed = time.time() - t_start
    print(f'\n완료: {loaded}개 청크 적재')
    print(f'소요 시간: {elapsed:.0f}초 ({elapsed/60:.1f}분)')
    tokens = total * 1536
    print(f'예상 비용: ${tokens * 0.00000002:.4f} (text-embedding-3-small)')

    count = sb_count('hs_code_kr')
    print(f'\nDB 검증: knowledge_base 내 hs_code_kr 행 수 = {count}')


if __name__ == '__main__':
    main()
