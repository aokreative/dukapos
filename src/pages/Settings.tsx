import { useState } from 'react'
import { Store, Smartphone, MessageSquareText, Database, RotateCcw, Trash2, Check, Users, UserPlus, Pencil } from 'lucide-react'
import { useStore } from '../store/useStore'
import { PageHeader, Modal, Badge } from '../components/ui'
import { DEFAULT_TEMPLATE, buildReminderMessage } from '../lib/reminders'
import { displayPhone, normalizePhone } from '../lib/format'
import { ROLE_LABEL, ROLE_BLURB } from '../lib/permissions'
import type { BusinessSettings, Customer, Debt, Role, StaffMember } from '../types'

export default function Settings() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const resetDemoData = useStore((s) => s.resetDemoData)
  const clearAll = useStore((s) => s.clearAll)

  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof BusinessSettings>(key: K, value: BusinessSettings[K]) {
    updateSettings({ [key]: value })
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  // Live preview of the reminder using a fake customer + debt.
  const sampleCustomer: Customer = { id: 'x', name: 'Mama Njeri', phone: settings.phone, createdAt: 0 }
  const sampleDebt: Debt = { id: 'x', customerId: 'x', saleId: 'x', receiptNo: 'R-00001', originalAmount: 1500, balance: 1500, createdAt: Date.now(), status: 'open', payments: [] }
  const preview = buildReminderMessage(settings, sampleCustomer, sampleDebt)

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" subtitle="Set up your shop and reminders" action={saved ? <span className="chip bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"><Check size={13} /> Saved</span> : undefined} />

      {/* Business profile */}
      <Section icon={<Store size={18} />} title="Business profile">
        <Field label="Shop name">
          <input className="input" value={settings.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Tagline (shown on receipt)">
          <input className="input" value={settings.tagline} onChange={(e) => set('tagline', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shop phone">
            <input className="input" inputMode="tel" value={displayPhone(settings.phone)} onChange={(e) => set('phone', normalizePhone(e.target.value))} />
          </Field>
          <Field label="Location">
            <input className="input" value={settings.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
        </div>
        <Field label="Cashier name (on receipts)">
          <input className="input" value={settings.cashierName} onChange={(e) => set('cashierName', e.target.value)} />
        </Field>
      </Section>

      {/* Payment method — drives reminders */}
      <Section icon={<Smartphone size={18} />} title="How customers pay you">
        <p className="-mt-1 mb-2 text-sm text-brand-900/50 dark:text-white/50">These details are printed on receipts and included in every debt reminder.</p>
        <Field label="M-PESA type">
          <div className="flex gap-2">
            {(['till', 'paybill', 'none'] as const).map((t) => (
              <button key={t} onClick={() => set('mpesaType', t)} className={`chip flex-1 justify-center py-2 capitalize ${settings.mpesaType === t ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`}>
                {t === 'till' ? 'Buy Goods (Till)' : t}
              </button>
            ))}
          </div>
        </Field>
        {settings.mpesaType === 'till' && (
          <Field label="Till number">
            <input className="input" inputMode="numeric" value={settings.mpesaTill} onChange={(e) => set('mpesaTill', e.target.value)} placeholder="e.g. 832909" />
          </Field>
        )}
        {settings.mpesaType === 'paybill' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Paybill number">
              <input className="input" inputMode="numeric" value={settings.mpesaPaybill} onChange={(e) => set('mpesaPaybill', e.target.value)} placeholder="e.g. 400200" />
            </Field>
            <Field label="Account number">
              <input className="input" value={settings.mpesaAccount} onChange={(e) => set('mpesaAccount', e.target.value)} placeholder="e.g. shop name" />
            </Field>
          </div>
        )}
        <label className="flex items-center gap-3 rounded-xl bg-black/5 px-3 py-3 dark:bg-white/10">
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={settings.acceptCash} onChange={(e) => set('acceptCash', e.target.checked)} />
          <span className="text-sm font-medium text-brand-900 dark:text-white">Accept cash at the shop</span>
        </label>
      </Section>

      {/* Reminder template */}
      <Section icon={<MessageSquareText size={18} />} title="Reminder message">
        <p className="-mt-1 mb-2 text-sm text-brand-900/50 dark:text-white/50">
          Use placeholders: <code className="rounded bg-black/10 px-1 dark:bg-white/10">{'{name}'}</code>{' '}
          <code className="rounded bg-black/10 px-1 dark:bg-white/10">{'{business}'}</code>{' '}
          <code className="rounded bg-black/10 px-1 dark:bg-white/10">{'{amount}'}</code>{' '}
          <code className="rounded bg-black/10 px-1 dark:bg-white/10">{'{receipt}'}</code>{' '}
          <code className="rounded bg-black/10 px-1 dark:bg-white/10">{'{pay}'}</code>
        </p>
        <textarea className="input min-h-[120px] font-mono text-sm" value={settings.reminderTemplate} onChange={(e) => set('reminderTemplate', e.target.value)} />
        <button className="mt-2 text-xs font-semibold text-brand-600 dark:text-gold-400" onClick={() => set('reminderTemplate', DEFAULT_TEMPLATE)}>
          Reset to default
        </button>
        <div className="mt-3">
          <div className="label">Preview</div>
          <div className="rounded-2xl bg-brand-50 p-4 text-sm dark:bg-brand-900">
            <pre className="whitespace-pre-wrap font-sans text-brand-900 dark:text-white/90">{preview}</pre>
          </div>
        </div>
      </Section>

      {/* Staff & roles */}
      <StaffSection />

      {/* VAT */}
      <Section icon={<Store size={18} />} title="Tax">
        <label className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-3 dark:bg-white/10">
          <span className="text-sm font-medium text-brand-900 dark:text-white">Charge VAT ({settings.vatRate}%)</span>
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={settings.vatEnabled} onChange={(e) => set('vatEnabled', e.target.checked)} />
        </label>
      </Section>

      {/* Data */}
      <Section icon={<Database size={18} />} title="Data">
        <p className="-mt-1 mb-2 text-sm text-brand-900/50 dark:text-white/50">Everything is stored on this device and works offline.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="btn-ghost flex-1" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} /> Reset demo data
          </button>
          <button className="btn-danger flex-1" onClick={() => setConfirmClear(true)}>
            <Trash2 size={16} /> Clear everything
          </button>
        </div>
      </Section>

      <p className="py-6 text-center text-xs text-brand-900/40 dark:text-white/40">Duka POS · works offline · built for Kenyan shops</p>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset demo data?">
        <p className="text-sm text-brand-900/70 dark:text-white/70">This replaces current products, customers and debts with the starter demo set.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="btn-primary flex-1" onClick={() => { resetDemoData(); setConfirmReset(false) }}>Reset</button>
        </div>
      </Modal>

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear everything?">
        <p className="text-sm text-brand-900/70 dark:text-white/70">This permanently deletes all products, customers, sales and debts on this device. This cannot be undone.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => setConfirmClear(false)}>Cancel</button>
          <button className="btn-danger flex-1" onClick={() => { clearAll(); setConfirmClear(false) }}>Delete all</button>
        </div>
      </Modal>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card mb-4 p-5">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-brand-900 dark:text-white">
        <span className="text-brand-600 dark:text-gold-400">{icon}</span> {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function StaffSection() {
  const staff = useStore((s) => s.staff)
  const currentStaffId = useStore((s) => s.currentStaffId)
  const addStaff = useStore((s) => s.addStaff)
  const updateStaff = useStore((s) => s.updateStaff)
  const removeStaff = useStore((s) => s.removeStaff)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [creating, setCreating] = useState(false)

  const roleColor: Record<Role, 'gold' | 'blue' | 'gray'> = { owner: 'gold', manager: 'blue', cashier: 'gray' }

  return (
    <div className="card mb-4 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold text-brand-900 dark:text-white">
          <span className="text-brand-600 dark:text-gold-400"><Users size={18} /></span> Staff &amp; roles
        </h2>
        <button className="btn-primary py-2 text-sm" onClick={() => setCreating(true)}>
          <UserPlus size={16} /> Add
        </button>
      </div>
      <p className="-mt-2 mb-3 text-sm text-brand-900/50 dark:text-white/50">
        Each staff member logs in on the shop device with a PIN. Their role decides what they can do.
      </p>
      <div className="space-y-2">
        {staff.map((m) => (
          <div key={m.id} className="flex items-center gap-3 rounded-xl border border-black/10 p-3 dark:border-white/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-700 dark:text-white">
              {m.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-brand-900 dark:text-white">{m.name}</span>
                <Badge color={roleColor[m.role]}>{ROLE_LABEL[m.role]}</Badge>
                {!m.active && <Badge color="red">paused</Badge>}
                {m.id === currentStaffId && <span className="text-[11px] font-semibold text-green-600 dark:text-green-400">• you</span>}
              </div>
              <div className="text-xs text-brand-900/50 dark:text-white/50">{ROLE_BLURB[m.role]}</div>
            </div>
            <button className="rounded-lg p-2 text-brand-900/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10" onClick={() => setEditing(m)}>
              <Pencil size={16} />
            </button>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <StaffForm
          member={editing}
          isSelf={editing?.id === currentStaffId}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSave={(data) => {
            if (editing) updateStaff(editing.id, data)
            else addStaff({ ...data, active: true })
            setCreating(false)
            setEditing(null)
          }}
          onDelete={
            editing && editing.id !== currentStaffId && !(editing.role === 'owner' && staff.filter((s) => s.role === 'owner').length === 1)
              ? () => {
                  removeStaff(editing.id)
                  setEditing(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}

function StaffForm({
  member,
  isSelf,
  onClose,
  onSave,
  onDelete,
}: {
  member: StaffMember | null
  isSelf: boolean
  onClose: () => void
  onSave: (data: { name: string; role: Role; pin: string; active: boolean }) => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(member?.name ?? '')
  const [role, setRole] = useState<Role>(member?.role ?? 'cashier')
  const [pin, setPin] = useState(member?.pin ?? '')
  const [active, setActive] = useState(member?.active ?? true)
  const validPin = /^\d{4,6}$/.test(pin)
  const valid = name.trim() && validPin

  return (
    <Modal open onClose={onClose} title={member ? 'Edit staff member' : 'New staff member'}>
      <div className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aisha" />
        </div>
        <div>
          <label className="label">Role</label>
          <div className="grid grid-cols-3 gap-2">
            {(['cashier', 'manager', 'owner'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                disabled={isSelf && member?.role === 'owner' && r !== 'owner'}
                className={`chip justify-center py-2 ${role === r ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/70 disabled:opacity-40 dark:bg-white/10 dark:text-white/70'}`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-brand-900/50 dark:text-white/50">{ROLE_BLURB[role]}</p>
        </div>
        <div>
          <label className="label">PIN (4–6 digits)</label>
          <input className="input tracking-[0.4em]" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••" />
          {pin && !validPin && <p className="mt-1 text-xs text-red-600">Use 4 to 6 numbers</p>}
        </div>
        {member && (
          <label className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-3 dark:bg-white/10">
            <span className="text-sm font-medium text-brand-900 dark:text-white">Active (can log in)</span>
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} />
          </label>
        )}
      </div>
      <div className="mt-5 flex gap-2">
        {onDelete && (
          <button className="btn-danger" onClick={onDelete} aria-label="Delete">
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn-primary flex-1" disabled={!valid} onClick={() => onSave({ name: name.trim(), role, pin, active })}>
          Save
        </button>
      </div>
    </Modal>
  )
}
