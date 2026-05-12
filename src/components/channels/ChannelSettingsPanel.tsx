import { useState, useEffect } from 'react'
import { X, Trash2, LogOut, UserMinus, UserPlus, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../ui/Avatar'
import { UserPicker } from '../chat/UserPicker'
import {
  updateChannel,
  inviteToChannel,
  removeMemberFromChannel,
  fetchChannelMembers,
  deleteRoom,
  leaveRoom,
} from '../../services/roomService'
import { useRoomStore } from '../../stores/roomStore'

interface Props {
  roomId:    string
  roomName:  string
  roomDesc:  string | null
  isOwner:   boolean
  onClose:   () => void
  onLeft:    () => void
  onDeleted: () => void
}

type Member = { id: string; name: string; avatar_url: string | null; avatar_color: string | null }

export function ChannelSettingsPanel({
  roomId, roomName, roomDesc, isOwner, onClose, onLeft, onDeleted,
}: Props) {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const isAdmin = profile?.is_admin === true
  const upsertRoom = useRoomStore(s => s.upsertRoom)

  const [name,        setName]        = useState(roomName)
  const [desc,        setDesc]        = useState(roomDesc ?? '')
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState<string | null>(null)
  const [members,     setMembers]     = useState<Member[]>([])
  const [inviteOpen,  setInviteOpen]  = useState(false)
  const [inviting,    setInviting]    = useState(false)
  const [inviteSelected, setInviteSelected] = useState<string[]>([])

  const canEdit = isAdmin || isOwner

  useEffect(() => {
    fetchChannelMembers(roomId).then(setMembers).catch(console.error)
  }, [roomId])

  const handleSave = async () => {
    const trimName = name.trim()
    if (!trimName) return
    setSaving(true)
    setSaveError(null)
    try {
      await updateChannel(roomId, { name: trimName, description: desc.trim() || null })
      const current = useRoomStore.getState().rooms.find(r => r.id === roomId)
      if (current) upsertRoom({ ...current, name: trimName, description: desc.trim() || null })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!window.confirm(`${memberName} — ${t('channelRemoveMemberConfirm')}`)) return
    try {
      await removeMemberFromChannel(roomId, memberId)
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch (err) {
      console.error('[ChannelSettings] remove member failed', err)
    }
  }

  const handleInvite = async () => {
    if (!inviteSelected.length) return
    setInviting(true)
    try {
      // 초대할 멤버 이름 조회
      const { data: invitees } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', inviteSelected)

      // room_members에 추가
      await Promise.all(inviteSelected.map(uid => inviteToChannel(roomId, uid)))

      // 채널에 시스템 메시지 전송 (sender_id = 현재 유저 → RLS 통과)
      const inviterName  = profile?.name ?? '관리자'
      const inviteeNames = (invitees ?? []).map(u => `${u.name}님`).join(', ')
      await supabase.from('messages').insert({
        room_id:      roomId,
        sender_id:    user!.id,
        content:      `${inviterName}님이 ${inviteeNames}을(를) 채널에 초대했습니다.`,
        message_type: 'system',
      })

      const updated = await fetchChannelMembers(roomId)
      setMembers(updated)
      setInviteSelected([])
      setInviteOpen(false)
    } catch (err) {
      console.error('[ChannelSettings] invite failed', err)
    } finally {
      setInviting(false)
    }
  }

  const handleLeave = async () => {
    if (!window.confirm(t('channelLeaveConfirm'))) return
    try {
      await leaveRoom(roomId)
      onLeft()
    } catch (err) {
      console.error('[ChannelSettings] leave failed', err)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(t('channelDeleteConfirm'))) return
    try {
      await deleteRoom(roomId)
      useRoomStore.getState().removeRoom(roomId)
      onDeleted()
    } catch (err) {
      console.error('[ChannelSettings] delete failed', err)
    }
  }

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 flex flex-col shadow-2xl"
      style={{ width: 300, background: 'var(--card)', borderLeft: '1px solid var(--line)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
        style={{ borderColor: 'var(--line)' }}
      >
        <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>
          {t('channelSettings')}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full transition-colors"
          style={{ color: 'var(--ink-4)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="닫기"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">

        {/* Channel info section */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-3)' }}>
            {t('channelInfo')}
          </p>

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-3)' }}>
                {t('channelName')}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={!canEdit}
                placeholder={t('channelNamePlaceholder')}
                maxLength={50}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                style={{
                  background:   canEdit ? 'var(--bg)' : 'var(--side-row)',
                  borderColor:  'var(--line)',
                  color:        'var(--ink)',
                  cursor:       canEdit ? 'text' : 'default',
                }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--ink-3)' }}>
                {t('channelDescription')}
              </label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                disabled={!canEdit}
                placeholder={t('channelDescriptionPlaceholder')}
                rows={2}
                maxLength={200}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border resize-none"
                style={{
                  background:   canEdit ? 'var(--bg)' : 'var(--side-row)',
                  borderColor:  'var(--line)',
                  color:        'var(--ink)',
                  cursor:       canEdit ? 'text' : 'default',
                }}
              />
            </div>

            {canEdit && (
              <>
                {saveError && (
                  <p className="text-xs" style={{ color: '#ef4444' }}>{saveError}</p>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: 'var(--brand)' }}
                >
                  {saving ? '…' : t('save')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Members section */}
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
              {t('channelMembers')} ({members.length})
            </p>
            {canEdit && (
              <button
                onClick={() => setInviteOpen(v => !v)}
                className="text-xs font-medium px-2 py-1 rounded-md transition-colors"
                style={{ color: 'var(--brand)', background: 'rgba(51,144,236,0.08)' }}
              >
                {t('channelInvite')}
              </button>
            )}
          </div>

          {/* Invite picker */}
          {inviteOpen && canEdit && (
            <div className="mb-3 rounded-lg border flex flex-col" style={{ borderColor: 'var(--line)' }}>
              <div className="overflow-y-auto scrollbar-thin" style={{ maxHeight: 220 }}>
                <UserPicker
                  mode="multi"
                  selected={inviteSelected}
                  onChange={setInviteSelected}
                  excludeId={user?.id}
                  excludeIds={members.map(m => m.id)}
                />
              </div>
              {inviteSelected.length > 0 && (
                <div className="border-t p-2 flex-shrink-0" style={{ borderColor: 'var(--line)' }}>
                  <button
                    onClick={handleInvite}
                    disabled={inviting}
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md text-xs font-semibold text-white disabled:opacity-40"
                    style={{ background: 'var(--brand)' }}
                  >
                    {inviting
                      ? <Loader2 size={12} className="animate-spin" />
                      : <UserPlus size={12} />
                    }
                    {inviting ? '초대 중...' : `${inviteSelected.length}명 초대하기`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Member list */}
          <div className="flex flex-col gap-1">
            {members.map(m => (
              <div
                key={m.id}
                className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg group"
                style={{ background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar name={m.name} avatarUrl={m.avatar_url} avatarColor={m.avatar_color} size="xs" />
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--ink)' }}>
                  {m.name}
                  {m.id === user?.id && (
                    <span className="ml-1 text-xs" style={{ color: 'var(--ink-4)' }}>(나)</span>
                  )}
                </span>
                {canEdit && m.id !== user?.id && (
                  <button
                    onClick={() => handleRemove(m.id, m.name)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                    style={{ color: '#ef4444' }}
                    title={t('channelRemoveMember')}
                  >
                    <UserMinus size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 border-t px-4 py-4 flex flex-col gap-2" style={{ borderColor: 'var(--line)' }}>
        {!isOwner && (
          <button
            onClick={handleLeave}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: '#EF3F1A' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,63,26,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut size={15} />
            {t('channelLeave')}
          </button>
        )}
        {(isAdmin || isOwner) && (
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: '#EF3F1A' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,63,26,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Trash2 size={15} />
            {t('channelDelete')}
          </button>
        )}
      </div>
    </div>
  )
}
