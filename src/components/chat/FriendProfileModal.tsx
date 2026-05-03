import { createPortal } from 'react-dom'
import { X, MessageCircle, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../ui/Avatar'
import { SUPPORTED_LANGS } from '../../lib/i18n'
import type { FriendProfile } from '../../services/friendsService'

interface Props {
  friend:    FriendProfile
  isOnline:  boolean
  onClose:   () => void
  onMessage: () => void
}

const langInfo = (code: string | null) =>
  SUPPORTED_LANGS.find(l => l.code === code) ?? null

export function FriendProfileModal({ friend, isOnline, onClose, onMessage }: Props) {
  const { t } = useTranslation()
  const lang = langInfo(friend.preferred_language)

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden
                   bg-white dark:bg-surface-panel
                   border border-gray-100 dark:border-[#374045]"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 배경 */}
        <div className="relative h-16 bg-gradient-to-r from-mtl-navy to-mtl-cyan dark:from-[#1a2a3a] dark:to-[#0d3347]">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full
                       bg-white/20 hover:bg-white/30
                       text-white transition-colors"
            aria-label="닫기"
          >
            <X size={14} />
          </button>
        </div>

        {/* 아바타 (헤더와 겹침) */}
        <div className="flex justify-center -mt-8 mb-3 relative z-10">
          <div className="ring-4 ring-white dark:ring-surface-panel rounded-full">
            <Avatar name={friend.name} avatarUrl={friend.avatar_url} size="lg" />
          </div>
        </div>

        {/* 정보 */}
        <div className="px-5 pb-5 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#e9edef]">
              {friend.name}
            </h3>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0
                          ${isOnline ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-[#556e78]'}`}
              title={isOnline ? t('friendsOnline') : t('friendsOffline')}
            />
          </div>

          {friend.position && (
            <p className="text-xs text-gray-500 dark:text-[#8696a0] mb-3">
              {friend.position}
            </p>
          )}

          <div className="space-y-2 mt-3 text-left">
            {friend.department && (
              <InfoRow label={t('profileDept')}>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full
                                 bg-mtl-navy/10 dark:bg-mtl-cyan/10
                                 text-mtl-navy dark:text-mtl-cyan">
                  {friend.department}
                </span>
              </InfoRow>
            )}

            {lang && (
              <InfoRow label={t('profileLang')}>
                <span className="text-sm">{lang.flag}</span>
                <span className="text-xs text-gray-700 dark:text-[#e9edef] ml-1">{lang.label}</span>
              </InfoRow>
            )}

            <InfoRow label={t('profileEmail')}>
              <span className="text-xs text-gray-500 dark:text-[#aebac1] break-all flex items-center gap-1">
                <Mail size={11} className="flex-shrink-0" />
                {friend.email}
              </span>
            </InfoRow>

            <InfoRow label={t('profileStatus')}>
              <span className={`text-xs font-medium ${isOnline ? 'text-emerald-500' : 'text-gray-400 dark:text-[#8696a0]'}`}>
                {isOnline ? `● ${t('friendsOnline')}` : `○ ${t('friendsOffline')}`}
              </span>
            </InfoRow>
          </div>

          <button
            onClick={() => { onMessage(); onClose() }}
            className="mt-4 w-full flex items-center justify-center gap-2
                       py-2.5 rounded-xl text-sm font-semibold text-white
                       bg-mtl-navy dark:bg-brand-500
                       hover:bg-mtl-navy/90 dark:hover:bg-brand-600
                       transition-colors"
          >
            <MessageCircle size={15} />
            {t('chatStart')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider
                       text-gray-400 dark:text-[#556e78] w-16 flex-shrink-0">
        {label}
      </span>
      <div className="flex items-center">{children}</div>
    </div>
  )
}
