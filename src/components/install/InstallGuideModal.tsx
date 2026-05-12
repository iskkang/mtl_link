import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Browser = 'chrome' | 'edge' | 'qq' | 'baidu' | 'sogou' | 'uc' | 'safari-ios' | 'safari-mac' | 'firefox' | 'other'

function detectBrowser(): Browser {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('qqbrowser'))                              return 'qq'
  if (ua.includes('bidubrowser') || ua.includes('baidu'))   return 'baidu'
  if (ua.includes('metasr') || ua.includes('sogou'))        return 'sogou'
  if (ua.includes('ubrowser') || ua.includes('ucbrowser'))  return 'uc'
  if (ua.includes('edg/'))                                  return 'edge'
  if (ua.includes('firefox/'))                              return 'firefox'
  if (/iphone|ipad|ipod/.test(ua))                         return 'safari-ios'
  if (ua.includes('safari/') && !ua.includes('chrome/'))   return 'safari-mac'
  if (ua.includes('chrome/'))                               return 'chrome'
  return 'other'
}

export function isChinaBrowser(): boolean {
  return ['qq', 'baidu', 'sogou', 'uc'].includes(detectBrowser())
}

export function InstallGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [browser, setBrowser] = useState<Browser>('other')
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setBrowser(detectBrowser())
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!open) return null

  const handleAutoInstall = async () => {
    if (!deferredPrompt) return
    void deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') onClose()
  }

  const canAutoInstall = !!deferredPrompt && (browser === 'chrome' || browser === 'edge')

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-2xl p-6 w-[360px] max-w-[92vw] max-h-[80vh] overflow-y-auto shadow-2xl"
        style={{ background: 'var(--card)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
            {t('installAppTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg"
            style={{ color: 'var(--ink-3)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            aria-label="close"
          >
            <X size={16} />
          </button>
        </div>

        {canAutoInstall ? (
          <>
            <p className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }}>
              {t('installAutoAvailable')}
            </p>
            <button
              type="button"
              onClick={() => void handleAutoInstall()}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white"
              style={{ background: 'var(--brand)' }}
            >
              {t('installNow')}
            </button>
          </>
        ) : (
          <ManualGuide browser={browser} />
        )}
      </div>
    </div>
  )
}

function ManualGuide({ browser }: { browser: Browser }) {
  const { t } = useTranslation()

  switch (browser) {
    case 'qq':
      return (
        <Steps>
          <Step n={1}>QQ浏览器右上角 ☰ 메뉴 클릭 / 点击右上角菜单</Step>
          <Step n={2}>"添加到桌面" 선택 / 选择"添加到桌面"</Step>
          <Step n={3}>확인 / 点击确认，桌面图标生成</Step>
        </Steps>
      )
    case 'baidu':
      return (
        <Steps>
          <Step n={1}>百度浏览器 우측 상단 ≡ 메뉴 클릭</Step>
          <Step n={2}>"保存到桌面" 선택 / 选择"保存到桌面"</Step>
          <Step n={3}>이름 확인 후 "确定"</Step>
        </Steps>
      )
    case 'sogou':
      return (
        <Steps>
          <Step n={1}>搜狗浏览器 메뉴 → "工具" 클릭</Step>
          <Step n={2}>"保存到桌面" 선택</Step>
        </Steps>
      )
    case 'uc':
      return (
        <Steps>
          <Step n={1}>UC浏览器 하단 메뉴 탭</Step>
          <Step n={2}>"添加到桌面" 선택 / 选择"添加到桌面"</Step>
        </Steps>
      )
    case 'safari-ios':
      return (
        <Steps>
          <Step n={1}>하단 공유 버튼 (□↑) 탭</Step>
          <Step n={2}>"홈 화면에 추가" 선택</Step>
          <Step n={3}>이름 확인 후 "추가" 탭</Step>
        </Steps>
      )
    case 'safari-mac':
      return (
        <Steps>
          <Step n={1}>주소창 오른쪽 공유 버튼 클릭</Step>
          <Step n={2}>"Dock에 추가" 선택</Step>
        </Steps>
      )
    case 'chrome':
    case 'edge':
      return (
        <Steps>
          <Step n={1}>주소창 우측 ⊕ 아이콘 클릭 (또는 메뉴 → 설치)</Step>
          <Step n={2}>"설치" 클릭</Step>
        </Steps>
      )
    default:
      return (
        <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          {t('installGenericGuide')}
        </p>
      )
  }
}

function Steps({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span
        className="w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center flex-shrink-0 mt-px"
        style={{ background: 'rgba(51,144,236,0.12)', color: '#1A6BB5' }}
      >
        {n}
      </span>
      <span className="text-[13px] pt-0.5" style={{ color: 'var(--ink-2)' }}>{children}</span>
    </div>
  )
}

// BeforeInstallPromptEvent is not in standard lib types
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
