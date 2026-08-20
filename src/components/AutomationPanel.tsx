import { useState } from 'react'
import { Bot, Settings2, MessageCircle, Send, CloudOff } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Modal, Badge } from './ui'
import { shortDateTime } from '../lib/format'

import type { ReminderRule } from '../types'

export default function AutomationPanel() {
  const rule = useStore((s) => s.reminderRule)
  const updateRule = useStore((s) => s.updateReminderRule)
  const log = useStore((s) => s.reminderLog)
  const [editOpen, setEditOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  const autoLog = log.filter((l) => l.auto)
  const sentToday = autoLog.filter((l) => Date.now() - l.at < 24 * 60 * 60 * 1000).length

  return (
    <div className="card mb-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${rule.enabled ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/50 dark:bg-white/10 dark:text-white/50'}`}>
            <Bot size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-brand-900 dark:text-white">Automatic reminders</span>
              {rule.enabled ? <Badge color="green">On</Badge> : <Badge color="gray">Off</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-brand-900/60 dark:text-white/60">
              {rule.enabled
                ? `Auto-remind after ${rule.startDay} days, repeat every ${rule.everyDays} days via ${rule.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.`
                : 'Turn on to chase debtors automatically — no tapping needed.'}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge color="gray">
                <CloudOff size={11} /> Messaging Disabled
              </Badge>
              {rule.enabled && <span className="text-xs text-brand-900/50 dark:text-white/50">{sentToday} sent today · {autoLog.length} total</span>}
            </div>
          </div>
        </div>

        <label className="relative inline-flex cursor-pointer items-center" title="Messaging unavailable — coming soon">
          <input type="checkbox" className="peer sr-only" checked={false} disabled onChange={() => {}} />
          <div className="h-6 w-11 rounded-full bg-black/15 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand-600 peer-checked:after:translate-x-5 dark:bg-white/20 opacity-50" />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setEditOpen(true)}>
          <Settings2 size={16} /> Rules
        </button>
        <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => setLogOpen(true)}>
          <Send size={16} /> Reminder log{autoLog.length > 0 ? ` (${autoLog.length})` : ''}
        </button>
      </div>

      {editOpen && <RuleEditor rule={rule} onClose={() => setEditOpen(false)} onSave={(r) => { updateRule(r); setEditOpen(false) }} />}

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Automated reminder log" wide>
        <p className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
          Messaging is currently disabled.
        </p>
        {autoLog.length === 0 ? (
          <p className="py-6 text-center text-sm text-brand-900/40 dark:text-white/40">No automated reminders yet.</p>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {autoLog.map((l) => (
              <div key={l.id} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold text-brand-900 dark:text-white">
                    {l.channel === 'whatsapp' ? <MessageCircle size={14} /> : <Send size={14} />} {l.customerName}
                  </span>
                  <Badge color={l.status === 'failed' ? 'red' : l.status === 'sent' ? 'green' : 'blue'}>{l.status}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-brand-900/50 dark:text-white/50">{shortDateTime(l.at)}{l.detail ? ` · ${l.detail}` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

function RuleEditor({ rule, onClose, onSave }: { rule: ReminderRule; onClose: () => void; onSave: (r: Partial<ReminderRule>) => void }) {
  const [r, setR] = useState<ReminderRule>(rule)
  const set = <K extends keyof ReminderRule>(k: K, v: ReminderRule[K]) => setR((x) => ({ ...x, [k]: v }))

  return (
    <Modal open onClose={onClose} title="Reminder rules">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Start after (days overdue)</label>
            <input className="input" inputMode="numeric" value={r.startDay || ''} onChange={(e) => set('startDay', Math.max(0, parseInt(e.target.value) || 0))} />
          </div>
          <div>
            <label className="label">Repeat every (days)</label>
            <input className="input" inputMode="numeric" value={r.everyDays || ''} onChange={(e) => set('everyDays', Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
        </div>
        <div>
          <label className="label">Max reminders per debt</label>
          <input className="input" inputMode="numeric" value={r.maxPerDebt || ''} onChange={(e) => set('maxPerDebt', Math.max(1, parseInt(e.target.value) || 1))} />
        </div>
        <div>
          <label className="label">Channel</label>
          <div className="flex gap-2">
            {(['whatsapp', 'sms'] as const).map((c) => (
              <button key={c} onClick={() => set('channel', c)} className={`chip flex-1 justify-center py-2 capitalize ${r.channel === c ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`}>
                {c === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quiet from (hour)</label>
            <input className="input" inputMode="numeric" value={r.quietFrom} onChange={(e) => set('quietFrom', Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))} />
          </div>
          <div>
            <label className="label">Quiet to (hour)</label>
            <input className="input" inputMode="numeric" value={r.quietTo} onChange={(e) => set('quietTo', Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))} />
          </div>
        </div>
        <p className="text-xs text-brand-900/50 dark:text-white/50">No reminders are sent between {r.quietFrom}:00 and {r.quietTo}:00.</p>
      </div>
      <button className="btn-primary mt-5 w-full" onClick={() => onSave(r)}>Save rules</button>
    </Modal>
  )
}
