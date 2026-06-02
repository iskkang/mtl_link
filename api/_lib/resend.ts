const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL     = 'MTL Link <noreply@mtlb.co.kr>'
const ALERT_TO       = 'mtlrus@mtlb.co.kr'

export async function sendContainerAlertEmail(params: {
  containerNumber: string
  alertType:       string
  message:         string
  route:           string
}): Promise<void> {
  if (!RESEND_API_KEY) return

  const ALERT_LABELS: Record<string, string> = {
    awaiting_next_leg_overdue:      '다음 구간 출발 10일 이상 대기',
    awaiting_next_leg_watch:        '다음 구간 출발 5일 이상 대기',
    planned_arrival_overdue:        '도착 예정일 3일 이상 초과',
    planned_departure_overdue:      '출발 예정일 3일 이상 초과',
    vessel_arrival_overdue:         '선박 도착 3일 이상 초과',
    vessel_arrival_watch:           '선박 도착 1일 이상 초과',
    stale_tracking_risk:            '트래킹 데이터 없음 (위험)',
    stale_tracking_watch:           '트래킹 데이터 없음 (주의)',
    container_tracking_unknown:     '컨테이너 위치 불명',
    container_tracking_unavailable: '트래킹 불가',
  }

  const category = ALERT_LABELS[params.alertType] ?? params.alertType
  const isVessel = params.alertType.startsWith('vessel_arrival')
  const emoji    = isVessel ? '🚢' : '🔴'

  const subject = `${emoji} [MTL Link] ${params.containerNumber} - ${category}`

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#0d9488;padding:16px 24px">
        <h2 style="color:#fff;margin:0;font-size:16px">MTL Link 운송 알림</h2>
      </div>
      <div style="padding:24px;border:1px solid #e2e8f0;border-top:none">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr>
            <td style="padding:6px 0;color:#64748b;width:90px">컨테이너</td>
            <td style="padding:6px 0;font-weight:600;font-family:monospace">${params.containerNumber}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b">노선</td>
            <td style="padding:6px 0">${params.route || '—'}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b">알림 유형</td>
            <td style="padding:6px 0">${category}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#64748b">내용</td>
            <td style="padding:6px 0;color:#dc2626">${ALERT_LABELS[params.alertType] ?? params.message}</td>
          </tr>
        </table>
        <div style="margin-top:20px">
          <a href="https://link.mtlship.com"
             style="background:#0d9488;color:#fff;padding:10px 20px;
                    text-decoration:none;border-radius:6px;font-size:14px">
            MTL Link에서 확인 →
          </a>
        </div>
      </div>
      <div style="padding:12px 24px;font-size:11px;color:#94a3b8">
        MTL Link 자동 알림 · 수신 거부는 관리자에게 문의
      </div>
    </div>
  `

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [ALERT_TO],
        subject,
        html,
      }),
    })
  } catch (err) {
    console.error('[resend] alert email failed:', err)
  }
}

// ─── Digest email (one per cron run) ─────────────────────────────────────────

export interface DigestAlert {
  containerNumber: string
  alertType:       string
  alertLevel:      'red' | 'yellow'
  route:           string
}

export async function sendDelayDigestEmail(alerts: DigestAlert[]): Promise<void> {
  if (!RESEND_API_KEY || alerts.length === 0) return

  const ALERT_LABELS: Record<string, string> = {
    awaiting_next_leg_overdue:      '다음 구간 출발 10일 이상 대기',
    awaiting_next_leg_watch:        '다음 구간 출발 5일 이상 대기',
    planned_arrival_overdue:        '도착 예정일 3일 이상 초과',
    planned_arrival_watch:          '도착 예정일 초과',
    planned_departure_overdue:      '출발 예정일 3일 이상 초과',
    planned_departure_watch:        '출발 예정일 초과',
    vessel_arrival_overdue:         '선박 도착 3일 이상 초과',
    vessel_arrival_watch:           '선박 도착 지연',
    stale_tracking_risk:            '트래킹 데이터 없음 (위험)',
    stale_tracking_watch:           '트래킹 데이터 없음 (주의)',
    container_tracking_unknown:     '컨테이너 위치 불명',
    container_tracking_unavailable: '트래킹 불가',
    location_stagnant:              '동일 위치 3일 이상 정체',
  }

  const red    = alerts.filter(a => a.alertLevel === 'red')
  const yellow = alerts.filter(a => a.alertLevel === 'yellow')
  const total  = alerts.length
  const now    = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })

  const subject = `[MTL Link] Delay Note for FESCO — ${total}건 신규 알림`

  const rowRed = red.map(a => `
    <tr>
      <td style="padding:10px 14px;font-family:'Courier New',monospace;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #fee2e2;white-space:nowrap">${a.containerNumber}</td>
      <td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #fee2e2">${a.route || '—'}</td>
      <td style="padding:10px 14px;font-size:12px;color:#dc2626;font-weight:500;border-bottom:1px solid #fee2e2">${ALERT_LABELS[a.alertType] ?? a.alertType}</td>
    </tr>`).join('')

  const rowYellow = yellow.map(a => `
    <tr>
      <td style="padding:10px 14px;font-family:'Courier New',monospace;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #fef3c7;white-space:nowrap">${a.containerNumber}</td>
      <td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #fef3c7">${a.route || '—'}</td>
      <td style="padding:10px 14px;font-size:12px;color:#d97706;font-weight:500;border-bottom:1px solid #fef3c7">${ALERT_LABELS[a.alertType] ?? a.alertType}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">

<div style="max-width:620px;margin:32px auto 24px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0f766e 0%,#0d9488 60%,#14b8a6 100%);padding:28px 32px 24px">
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td>
          <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.08em;color:#99f6e4;text-transform:uppercase">MTL Link · FESCO 운송 알림</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.02em">Delay Note</h1>
        </td>
        <td style="text-align:right;vertical-align:top">
          <span style="display:inline-block;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.25);border-radius:20px;padding:4px 12px;font-size:11px;color:#ccfbf1;white-space:nowrap">${now}</span>
        </td>
      </tr>
    </table>
  </div>

  <!-- Summary bar -->
  <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:16px 32px">
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="width:33%;text-align:center;border-right:1px solid #e2e8f0">
          <p style="margin:0;font-size:11px;color:#94a3b8;font-weight:500;text-transform:uppercase;letter-spacing:0.06em">신규 알림</p>
          <p style="margin:4px 0 0;font-size:26px;font-weight:700;color:#1e293b">${total}</p>
        </td>
        <td style="width:33%;text-align:center;border-right:1px solid #e2e8f0">
          <p style="margin:0;font-size:11px;color:#dc2626;font-weight:500;text-transform:uppercase;letter-spacing:0.06em">긴급</p>
          <p style="margin:4px 0 0;font-size:26px;font-weight:700;color:#dc2626">${red.length}</p>
        </td>
        <td style="width:33%;text-align:center">
          <p style="margin:0;font-size:11px;color:#d97706;font-weight:500;text-transform:uppercase;letter-spacing:0.06em">주의</p>
          <p style="margin:4px 0 0;font-size:26px;font-weight:700;color:#d97706">${yellow.length}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Body -->
  <div style="padding:24px 32px">

    ${red.length > 0 ? `
    <!-- Red section -->
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;flex-shrink:0"></span>
        <h2 style="margin:0;font-size:13px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.06em">긴급 조치 필요 (${red.length}건)</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #fee2e2">
        <thead>
          <tr style="background:#fef2f2">
            <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:#991b1b;letter-spacing:0.05em;text-transform:uppercase">컨테이너</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:#991b1b;letter-spacing:0.05em;text-transform:uppercase">노선</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:#991b1b;letter-spacing:0.05em;text-transform:uppercase">지연 사유</th>
          </tr>
        </thead>
        <tbody>${rowRed}</tbody>
      </table>
    </div>` : ''}

    ${yellow.length > 0 ? `
    <!-- Yellow section -->
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#d97706;flex-shrink:0"></span>
        <h2 style="margin:0;font-size:13px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.06em">주의 (${yellow.length}건)</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #fde68a">
        <thead>
          <tr style="background:#fffbeb">
            <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:#92400e;letter-spacing:0.05em;text-transform:uppercase">컨테이너</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:#92400e;letter-spacing:0.05em;text-transform:uppercase">노선</th>
            <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:#92400e;letter-spacing:0.05em;text-transform:uppercase">사유</th>
          </tr>
        </thead>
        <tbody>${rowYellow}</tbody>
      </table>
    </div>` : ''}

    <!-- CTA -->
    <div style="text-align:center;padding:8px 0 4px">
      <a href="https://link.mtlship.com"
         style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.01em">
        MTL Link에서 상세 확인 →
      </a>
    </div>

  </div>

  <!-- Footer -->
  <div style="padding:14px 32px;border-top:1px solid #f1f5f9;background:#f8fafc">
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="font-size:11px;color:#94a3b8">MTL Link 자동 알림 · 3시간마다 갱신</td>
        <td style="text-align:right;font-size:11px;color:#94a3b8">수신 거부는 관리자에게 문의</td>
      </tr>
    </table>
  </div>

</div>
</body></html>`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM_EMAIL,
        to:      [ALERT_TO],
        subject,
        html,
      }),
    })
  } catch (err) {
    console.error('[resend] digest email failed:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export type ContainerRow = {
  container_number:    string
  current_from:        string | null
  current_to:          string | null
  last_event_location: string | null
  open_alert_types:    string[]
  days_overdue:        number | null
  unknown_since:       string | null
}

export async function sendWeeklyReport(params: {
  date:    string
  total:   number
  red:     ContainerRow[]
  yellow:  ContainerRow[]
  unknown: ContainerRow[]
}): Promise<void> {
  if (!RESEND_API_KEY) return

  const subject = `[MINT] 주간 FESCO 운송 현황 — ${params.date}`

  const ALERT_KO: Record<string, string> = {
    awaiting_next_leg_overdue:  '다음 구간 출발 10일 이상 대기',
    awaiting_next_leg_watch:    '다음 구간 출발 5일 이상 대기',
    planned_arrival_overdue:    '도착 예정일 초과',
    planned_departure_overdue:  '출발 예정일 초과',
    vessel_arrival_overdue:     '선박 도착 지연 (3일+)',
    vessel_arrival_watch:       '선박 도착 지연 (1일+)',
    container_tracking_unknown: '추적 데이터 없음',
  }

  const mintLogoSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2 L18 7 L18 17 L12 22 L6 17 L6 7 Z" fill="#5eead4"/>
    <path d="M12 2 L18 7 L12 12 L6 7 Z" fill="#ccfbf1"/>
    <path d="M12 12 L18 17 L12 22 L6 17 Z" fill="#0f766e"/>
  </svg>`

  const redRows = params.red.map(c => {
    const days   = c.days_overdue ? `+${c.days_overdue}일` : '—'
    const status = ALERT_KO[c.open_alert_types?.[0] ?? ''] ?? '—'
    return `<tr style="border-bottom:0.5px solid #f1f5f9">
      <td style="padding:7px 10px;font-family:monospace;font-size:12px;color:#1e293b">${c.container_number}</td>
      <td style="padding:7px 10px;font-size:12px;color:#475569">${c.current_from ?? '—'} → ${c.current_to ?? '—'}</td>
      <td style="padding:7px 10px;font-size:12px;color:#475569">${c.last_event_location ?? '—'}</td>
      <td style="padding:7px 10px;font-size:12px;color:#dc2626">${status}</td>
      <td style="padding:7px 10px;font-size:12px;text-align:right;color:#dc2626;font-weight:500">${days}</td>
    </tr>`
  }).join('')

  const yellowRows = params.yellow.map(c => {
    const status = ALERT_KO[c.open_alert_types?.[0] ?? ''] ?? '—'
    return `<tr style="border-bottom:0.5px solid #f1f5f9">
      <td style="padding:7px 10px;font-family:monospace;font-size:12px;color:#1e293b">${c.container_number}</td>
      <td style="padding:7px 10px;font-size:12px;color:#475569">${c.current_from ?? '—'} → ${c.current_to ?? '—'}</td>
      <td style="padding:7px 10px;font-size:12px;color:#475569">${c.last_event_location ?? '—'}</td>
      <td style="padding:7px 10px;font-size:12px;color:#d97706">${status}</td>
    </tr>`
  }).join('')

  const unknownRows = params.unknown.map(c => {
    const days = c.unknown_since
      ? `+${Math.floor((Date.now() - new Date(c.unknown_since).getTime()) / 86400000)}일`
      : '—'
    return `<tr style="border-bottom:0.5px solid #f1f5f9">
      <td style="padding:7px 10px;font-family:monospace;font-size:12px;color:#1e293b">${c.container_number}</td>
      <td style="padding:7px 10px;font-size:12px;color:#475569">${c.current_from ?? '—'} → ${c.current_to ?? '—'}</td>
      <td style="padding:7px 10px;font-size:12px;text-align:right;color:#475569;font-weight:500">${days}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:0.5px solid #e2e8f0">

    <div style="background:#0d9488;padding:20px 24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:9px">
          ${mintLogoSvg}
          <div>
            <p style="color:#ffffff;font-size:16px;font-weight:500;margin:0">MINT</p>
            <p style="color:#99f6e4;font-size:10px;margin:0">MTL Intelligent Navigation Tool</p>
          </div>
        </div>
        <span style="color:#99f6e4;font-size:10px;background:#0f766e;padding:3px 8px;border-radius:99px">powered by MTL Link</span>
      </div>
      <div style="border-top:1px solid #0f766e;padding-top:14px">
        <p style="color:#ccfbf1;font-size:11px;margin:0 0 4px">주간 운송 현황 리포트</p>
        <h1 style="color:#ffffff;font-size:19px;font-weight:500;margin:0 0 8px">FESCO 컨테이너 현황 — ${params.date}</h1>
        <p style="color:#99f6e4;font-size:11px;margin:0">MINT가 이번 주 운송 현황을 자동 분석했습니다. 조치가 필요한 컨테이너를 우선 확인하세요.</p>
      </div>
    </div>

    <div style="padding:20px 24px">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px">
        <div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center">
          <p style="font-size:11px;color:#64748b;margin:0 0 4px">활성 컨테이너</p>
          <p style="font-size:22px;font-weight:500;color:#1e293b;margin:0">${params.total}</p>
        </div>
        <div style="background:#fef2f2;border-radius:8px;padding:12px;text-align:center">
          <p style="font-size:11px;color:#dc2626;margin:0 0 4px">조치 필요</p>
          <p style="font-size:22px;font-weight:500;color:#dc2626;margin:0">${params.red.length}</p>
        </div>
        <div style="background:#fffbeb;border-radius:8px;padding:12px;text-align:center">
          <p style="font-size:11px;color:#d97706;margin:0 0 4px">주의</p>
          <p style="font-size:22px;font-weight:500;color:#d97706;margin:0">${params.yellow.length}</p>
        </div>
        <div style="background:#f1f5f9;border-radius:8px;padding:12px;text-align:center">
          <p style="font-size:11px;color:#475569;margin:0 0 4px">추적 불가</p>
          <p style="font-size:22px;font-weight:500;color:#475569;margin:0">${params.unknown.length}</p>
        </div>
      </div>

      ${params.red.length > 0 ? `
      <div style="margin-bottom:20px">
        <p style="font-size:13px;font-weight:500;color:#1e293b;margin:0 0 10px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;margin-right:6px;vertical-align:middle"></span>
          조치 필요 (${params.red.length}개)
        </p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#fef2f2">
            <th style="padding:7px 10px;text-align:left;color:#dc2626;font-weight:500;font-size:11px;border-bottom:1px solid #fecaca">컨테이너</th>
            <th style="padding:7px 10px;text-align:left;color:#dc2626;font-weight:500;font-size:11px;border-bottom:1px solid #fecaca">노선</th>
            <th style="padding:7px 10px;text-align:left;color:#dc2626;font-weight:500;font-size:11px;border-bottom:1px solid #fecaca">현재 위치</th>
            <th style="padding:7px 10px;text-align:left;color:#dc2626;font-weight:500;font-size:11px;border-bottom:1px solid #fecaca">상태</th>
            <th style="padding:7px 10px;text-align:right;color:#dc2626;font-weight:500;font-size:11px;border-bottom:1px solid #fecaca">대기</th>
          </tr></thead>
          <tbody>${redRows}</tbody>
        </table>
      </div>` : ''}

      ${params.yellow.length > 0 ? `
      <div style="margin-bottom:20px">
        <p style="font-size:13px;font-weight:500;color:#1e293b;margin:0 0 10px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#d97706;margin-right:6px;vertical-align:middle"></span>
          주의 (${params.yellow.length}개)
        </p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#fffbeb">
            <th style="padding:7px 10px;text-align:left;color:#d97706;font-weight:500;font-size:11px;border-bottom:1px solid #fde68a">컨테이너</th>
            <th style="padding:7px 10px;text-align:left;color:#d97706;font-weight:500;font-size:11px;border-bottom:1px solid #fde68a">노선</th>
            <th style="padding:7px 10px;text-align:left;color:#d97706;font-weight:500;font-size:11px;border-bottom:1px solid #fde68a">현재 위치</th>
            <th style="padding:7px 10px;text-align:left;color:#d97706;font-weight:500;font-size:11px;border-bottom:1px solid #fde68a">상태</th>
          </tr></thead>
          <tbody>${yellowRows}</tbody>
        </table>
      </div>` : ''}

      ${params.unknown.length > 0 ? `
      <div>
        <p style="font-size:13px;font-weight:500;color:#1e293b;margin:0 0 10px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#475569;margin-right:6px;vertical-align:middle"></span>
          추적 불가 (${params.unknown.length}개)
        </p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f8fafc">
            <th style="padding:7px 10px;text-align:left;color:#475569;font-weight:500;font-size:11px;border-bottom:1px solid #e2e8f0">컨테이너</th>
            <th style="padding:7px 10px;text-align:left;color:#475569;font-weight:500;font-size:11px;border-bottom:1px solid #e2e8f0">노선</th>
            <th style="padding:7px 10px;text-align:right;color:#475569;font-weight:500;font-size:11px;border-bottom:1px solid #e2e8f0">미추적 기간</th>
          </tr></thead>
          <tbody>${unknownRows}</tbody>
        </table>
      </div>` : ''}
    </div>

    <div style="padding:14px 24px;border-top:0.5px solid #e2e8f0;background:#f0fdfa">
      <table style="width:100%"><tr>
        <td style="font-size:11px;color:#0d9488">MINT · 매주 월요일 오전 자동 분석 및 발송</td>
        <td style="text-align:right"><a href="https://link.mtlship.com" style="font-size:11px;color:#0d9488;text-decoration:none">MTL Link 열기 →</a></td>
      </tr></table>
    </div>
  </div>
  </body></html>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    FROM_EMAIL,
      to:      ['mtlrus@mtlb.co.kr'],
      cc:      ['iskang@mtlb.co.kr'],
      subject,
      html,
    }),
  })
}
