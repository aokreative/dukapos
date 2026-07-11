import { useEffect, useState } from 'react'
import { Store, Smartphone, MessageSquareText, Database, RotateCcw, Trash2, Check, Users, UserPlus, Pencil, Cloud, CloudOff, LogOut, UtensilsCrossed, FileSpreadsheet } from 'lucide-react'
import { importProductsCSV, importCustomersCSV, downloadCSV, productsToCSV, customersToCSV, salesToCSV } from '../lib/csv'
import { totalStock } from '../lib/stock'
import { demoProductsFor, demoProductsWithIds } from '../lib/demo'
import { supabase, cloudConfigured } from '../lib/cloud'
import { useStore } from '../store/useStore'
import { PageHeader, Modal, Badge } from '../components/ui'
import { DEFAULT_TEMPLATE, buildReminderMessage } from '../lib/reminders'
import { displayPhone, normalizePhone } from '../lib/format'
import { ROLE_LABEL, ROLE_BLURB, GRANTABLE, CAP_LABEL } from '../lib/permissions'
import { BUSINESS_TYPE_LABEL, PRESET_FEATURES, FEATURE_LABEL, getFeatures } from '../lib/labels'
import type { BusinessSettings, BusinessType, Customer, Debt, FeatureFlags, Role, StaffMember } from '../types'

export default function Settings() {
  const settings = useStore((s) => s.settings)
  const updateSettings = useStore((s) => s.updateSettings)
  const resetDemoData = useStore((s) => s.resetDemoData)
  const clearAll = useStore((s) => s.clearAll)

  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [saved, setSaved] = useState(false)
  const [demoOffer, setDemoOffer] = useState<BusinessType | null>(null)

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
        <Field label="What kind of business is this?">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(BUSINESS_TYPE_LABEL) as BusinessType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  updateSettings({ businessType: t, features: PRESET_FEATURES[t] })
                  if (demoProductsFor(t)) setDemoOffer(t)
                }}
                className={`chip justify-center py-2.5 text-center text-xs sm:text-sm ${(settings.businessType ?? 'shop') === t ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`}
              >
                {t === 'restaurant' ? <UtensilsCrossed size={13} /> : <Store size={13} />} {BUSINESS_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-brand-900/40 dark:text-white/40">
            Picking a type switches on the right extras below — you can still toggle any of them yourself.
          </p>
        </Field>
        <Field label="Extras for your kind of business">
          <div className="space-y-2">
            {(Object.keys(FEATURE_LABEL) as (keyof FeatureFlags)[]).map((k) => {
              const f = getFeatures(settings)
              return (
                <label key={k} className="flex items-center justify-between gap-3 rounded-xl bg-black/5 px-3 py-2.5 dark:bg-white/10">
                  <span>
                    <span className="block text-sm font-medium text-brand-900 dark:text-white">{FEATURE_LABEL[k].name}</span>
                    <span className="block text-xs text-brand-900/50 dark:text-white/50">{FEATURE_LABEL[k].blurb}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-brand-600"
                    checked={f[k]}
                    onChange={(e) => set('features', { ...f, [k]: e.target.checked })}
                  />
                </label>
              )
            })}
          </div>
        </Field>
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
        <Field label="Airtel Money number (optional)">
          <input className="input" inputMode="tel" value={settings.airtelNumber || ''} onChange={(e) => set('airtelNumber', e.target.value)} placeholder="e.g. 0733 000 000" />
        </Field>
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

      {/* Cloud sync */}
      <CloudSection />

      {/* Staff & roles */}
      <StaffSection />

      {/* VAT + eTIMS */}
      <Section icon={<Store size={18} />} title="Tax & KRA eTIMS">
        <label className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-3 dark:bg-white/10">
          <span className="text-sm font-medium text-brand-900 dark:text-white">Charge VAT ({settings.vatRate}%)</span>
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={settings.vatEnabled} onChange={(e) => set('vatEnabled', e.target.checked)} />
        </label>
        <label className="mt-2 flex items-center justify-between rounded-xl bg-black/5 px-3 py-3 dark:bg-white/10">
          <span className="text-sm font-medium text-brand-900 dark:text-white">eTIMS tax invoices (show KRA PIN on receipts)</span>
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={!!settings.etimsEnabled} onChange={(e) => set('etimsEnabled', e.target.checked)} />
        </label>
        {settings.etimsEnabled && (
          <Field label="KRA PIN">
            <input className="input font-mono uppercase" value={settings.kraPin || ''} onChange={(e) => set('kraPin', e.target.value.toUpperCase())} placeholder="e.g. P051234567X" />
          </Field>
        )}
        <p className="mt-1 text-xs text-brand-900/50 dark:text-white/50">
          Receipts show your KRA PIN. With the Duka backend connected and eTIMS onboarding done, each sale is also submitted to KRA automatically — see INTEGRATIONS.md.
        </p>
      </Section>

      {/* QuickBooks / CSV import-export */}
      <ImportExportSection />

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

      <p className="py-6 text-center text-xs text-brand-900/40 dark:text-white/40">
        Duka POS · works offline · built for Kenyan shops
        <br />
        <span className="text-brand-900/35 dark:text-white/30">Version — updated {__APP_BUILD__}</span>
      </p>

      {demoOffer && (
        <Modal open onClose={() => setDemoOffer(null)} title={`Load ${BUSINESS_TYPE_LABEL[demoOffer]} sample products?`}>
          <p className="text-sm text-brand-900/70 dark:text-white/70">
            Perfect for demos: replaces the current product list with realistic {BUSINESS_TYPE_LABEL[demoOffer].toLowerCase()} items
            (with brands, categories, prices{demoOffer === 'electronics' ? ', warranties, per-metre cables' : ''}). Sales, customers and debts are kept.
          </p>
          <div className="mt-4 flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setDemoOffer(null)}>Keep my products</button>
            <button
              className="btn-primary flex-1"
              onClick={() => {
                const demo = demoProductsWithIds(demoOffer)
                if (demo) useStore.setState({ products: demo })
                setDemoOffer(null)
              }}
            >
              Load samples
            </button>
          </div>
        </Modal>
      )}

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

/** QuickBooks-friendly CSV import & export — switch from QuickBooks in a minute. */
function ImportExportSection() {
  const products = useStore((s) => s.products)
  const customers = useStore((s) => s.customers)
  const sales = useStore((s) => s.sales)
  const addProduct = useStore((s) => s.addProduct)
  const updateProduct = useStore((s) => s.updateProduct)
  const addCustomer = useStore((s) => s.addCustomer)
  const currentLocationId = useStore((s) => s.currentLocationId)
  const [msg, setMsg] = useState('')

  async function onProductsFile(f: File) {
    const text = await f.text()
    const { result, toAdd, toUpdate } = importProductsCSV(text, products, currentLocationId)
    toAdd.forEach((p) => addProduct(p))
    toUpdate.forEach((u) => updateProduct(u.id, u.patch))
    setMsg(`Products: ${result.added} added, ${result.updated} updated, ${result.skipped} skipped (duplicates/empty).`)
  }
  async function onCustomersFile(f: File) {
    const text = await f.text()
    const { result, toAdd } = importCustomersCSV(text, customers)
    toAdd.forEach((c) => addCustomer(c))
    setMsg(`Customers: ${result.added} added, ${result.skipped} skipped (duplicates/empty).`)
  }

  return (
    <Section icon={<FileSpreadsheet size={18} />} title="QuickBooks / CSV import & export">
      <p className="-mt-1 mb-2 text-sm text-brand-900/50 dark:text-white/50">
        Moving from QuickBooks? Export your products & customers there as CSV and import them here —
        cleaned and de-duplicated automatically. Exports below open in Excel and import into QuickBooks.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="btn-ghost cursor-pointer justify-center py-2 text-sm">
          Import products CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onProductsFile(f); e.target.value = '' }} />
        </label>
        <label className="btn-ghost cursor-pointer justify-center py-2 text-sm">
          Import customers CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCustomersFile(f); e.target.value = '' }} />
        </label>
        <button className="btn-ghost justify-center py-2 text-sm" onClick={() => downloadCSV('duka-products.csv', productsToCSV(products, (p) => totalStock(p)))}>
          Export products
        </button>
        <button className="btn-ghost justify-center py-2 text-sm" onClick={() => downloadCSV('duka-customers.csv', customersToCSV(customers))}>
          Export customers
        </button>
        <button className="btn-ghost col-span-2 justify-center py-2 text-sm" onClick={() => downloadCSV('duka-sales.csv', salesToCSV(sales, (id) => customers.find((c) => c.id === id)?.name ?? ''))}>
          Export all sales (for QuickBooks / accountant)
        </button>
      </div>
      {msg && <p className="mt-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-500/10 dark:text-green-300">{msg}</p>}
    </Section>
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

function CloudSection() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const sb = supabase()
    if (!sb) return
    sb.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user?.email ?? null))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSessionEmail(s?.user?.email ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  async function signIn(create: boolean) {
    const sb = supabase()
    if (!sb || !email || password.length < 6) return
    setBusy(true)
    setMsg('')
    const { error } = create
      ? await sb.auth.signUp({ email, password })
      : await sb.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setMsg(error.message)
    else setMsg(create ? 'Account created — this shop now syncs across devices.' : 'Signed in — syncing.')
  }

  return (
    <div className="card mb-4 p-5">
      <h2 className="mb-2 flex items-center gap-2 font-bold text-brand-900 dark:text-white">
        <span className="text-brand-600 dark:text-gold-400">{cloudConfigured ? <Cloud size={18} /> : <CloudOff size={18} />}</span>
        Cloud sync (multi-device)
      </h2>
      {!cloudConfigured ? (
        <p className="text-sm text-brand-900/50 dark:text-white/50">
          Not configured on this deployment. Set <code className="rounded bg-black/10 px-1 dark:bg-white/10">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-black/10 px-1 dark:bg-white/10">VITE_SUPABASE_ANON_KEY</code>, redeploy, and this shop can share live
          data across many phones. See CLOUD-SYNC.md.
        </p>
      ) : sessionEmail ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-green-700 dark:text-green-400">● Live — synced across devices</div>
            <div className="text-xs text-brand-900/50 dark:text-white/50">Signed in as {sessionEmail}. Sign in with the same account on any phone to share this shop.</div>
          </div>
          <button className="btn-ghost py-2 text-sm" onClick={() => supabase()?.auth.signOut()}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="-mt-1 text-sm text-brand-900/50 dark:text-white/50">
            Sign in once and this shop's sales, stock, customers and debts stay in the cloud — shared live by every device that signs in.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="email" placeholder="shop@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="input" type="password" placeholder="Password (6+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {msg && <p className="text-xs font-medium text-brand-900/60 dark:text-white/60">{msg}</p>}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy || !email || password.length < 6} onClick={() => signIn(false)}>
              Sign in
            </button>
            <button className="btn-ghost flex-1" disabled={busy || !email || password.length < 6} onClick={() => signIn(true)}>
              Create shop account
            </button>
          </div>
        </div>
      )}
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

  const viewerIsOwner = staff.find((m) => m.id === currentStaffId)?.role === 'owner'
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
            {/* The owner account can never be edited/paused/removed by anyone
                but an owner — a manager, however empowered, cannot touch it. */}
            {(viewerIsOwner || m.role !== 'owner') && (
              <button className="rounded-lg p-2 text-brand-900/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10" onClick={() => setEditing(m)}>
                <Pencil size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <StaffForm
          member={editing}
          isSelf={editing?.id === currentStaffId}
          viewerIsOwner={viewerIsOwner}
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
  viewerIsOwner,
  onClose,
  onSave,
  onDelete,
}: {
  member: StaffMember | null
  isSelf: boolean
  viewerIsOwner: boolean
  onClose: () => void
  onSave: (data: { name: string; role: Role; pin: string; active: boolean; extraCaps?: string[]; locationId?: string }) => void
  onDelete?: () => void
}) {
  const locations = useStore((s) => s.locations)
  const showBranch = locations.length > 1
  const [name, setName] = useState(member?.name ?? '')
  const [role, setRole] = useState<Role>(member?.role ?? 'cashier')
  const [pin, setPin] = useState(member?.pin ?? '')
  const [active, setActive] = useState(member?.active ?? true)
  const [extraCaps, setExtraCaps] = useState<string[]>(member?.extraCaps ?? [])
  const [locationId, setLocationId] = useState(member?.locationId ?? '')
  const validPin = /^\d{4,6}$/.test(pin)
  const valid = name.trim() && validPin
  // Only the owner can hand out extra powers, and never to another owner
  // (owners already have everything). This is how a manager gets owner-like
  // rights without ever being able to overrule or suspend the owner.
  const showGrants = viewerIsOwner && role !== 'owner'
  const toggleCap = (c: string) => setExtraCaps((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))

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
        {showBranch && (
          <div>
            <label className="label">Works at branch</label>
            <select className="input" value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={role === 'owner'}>
              <option value="">All branches (can move between them)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-brand-900/50 dark:text-white/50">
              {role === 'owner'
                ? 'Owners always see and move between every branch.'
                : 'When set, this person logs into that branch and sells only its stock. Leave on “All branches” for staff who move around.'}
            </p>
          </div>
        )}
        {member && (
          <label className="flex items-center justify-between rounded-xl bg-black/5 px-3 py-3 dark:bg-white/10">
            <span className="text-sm font-medium text-brand-900 dark:text-white">Active (can log in) <span className="text-brand-900/50 dark:text-white/50">— uncheck to pause when on leave</span></span>
            <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={active} disabled={isSelf} onChange={(e) => setActive(e.target.checked)} />
          </label>
        )}
        {showGrants && (
          <div>
            <label className="label">Extra permissions (grant owner-style powers)</label>
            <p className="-mt-1 mb-2 text-xs text-brand-900/50 dark:text-white/50">
              Give this {ROLE_LABEL[role].toLowerCase()} access beyond their role. A manager with all of these runs the shop like you —
              but can never edit, pause or remove the owner.
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {GRANTABLE.map((c) => (
                <label key={c} className="flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-2 text-sm dark:bg-white/10">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={extraCaps.includes(c)} onChange={() => toggleCap(c)} />
                  <span className="text-brand-900 dark:text-white">{CAP_LABEL[c]}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 flex gap-3 text-xs font-semibold">
              <button className="text-brand-600 dark:text-gold-400" onClick={() => setExtraCaps([...GRANTABLE])}>Grant all (run like owner)</button>
              <button className="text-brand-900/50 dark:text-white/50" onClick={() => setExtraCaps([])}>Clear</button>
            </div>
          </div>
        )}
      </div>
      <div className="mt-5 flex gap-2">
        {onDelete && (
          <button className="btn-danger" onClick={onDelete} aria-label="Delete">
            <Trash2 size={18} />
          </button>
        )}
        <button className="btn-primary flex-1" disabled={!valid} onClick={() => onSave({ name: name.trim(), role, pin, active, extraCaps: role === 'owner' ? undefined : extraCaps, locationId: role === 'owner' ? undefined : locationId || undefined })}>
          Save
        </button>
      </div>
    </Modal>
  )
}
