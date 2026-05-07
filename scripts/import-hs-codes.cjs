// HS Code Reference 임포트 스크립트
// 실행: SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/import-hs-codes.js
//
// CSV 출처: datasets/harmonized-system (ODC PDDL - 퍼블릭 도메인)
// 컬럼: section, hscode, description, parent, level

const { createClient } = require('@supabase/supabase-js')
const https = require('https')

const SUPABASE_URL  = 'https://zidkckbabtajpgkhxmfm.supabase.co'
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const CSV_URL       = 'https://raw.githubusercontent.com/datasets/harmonized-system/main/data/harmonized-system.csv'

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function fetchCsv(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve(data))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function parseCsv(csv) {
  const lines = csv.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  console.log('CSV 헤더:', headers)

  return lines.slice(1).map(line => {
    const values = []
    let cur = ''
    let inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { values.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    values.push(cur.trim())
    const row = {}
    headers.forEach((h, i) => { row[h] = (values[i] || '').replace(/^"|"$/g, '') })
    return row
  })
}

async function main() {
  console.log('CSV 다운로드 중...')
  const csv = await fetchCsv(CSV_URL)
  const rows = parseCsv(csv)
  console.log(`파싱 완료: ${rows.length}행`)
  console.log('샘플:', rows[0])

  // hscode, description, parent, level → 매핑
  const records = rows
    .map(row => ({
      level:       parseInt(row.level, 10) || 0,
      code:        row.hscode.toString().trim(),
      description: row.description.trim(),
      parent_code: row.parent === 'TOTAL' ? null : row.parent.trim() || null,
    }))
    .filter(r => r.code && r.description && r.level > 0)

  console.log(`임포트 대상: ${records.length}건`)

  // 기존 데이터 삭제 (재실행 안전)
  const { error: delErr } = await supabase.from('hs_code_reference').delete().gte('id', 0)
  if (delErr) { console.warn('기존 데이터 삭제 경고:', delErr.message) }

  // 500개씩 배치 INSERT
  const BATCH = 500
  let imported = 0
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH)
    const { error } = await supabase.from('hs_code_reference').insert(batch)
    if (error) {
      console.error(`배치 ${i}~${i + BATCH} 오류:`, error.message)
      process.exit(1)
    }
    imported += batch.length
    process.stdout.write(`\r임포트 진행: ${imported} / ${records.length}`)
  }

  console.log('\n완료!')

  // 레벨 분포 확인
  const { data: stats } = await supabase
    .from('hs_code_reference')
    .select('level')

  if (stats) {
    const dist = stats.reduce((acc, r) => {
      acc[r.level] = (acc[r.level] || 0) + 1
      return acc
    }, {})
    console.log('레벨 분포:', dist)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
