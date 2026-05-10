import { Image, FileText, Film, Archive, File, Loader2, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../lib/supabase'
import { useAttachments } from '../../hooks/useAttachments'
import { formatFileSize, isPreviewable } from '../../lib/fileUtils'
import type { AttachmentFilter, AttachmentItem } from '../../types/attachment'

const CHAT_BUCKET = 'chat-attachments'

function getPublicUrl(filePath: string): string {
  return supabase.storage.from(CHAT_BUCKET).getPublicUrl(filePath).data.publicUrl
}

const TABS: { key: AttachmentFilter; labelKey: string }[] = [
  { key: 'all',      labelKey: 'filesAll'       },
  { key: 'image',    labelKey: 'filesImages'    },
  { key: 'video',    labelKey: 'filesVideos'    },
  { key: 'document', labelKey: 'filesDocuments' },
  { key: 'other',    labelKey: 'filesOther'     },
]

interface Props {
  roomId?: string
}

export function FilesPanel({ roomId }: Props) {
  const { t } = useTranslation()
  const { items, filter, loading, hasMore, setFilter, loadMore } = useAttachments(roomId)

  const isGridMode = filter === 'image' || filter === 'video'

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 탭 */}
      <div
        className="flex gap-1 px-3 py-2 overflow-x-auto flex-shrink-0 scrollbar-none"
        style={{ borderBottom: '1px solid var(--side-line)' }}
      >
        {TABS.map(tab => {
          const active = filter === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => void setFilter(tab.key)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap flex-shrink-0 transition-colors"
              style={{
                background: active ? 'var(--brand)' : 'var(--side-row)',
                color:      active ? '#fff' : 'var(--side-mute)',
              }}
            >
              {t(tab.labelKey)}
            </button>
          )
        })}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0">
        {/* 로딩 (첫 페이지) */}
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--side-mute)' }} />
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <File size={32} style={{ color: 'var(--side-mute)' }} />
            <p className="text-sm" style={{ color: 'var(--side-mute)' }}>
              {t('filesEmpty')}
            </p>
          </div>
        )}

        {/* 이미지/비디오 → 3열 그리드 */}
        {isGridMode && items.length > 0 && (
          <div className="grid grid-cols-3 gap-0.5 p-0.5">
            {items.map(item => (
              <FileGridItem key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* 문서/기타/전체 → 목록 */}
        {!isGridMode && items.length > 0 && (
          <div className="flex flex-col">
            {items.map(item => (
              <FileListItem key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* 더 보기 */}
        {hasMore && items.length > 0 && (
          <div className="flex justify-center p-4">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              style={{
                border:     '1px solid var(--side-line)',
                color:      'var(--side-mute)',
                background: 'transparent',
              }}
            >
              {loading
                ? <Loader2 size={12} className="animate-spin" />
                : t('loadMore')
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── FileGridItem ─────────────────────────────────────────── */
function FileGridItem({ item }: { item: AttachmentItem }) {
  const publicUrl = getPublicUrl(item.file_path)

  return (
    <a
      href={publicUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block aspect-square overflow-hidden group"
      style={{ background: 'var(--side-row)' }}
    >
      {isPreviewable(item.mime_type) ? (
        <img
          src={publicUrl}
          alt={item.file_name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Film size={24} style={{ color: 'var(--side-mute)' }} />
        </div>
      )}

      {/* 파일명 오버레이 (hover) */}
      <div
        className="absolute inset-x-0 bottom-0 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] truncate"
        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
      >
        {item.file_name}
      </div>
    </a>
  )
}

/* ── FileListItem ─────────────────────────────────────────── */
function FileListItem({ item }: { item: AttachmentItem }) {
  const { t } = useTranslation()
  const publicUrl = getPublicUrl(item.file_path)

  const TypeIcon = item.attachment_type === 'document' ? FileText
    : item.attachment_type === 'archive'  ? Archive
    : item.attachment_type === 'image'    ? Image
    : item.attachment_type === 'video'    ? Film
    : File

  const meta = [
    formatFileSize(item.file_size),
    item.uploader?.name,
  ].filter(Boolean).join(' · ')

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 border-b transition-colors"
      style={{ borderColor: 'var(--side-line)' }}
    >
      {/* 파일 아이콘 */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--blue-soft)' }}
      >
        <TypeIcon size={17} style={{ color: 'var(--brand)' }} />
      </div>

      {/* 메타 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--side-text)' }}>
          {item.file_name}
        </p>
        <p className="text-xs" style={{ color: 'var(--side-mute)' }}>
          {meta}
        </p>
      </div>

      {/* 다운로드 */}
      <a
        href={publicUrl}
        download={item.file_name}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="flex-shrink-0 p-1.5 rounded transition-colors"
        style={{ color: 'var(--side-mute)' }}
        title={t('downloadFile')}
        onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--brand)')}
        onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = 'var(--side-mute)')}
      >
        <Download size={15} />
      </a>
    </div>
  )
}
