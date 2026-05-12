import { MINT_INTRO_DATA } from '../../utils/mintIntro'

const MintLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <polygon points="100,30 60,100 100,100"  fill="#5eead4"/>
    <polygon points="100,30 140,100 100,100" fill="#14b8a6"/>
    <polygon points="60,100 100,170 100,100" fill="#0d9488"/>
    <polygon points="140,100 100,170 100,100" fill="#134e4a"/>
    <line x1="100" y1="30" x2="100" y2="170" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
  </svg>
)

export default function MintIntroCard() {
  const d = MINT_INTRO_DATA

  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid #ccfbf1',
      borderRadius: 18,
      padding: 20,
      maxWidth: 380,
      boxShadow: '0 4px 24px rgba(20,184,166,0.10)',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <MintLogo size={36} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>MINT</div>
          <div style={{ fontSize: 11, color: '#14b8a6', fontWeight: 500 }}>
            Maritime Intelligent Navigation Tool
          </div>
        </div>
      </div>

      {/* 인사말 */}
      <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6, margin: '0 0 14px' }}>
        {d.greeting}<br />
        {d.description}
      </p>

      {/* 기능 목록 */}
      <div style={{
        background: '#f0fdfa',
        borderRadius: 12,
        padding: '4px 0',
        marginBottom: 14,
      }}>
        {d.features.map((f, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 14px',
            borderBottom: i < d.features.length - 1 ? '1px solid #ccfbf1' : 'none',
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{f.icon}</span>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{f.title}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}> — {f.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 푸터 */}
      <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, lineHeight: 1.6 }}>
        {d.footer.split('\n').map((line, i) => (
          <span key={i}>{line}{i === 0 && <br />}</span>
        ))}
      </p>
    </div>
  )
}
