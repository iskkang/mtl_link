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
