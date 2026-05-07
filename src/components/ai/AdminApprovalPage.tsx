import { useState, useEffect } from 'react'
import { ChevronLeft, Check, X, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface HsPending {
  id:                string
  item_name:         string
  country:           string
  hs_code_candidate: string | null
  customs_notes:     string | null
  confidence_label:  'High' | 'Medium' | 'Low' | null
  created_by:        string
  created_at:        string
  approval_status:   string
}

interface KbPending {
  id:         string
  title:      string
  category:   string
  content:    string
  created_by: string
  created_at: string
  status:     string
}

type ActiveTab = 'hs' | 'kb'

interface Props {
  onBack: () => void
}

export function AdminApprovalPage({ onBack }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [activeTab, setActiveTab]   = useState<ActiveTab>('hs')
  const [hsPending, setHsPending]   = useState<HsPending[]>([])
  const [kbPending, setKbPending]   = useState<KbPending[]>([])
  const [loading,   setLoading]     = useState(true)
  const [acting,    setActing]      = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const [hsRes, kbRes] = await Promise.all([
      supabase
        .from('hs_code_notes')
        .select('id, item_name, country, hs_code_candidate, customs_notes, confidence_label, created_by, created_at, approval_status')
        .in('approval_status', ['pending_review', 'draft'])
        .order('created_at', { ascending: false }),
      supabase
        .from('knowledge_base')
        .select('id, title, category, content, created_by, created_at, status')
        .in('status', ['pending_review', 'draft'])
        .order('created_at', { ascending: false }),
    ])
    setHsPending((hsRes.data as HsPending[]) ?? [])
    setKbPending((kbRes.data as KbPending[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const handleHsAction = async (id: string, action: 'approve' | 'reject') => {
    if (!user) return
    setActing(id)
    const newStatus = action === 'approve' ? 'verified' : 'rejected'
    await supabase
      .from('hs_code_notes')
      .update(action === 'approve'
        ? { approval_status: 'verified', approved_by: user.id, approved_at: new Date().toISOString() }
        : { approval_status: 'rejected' })
      .eq('id', id)
    await supabase.from('audit_logs').insert({
      user_id:      user.id,
      action_type:  action,
      target_table: 'hs_code_notes',
      target_id:    id,
      after_value:  { status: newStatus },
    })
    setHsPending(prev => prev.filter(i => i.id !== id))
    setActing(null)
  }

  const handleKbAction = async (id: string, action: 'approve' | 'reject') => {
    if (!user) return
    setActing(id)
    const newStatus = action === 'approve' ? 'verified' : 'rejected'
    await supabase
      .from('knowledge_base')
      .update(action === 'approve'
        ? { status: 'verified', approved_by: user.id }
        : { status: 'rejected' })
      .eq('id', id)
    await supabase.from('audit_logs').insert({
      user_id:      user.id,
      action_type:  action,
      target_table: 'knowledge_base',
      target_id:    id,
      after_value:  { status: newStatus },
    })
    setKbPending(prev => prev.filter(i => i.id !== id))
    setActing(null)
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--chat-bg)' }}>

      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg flex-shrink-0"
          style={{ color: 'var(--ink-3)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--side-row)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          aria-label="Back"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-sm font-bold" style={{ color: 'var(--ink-1)' }}>
          {t('approvalTitle')}
        </h1>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b flex-shrink-0"
        style={{ borderColor: 'var(--line)', background: 'var(--card)' }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('hs')}
          className="flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all"
          style={{
            borderColor: activeTab === 'hs' ? 'var(--brand)' : 'transparent',
            color:       activeTab === 'hs' ? 'var(--brand)' : 'var(--ink-3)',
          }}
        >
          HS-code {hsPending.length > 0 && `(${hsPending.length})`}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('kb')}
          className="flex-1 py-2.5 text-xs font-semibold border-b-2 transition-all"
          style={{
            borderColor: activeTab === 'kb' ? 'var(--brand)' : 'transparent',
            color:       activeTab === 'kb' ? 'var(--brand)' : 'var(--ink-3)',
          }}
        >
          {t('knowledgeTitle')} {kbPending.length > 0 && `(${kbPending.length})`}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink-4)' }} />
            </div>
          ) : activeTab === 'hs' ? (
            hsPending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm" style={{ color: 'var(--ink-4)' }}>{t('approvalEmpty')}</p>
              </div>
            ) : (
              hsPending.map(item => (
                <div
                  key={item.id}
                  className="rounded-2xl border p-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>
                        {item.item_name}
                      </p>
                      <p className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>
                        {item.country}
                        {item.hs_code_candidate && (
                          <span className="ml-2 font-mono" style={{ color: 'var(--brand)' }}>
                            HS: {item.hs_code_candidate}
                          </span>
                        )}
                      </p>
                      {item.customs_notes && (
                        <p className="text-xs line-clamp-2" style={{ color: 'var(--ink-4)' }}>
                          {item.customs_notes}
                        </p>
                      )}
                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--ink-4)' }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleHsAction(item.id, 'reject')}
                        disabled={acting === item.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
                        style={{ color: '#EF4444', borderColor: '#EF444440' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EF444410')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <X size={11} />
                        {t('approvalReject')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleHsAction(item.id, 'approve')}
                        disabled={acting === item.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
                        style={{ color: '#22C55E', borderColor: '#22C55E40' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#22C55E10')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {acting === item.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Check size={11} />}
                        {t('approvalApprove')}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            kbPending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-sm" style={{ color: 'var(--ink-4)' }}>{t('approvalEmpty')}</p>
              </div>
            ) : (
              kbPending.map(item => (
                <div
                  key={item.id}
                  className="rounded-2xl border p-4"
                  style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--ink)' }}>
                        {item.title}
                      </p>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded border inline-block mb-1"
                        style={{ color: 'var(--ink-4)', borderColor: 'var(--line)' }}
                      >
                        {item.category}
                      </span>
                      <p className="text-xs line-clamp-2 mt-1" style={{ color: 'var(--ink-3)' }}>
                        {item.content}
                      </p>
                      <p className="text-[10px] mt-1.5" style={{ color: 'var(--ink-4)' }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleKbAction(item.id, 'reject')}
                        disabled={acting === item.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
                        style={{ color: '#EF4444', borderColor: '#EF444440' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#EF444410')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <X size={11} />
                        {t('approvalReject')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleKbAction(item.id, 'approve')}
                        disabled={acting === item.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50"
                        style={{ color: '#22C55E', borderColor: '#22C55E40' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#22C55E10')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {acting === item.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Check size={11} />}
                        {t('approvalApprove')}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          )}

        </div>
      </div>
    </div>
  )
}
