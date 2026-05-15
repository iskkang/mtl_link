import csv, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('supabase/knowledge-base/10_Data/cn_hs_parsed.csv', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))
print(f'CSV 행 수: {len(rows)}')

print('\n=== 샘플 10행 (rows 10~19) ===')
for r in rows[10:20]:
    cn   = r['hs_code_cn']
    dig6 = r['hs_code_6digit']
    name = r['name_cn'][:30]
    mfn  = r['mfn_rate']
    kr   = r['kr_fta_rate']
    gen  = r['general_rate']
    fta  = r['raw_fta'][:80]
    print(f'  {cn}  {dig6}  [{name}]  MFN={mfn}  KR={kr}  GEN={gen}')
    print(f'    fta: {fta}')

print('\n=== KR세율 非0% 샘플 5행 ===')
kr_nonzero = [r for r in rows if r['kr_fta_rate'] and r['kr_fta_rate'] != '0%']
for r in kr_nonzero[:5]:
    cn   = r['hs_code_cn']
    name = r['name_cn'][:25]
    mfn  = r['mfn_rate']
    kr   = r['kr_fta_rate']
    print(f'  {cn}  {name:<25}  MFN={mfn}  KR={kr}')

print('\n=== 에러 로그 전체 ===')
with open('supabase/knowledge-base/10_Data/cn_hs_parse_errors.log', encoding='utf-8') as f:
    for line in f:
        print(' ', line.rstrip())
