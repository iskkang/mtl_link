import type { ReportProfile, CanonicalRow } from './report-profiles.js'
import { buildSubject } from './report-profiles.js'

export function renderEmail(profile: ReportProfile, rows: CanonicalRow[]): string {
  const subject = buildSubject(profile)
  const d       = new Date()
  const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  const stalled = rows.filter(r => r.stalled)

  const colHeaders = [...profile.displayCols.map(c => c.label), '현재 위치', '정체(일수)']
  const colspan    = colHeaders.length

  const headerRow = colHeaders.map(h =>
    `<th style="padding:7px 10px;text-align:left;font-size:11px;font-weight:600;color:#374151;` +
    `background:#d9d9d9;border:1px solid #999999;white-space:nowrap">${h}</th>`,
  ).join('')

  const dataRows = rows.map(r => {
    let rowBg = '#ffffff'
    if (r.stalled)                        rowBg = '#fde8e8'
    else if (r.alert?.level === 'red')    rowBg = '#fee2e2'
    else if (r.alert?.level === 'yellow') rowBg = '#fef9e7'

    const TD = `padding:6px 10px;font-size:12px;border:1px solid #e5e7eb;background:${rowBg};white-space:nowrap`

    const displayCells = r.display.map(d =>
      `<td style="${TD};color:#1e293b">${d.value}</td>`,
    ).join('')

    // Current location cell
    const locText = r.stalled && r.daysAtLocation != null
      ? `⚠️ ${r.currentLocation} (${r.daysAtLocation}일 정체)`
      : r.currentLocation
    const locColor  = r.stalled ? 'color:#b91c1c;font-weight:500' : (r.alert?.level === 'red' ? 'color:#dc2626' : 'color:#374151')
    const noteSpan  = r.alert?.note
      ? `<br><span style="font-size:10px;color:#9ca3af">${r.alert.note}</span>`
      : ''
    const locCell   = `<td style="${TD};${locColor}">${locText}${noteSpan}</td>`

    // Stall days cell
    const stallVal  = r.daysAtLocation != null ? `${r.daysAtLocation}일` : '—'
    const stallColor = r.stalled ? 'color:#b91c1c;font-weight:600' : 'color:#9ca3af'
    const stallCell  = `<td style="${TD};text-align:right;${stallColor}">${stallVal}</td>`

    return `<tr>${displayCells}${locCell}${stallCell}</tr>`
  }).join('\n')

  const emptyRow = `<tr><td colspan="${colspan}" style="padding:16px;text-align:center;` +
    `color:#9ca3af;font-size:12px;border:1px solid #e5e7eb">운송 중인 화물이 없습니다</td></tr>`

  const stalledNote = stalled.length > 0
    ? `<p style="margin:16px 0 0;font-size:13px;color:#b91c1c">` +
      `※ 3일 이상 정체 ${stalled.length}건 (표 내 ⚠️ 표시)</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title></head>
<body style="margin:0;padding:24px 16px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
<div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.06)">

  <!-- Header -->
  <div style="background:#1e3a5f;padding:22px 28px">
    <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.08em;color:#93c5fd;text-transform:uppercase">MTL Link · 트래이싱 리포트</p>
    <h1 style="margin:0;font-size:19px;font-weight:700;color:#ffffff;letter-spacing:-0.01em">${profile.subject}</h1>
    <p style="margin:6px 0 0;font-size:11px;color:#bfdbfe">${dateStr}</p>
  </div>

  <!-- Body -->
  <div style="padding:24px 28px">
    <p style="margin:0 0 18px;font-size:14px;color:#374151;line-height:1.7">
      안녕하세요.<br>
      금일 <strong>${profile.greetingLabel}</strong> 전달 드립니다.
    </p>

    <!-- Table -->
    <div style="overflow-x:auto;border-radius:4px">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>${headerRow}</tr></thead>
      <tbody>
        ${rows.length > 0 ? dataRows : emptyRow}
      </tbody>
    </table>
    </div>

    ${stalledNote}

    <p style="margin:24px 0 0;font-size:13px;color:#374151;line-height:1.9">
      감사합니다.<br>
      <strong>MTL Link</strong>
    </p>
  </div>

  <!-- Footer -->
  <div style="padding:12px 28px;border-top:1px solid #f1f5f9;background:#f8fafc">
    <table style="width:100%"><tr>
      <td style="font-size:11px;color:#9ca3af">MTL Link 자동 트래이싱 리포트 · 매일 오전 10시 발송</td>
      <td style="text-align:right">
        <a href="https://link.mtlship.com" style="font-size:11px;color:#1d4ed8;text-decoration:none">MTL Link 열기 →</a>
      </td>
    </tr></table>
  </div>

</div>
</body></html>`
}
