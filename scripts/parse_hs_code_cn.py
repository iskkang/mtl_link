"""
중국 进出口税则 (2026) PDF 파서
구조: 9컬럼 테이블 — 序号 | 税则号列 | 货品名称 | MFN | 协定税率 | (None) | 特惠 | (None) | 普通税率
실행: python scripts/parse_hs_code_cn.py
"""
import sys
import re
import csv
from pathlib import Path

import pdfplumber
from tqdm import tqdm

sys.stdout.reconfigure(encoding='utf-8')

PDF_PATH   = 'supabase/knowledge-base/10_Data/china_hs-code.pdf'
OUTPUT_CSV = 'supabase/knowledge-base/10_Data/cn_hs_parsed.csv'
ERROR_LOG  = 'supabase/knowledge-base/10_Data/cn_hs_parse_errors.log'

# 유효한 8자리 HS코드: XXXX.XXXX (수입·수출 모두 동일)
HS8_RE   = re.compile(r'^\d{4}\.\d{4}$')
# 협정세율 블록 파싱: "숫자 국가코드, ..." 패턴
RATE_BLOCK_RE = re.compile(r'(\d+(?:\.\d+)?)\s+([一-鿿 A-Za-z,\n]+?)(?=\n\d|\Z)', re.S)


# ── 한국 협정세율 추출 ─────────────────────────────────────────────────────
def extract_kr_rate(fta_text: str) -> str:
    """
    협정세율 셀 텍스트에서 韩KR (일반 한중FTA) 세율 추출.
    '韩RKRR'은 RCEP 세율이므로 제외.
    """
    if not fta_text:
        return ''

    # 줄 단위로 분리해서 각 rate-country 블록 처리
    # 형식 예시: "0 东盟AS,智CL,新西兰NZ,...韩KR,...\n4 塞RS\n5 巴PK,韩RKRR"
    blocks = re.split(r'\n(?=[\d])', fta_text.strip())
    for block in blocks:
        m = re.match(r'^(\d+(?:\.\d+)?)\s+(.*)', block, re.S)
        if not m:
            continue
        rate_val, countries = m.group(1), m.group(2)
        # 韩KR 포함 & 韩RKRR 아닌 경우
        # country 코드 목록에 독립적 韩KR 존재 여부 체크
        if re.search(r'韩KR(?!R)', countries):
            return f'{rate_val}%'
    return ''


# ── 행 정규화 ────────────────────────────────────────────────────────────
COL = {'seq': 0, 'code': 1, 'name': 2, 'mfn': 3, 'fta': 4, 'fta2': 5, 'pref': 6, 'pref2': 7, 'general': 8}


def parse_row(row: list, page_num: int) -> dict | None:
    """Parse a primary HS-code row. Returns dict with '_fta' holding full FTA text."""
    if len(row) < 9:
        return None

    code_raw = str(row[COL['code']] or '').strip()
    if not HS8_RE.match(code_raw):
        return None  # 섹션 헤더·빈 행 무시

    name_cn = str(row[COL['name']] or '').strip()
    if not name_cn:
        return None

    # MFN 세율: 숫자만 (예: '10' → '10%')
    mfn_raw = str(row[COL['mfn']] or '').strip()
    mfn_rate = f"{mfn_raw}%" if mfn_raw and re.match(r'^\d+(?:\.\d+)?$', mfn_raw) else mfn_raw

    # FTA 세율 텍스트 (col 4 + col 5 병합) — 전체 보존, 나중에 continuation 이어붙임
    fta_text = ' '.join(filter(None, [
        str(row[COL['fta']]  or '').strip(),
        str(row[COL['fta2']] or '').strip(),
    ]))

    # 일반 세율 (보통세율)
    general_raw = str(row[COL['general']] or '').strip()
    general_rate = f"{general_raw}%" if general_raw and re.match(r'^\d+(?:\.\d+)?$', general_raw) else general_raw

    # 코드 파생
    digits = code_raw.replace('.', '')      # '01041090'
    hs_6   = f'{digits[:4]}.{digits[4:6]}' # '0104.10'

    return {
        'hs_code_cn':    code_raw,
        'hs_code_6digit': hs_6,
        'name_cn':       name_cn,
        'mfn_rate':      mfn_rate,
        'kr_fta_rate':   '',           # 누적 후 finalize()에서 채움
        'general_rate':  general_rate,
        'source_page':   page_num,
        'raw_fta':       '',           # 누적 후 finalize()에서 채움
        '_fta':          fta_text,     # 내부용 누적 버퍼 (CSV 미출력)
    }


def fta_continuation(row: list) -> str:
    """HS코드 없는 continuation 행에서 FTA 텍스트 추출. 없으면 ''."""
    if len(row) < 6:
        return ''
    code_raw = str(row[COL['code']] or '').strip()
    if code_raw:  # 새 HS코드 행이면 continuation 아님
        return ''
    extra = ' '.join(filter(None, [
        str(row[COL['fta']]  or '').strip(),
        str(row[COL['fta2']] or '').strip(),
    ]))
    return extra


def finalize(rec: dict) -> dict:
    """누적된 _fta 전체로 KR rate 재계산 후 내부 키 제거."""
    full_fta = rec.pop('_fta', '')
    rec['kr_fta_rate'] = extract_kr_rate(full_fta)
    rec['raw_fta']     = full_fta[:300]
    return rec


# ── 메인 ─────────────────────────────────────────────────────────────────
def main():
    pdf_path = Path(PDF_PATH)
    if not pdf_path.exists():
        sys.exit(f'파일 없음: {PDF_PATH}')

    parsed_rows: list[dict] = []
    errors: list[str]       = []

    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        print(f'전체 {total}페이지 — 10~{total}페이지 파싱 시작')

        pending: dict | None = None  # 확정되지 않은 현재 HS 행

        # 인트로 페이지(0-9) 스킵, 10번째(index=10)부터 데이터
        for idx in tqdm(range(10, total), desc='파싱', unit='p'):
            page = pdf.pages[idx]
            try:
                tables = page.extract_tables()
                if not tables:
                    errors.append(f'p{idx+1}: 표 없음')
                    continue

                for table in tables:
                    for row in table:
                        parsed = parse_row(row, idx + 1)
                        if parsed:
                            # 새 HS 행 → 이전 pending 확정
                            if pending is not None:
                                parsed_rows.append(finalize(pending))
                            pending = parsed
                        else:
                            # continuation 행: FTA 텍스트 누적
                            extra = fta_continuation(row)
                            if extra and pending is not None:
                                pending['_fta'] += '\n' + extra

            except Exception as exc:
                errors.append(f'p{idx+1}: {exc}')

        # 마지막 pending 확정
        if pending is not None:
            parsed_rows.append(finalize(pending))

    # ── CSV 저장 ─────────────────────────────────────────────────────────
    out_path = Path(OUTPUT_CSV)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if parsed_rows:
        fieldnames = list(parsed_rows[0].keys())
        with open(out_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(parsed_rows)
        print(f'\n저장 완료: {len(parsed_rows):,}건 → {OUTPUT_CSV}')
    else:
        print('\n파싱된 행 없음 — CSV 미생성')

    # ── 에러 로그 ─────────────────────────────────────────────────────────
    if errors:
        Path(ERROR_LOG).write_text('\n'.join(errors), encoding='utf-8')
        print(f'에러 {len(errors):,}건 → {ERROR_LOG}')

    # ── 통계 ─────────────────────────────────────────────────────────────
    print('\n' + '=' * 60)
    print('파싱 통계')
    print('=' * 60)
    total_rows      = len(parsed_rows)
    unique_6        = len(set(r['hs_code_6digit'] for r in parsed_rows))
    unique_cn       = len(set(r['hs_code_cn']    for r in parsed_rows))
    with_kr         = sum(1 for r in parsed_rows if r['kr_fta_rate'])
    error_pages     = len(errors)

    print(f'  총 파싱 행      : {total_rows:,}')
    print(f'  고유 8자리 코드 : {unique_cn:,}')
    print(f'  고유 6자리 코드 : {unique_6:,}')
    print(f'  한국 협정세율 有 : {with_kr:,} ({with_kr/total_rows*100:.1f}%)')
    print(f'  에러 페이지     : {error_pages:,}')

    # ── 샘플 10행 ─────────────────────────────────────────────────────────
    print('\n' + '=' * 60)
    print('샘플 10행')
    print('=' * 60)
    sample_fields = ['hs_code_cn', 'hs_code_6digit', 'name_cn', 'mfn_rate', 'kr_fta_rate', 'general_rate', 'source_page']
    header = '  '.join(f'{f:<14}' for f in sample_fields)
    print(header)
    print('-' * len(header))
    for r in parsed_rows[:10]:
        line = '  '.join(f'{str(r.get(f,""))[:14]:<14}' for f in sample_fields)
        print(line)

    # kr_fta_rate 0% vs 실제 협정세율 분포
    print('\n' + '=' * 60)
    print('한국 협정세율 분포 (상위 10개)')
    print('=' * 60)
    from collections import Counter
    kr_dist = Counter(r['kr_fta_rate'] for r in parsed_rows if r['kr_fta_rate'])
    for rate, cnt in kr_dist.most_common(10):
        print(f'  {rate:<8} : {cnt:,}건')

    # MFN 세율 분포 (상위 10개)
    print('\n' + '=' * 60)
    print('MFN 세율 분포 (상위 10개)')
    print('=' * 60)
    mfn_dist = Counter(r['mfn_rate'] for r in parsed_rows)
    for rate, cnt in mfn_dist.most_common(10):
        print(f'  {rate:<8} : {cnt:,}건')

    # 에러 패턴 (처음 20개)
    if errors:
        print('\n' + '=' * 60)
        print(f'에러 샘플 (처음 20개 / 전체 {len(errors)}건)')
        print('=' * 60)
        for e in errors[:20]:
            print(f'  {e}')


if __name__ == '__main__':
    main()
