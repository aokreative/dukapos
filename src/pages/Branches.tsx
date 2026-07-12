// Branches, warehouses & stock movement.
// - The owner creates locations (branches that sell, warehouses that store).
// - This device picks which location it is selling from.
// - Stock moves between locations as transfers: sent (leaves source) →
//   received at the destination by its manager/lead.
import { useMemo, useState } from 'react'
import {
  Building2,
  Warehouse as WarehouseIcon,
  ArrowRightLeft,
  Check,
  X,
  Plus,
  Pencil,
  MapPin,
  Search,
} from 'lucide-react'
import { useStore, selectCurrentLocation, selectRole, selectBranchLocked } from '../store/useStore'
import { PageHeader, Modal, Badge, EmptyState } from '../components/ui'
import { can } from '../lib/permissions'
import { stockAt, LOCATION_TYPE_LABEL } from '../lib/stock'
import { shortDateTime } from '../lib/format'
import type { BizLocation, StockTransfer, TransferLine } from '../types'

export default function Branches() {
  const locations = useStore((s) => s.locations)
  const transfers = useStore((s) => s.transfers)
  const staff = useStore((s) => s.staff)
  const current = useStore(selectCurrentLocation)
  const setCurrentLocation = useStore((s) => s.setCurrentLocation)
  const receiveTransfer = useStore((s) => s.receiveTransfer)
  const cancelTransfer = useStore((s) => s.cancelTransfer)
  const role = useStore(selectRole)
  const branchLocked = useStore(selectBranchLocked)

  const [newTransfer, setNewTransfer] = useState(false)
  const [editLoc, setEditLoc] = useState<BizLocation | null>(null)
  const [addingLoc, setAddingLoc] = useState(false)

  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? 'Removed location'
  const pending = transfers.filter((t) => t.status === 'pending')
  const history = transfers.filter((t) => t.status !== 'pending').slice(0, 10)

  return (
    <div>
      <PageHeader
        title="Branches & Warehouse"
        subtitle="Locations, stock per branch, and transfers between them"
        action={
          can(role, 'transferStock') ? (
            <button className="btn-primary" onClick={() => setNewTransfer(true)}>
              <ArrowRightLeft size={18} /> New transfer
            </button>
          ) : undefined
        }
      />

      {/* Which location is THIS device selling from */}
      <div className="card mb-4 p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
          <MapPin size={14} /> This device is working at
        </div>
        {branchLocked ? (
          <>
            <span className="chip bg-brand-600 px-4 py-2 text-white">
              <Building2 size={14} /> {current?.name}
            </span>
            <p className="mt-2 text-xs text-brand-900/40 dark:text-white/40">
              You are assigned to this branch and sell only its stock. Ask the owner to change your branch.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {locations.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setCurrentLocation(l.id)}
                  className={`chip px-4 py-2 ${current?.id === l.id ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`}
                >
                  {l.type === 'warehouse' ? <WarehouseIcon size={14} /> : <Building2 size={14} />} {l.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-brand-900/40 dark:text-white/40">
              Sales and stock counts on this device use the selected location.
            </p>
          </>
        )}
      </div>

      {/* Locations */}
      <div className="card mb-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">Locations</h2>
          {can(role, 'manageLocations') && (
            <button className="btn-ghost py-1.5 text-sm" onClick={() => setAddingLoc(true)}>
              <Plus size={16} /> Add location
            </button>
          )}
        </div>
        <div className="space-y-2">
          {locations.map((l) => {
            const keeper = staff.find((m) => m.id === l.assignedStaffId)
            const sellers = staff.filter((m) => m.active && m.locationId === l.id)
            return (
              <div key={l.id} className="flex items-center gap-3 rounded-xl bg-black/5 px-3 py-2.5 dark:bg-white/10">
                {l.type === 'warehouse' ? <WarehouseIcon size={18} className="text-gold-500" /> : <Building2 size={18} className="text-brand-600 dark:text-gold-400" />}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-brand-900 dark:text-white">{l.name}</div>
                  <div className="text-xs text-brand-900/50 dark:text-white/50">
                    {LOCATION_TYPE_LABEL[l.type]}
                    {keeper ? ` · ${keeper.name} in charge` : ''}
                  </div>
                  {sellers.length > 0 && (
                    <div className="mt-0.5 text-xs text-brand-900/40 dark:text-white/40">
                      Sells here: {sellers.map((m) => m.name).join(', ')}
                    </div>
                  )}
                </div>
                {can(role, 'manageLocations') && (
                  <button className="rounded-lg p-2 text-brand-900/50 hover:bg-black/10 dark:text-white/50 dark:hover:bg-white/10" onClick={() => setEditLoc(l)}>
                    <Pencil size={15} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Transfers awaiting receipt */}
      <div className="card mb-4 p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">On the road (waiting to be received)</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-brand-900/40 dark:text-white/40">No pending transfers.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((t) => (
              <TransferRow key={t.id} t={t} nameOf={nameOf}>
                {can(role, 'transferStock') && (
                  <div className="flex gap-2">
                    <button className="btn-primary py-1.5 text-sm" onClick={() => receiveTransfer(t.id)}>
                      <Check size={15} /> Receive at {nameOf(t.toId)}
                    </button>
                    <button className="btn-ghost py-1.5 text-sm" onClick={() => cancelTransfer(t.id)}>
                      <X size={15} /> Cancel
                    </button>
                  </div>
                )}
              </TransferRow>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-900/60 dark:text-white/60">Recent transfers</h2>
        {history.length === 0 ? (
          <EmptyState icon={<ArrowRightLeft size={28} />} title="No transfers yet" hint="Move stock from the warehouse to a branch, or between branches." />
        ) : (
          <div className="space-y-2">
            {history.map((t) => (
              <TransferRow key={t.id} t={t} nameOf={nameOf} />
            ))}
          </div>
        )}
      </div>

      {newTransfer && <TransferModal onClose={() => setNewTransfer(false)} />}
      {(addingLoc || editLoc) && (
        <LocationModal
          location={editLoc}
          onClose={() => {
            setAddingLoc(false)
            setEditLoc(null)
          }}
        />
      )}
    </div>
  )
}

function TransferRow({ t, nameOf, children }: { t: StockTransfer; nameOf: (id: string) => string; children?: React.ReactNode }) {
  const items = t.lines.reduce((a, l) => a + l.qty, 0)
  return (
    <div className="rounded-xl border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold text-brand-900 dark:text-white">
            <span className="truncate">{nameOf(t.fromId)}</span>
            <ArrowRightLeft size={14} className="shrink-0 text-brand-900/40 dark:text-white/40" />
            <span className="truncate">{nameOf(t.toId)}</span>
          </div>
          <div className="text-xs text-brand-900/50 dark:text-white/50">
            {items} item{items !== 1 ? 's' : ''} · sent by {t.createdBy} · {shortDateTime(t.createdAt)}
            {t.status === 'received' && t.receivedBy ? ` · received by ${t.receivedBy}` : ''}
          </div>
        </div>
        <Badge color={t.status === 'received' ? 'green' : t.status === 'cancelled' ? 'red' : 'amber'}>{t.status}</Badge>
      </div>
      <div className="mt-1.5 text-xs text-brand-900/60 dark:text-white/60">
        {t.lines.map((l) => `${l.qty}× ${l.name}`).join(' · ')}
        {t.note ? ` — "${t.note}"` : ''}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  )
}

function TransferModal({ onClose }: { onClose: () => void }) {
  const locations = useStore((s) => s.locations)
  const products = useStore((s) => s.products)
  const current = useStore(selectCurrentLocation)
  const createTransfer = useStore((s) => s.createTransfer)

  const warehouse = locations.find((l) => l.type === 'warehouse')
  const [fromId, setFromId] = useState(warehouse?.id ?? locations[0]?.id ?? '')
  const [toId, setToId] = useState(current?.id ?? locations[0]?.id ?? '')
  const [q, setQ] = useState('')
  const [lines, setLines] = useState<TransferLine[]>([])
  const [note, setNote] = useState('')

  const available = useMemo(() => {
    const t = q.trim().toLowerCase()
    return products
      .filter((p) => p.active && p.trackStock !== false && stockAt(p, fromId) > 0)
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.sku.includes(t))
      .slice(0, 30)
  }, [products, q, fromId])

  function setQty(p: { id: string; name: string }, qty: number, max: number) {
    const clamped = Math.max(0, Math.min(qty, max))
    setLines((ls) => {
      const rest = ls.filter((l) => l.productId !== p.id)
      return clamped > 0 ? [...rest, { productId: p.id, name: p.name, qty: clamped }] : rest
    })
  }
  const qtyOf = (id: string) => lines.find((l) => l.productId === id)?.qty ?? 0
  const totalItems = lines.reduce((a, l) => a + l.qty, 0)
  const valid = fromId !== toId && totalItems > 0

  return (
    <Modal open onClose={onClose} title="Move stock">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">From</label>
          <select className="input" value={fromId} onChange={(e) => { setFromId(e.target.value); setLines([]) }}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">To</label>
          <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      </div>
      {fromId === toId && <p className="mt-2 text-xs font-medium text-red-500">Choose two different locations.</p>}

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-900/40 dark:text-white/40" size={16} />
        <input className="input pl-9 py-2 text-sm" placeholder="Find items to move…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {available.length === 0 ? (
          <p className="py-4 text-center text-sm text-brand-900/40 dark:text-white/40">Nothing in stock at this location.</p>
        ) : (
          available.map((p) => {
            const max = stockAt(p, fromId)
            const qty = qtyOf(p.id)
            return (
              <div key={p.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${qty > 0 ? 'bg-brand-50 dark:bg-brand-900' : 'bg-black/5 dark:bg-white/10'}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-brand-900 dark:text-white">{p.name}</div>
                  <div className="text-[11px] text-brand-900/50 dark:text-white/50">{max} available</div>
                </div>
                <button className="rounded-lg bg-black/5 p-1.5 dark:bg-white/10" onClick={() => setQty(p, qty - 1, max)}>−</button>
                <input
                  className="w-12 rounded-lg border border-black/10 bg-white py-1 text-center text-sm font-bold text-brand-900 dark:border-white/10 dark:bg-white/10 dark:text-white"
                  inputMode="numeric"
                  value={qty || ''}
                  placeholder="0"
                  onChange={(e) => setQty(p, parseInt(e.target.value) || 0, max)}
                />
                <button className="rounded-lg bg-black/5 p-1.5 dark:bg-white/10" onClick={() => setQty(p, qty + 1, max)}>+</button>
              </div>
            )
          })
        )}
      </div>

      <input className="input mt-3 py-2 text-sm" placeholder="Note (optional) — e.g. weekend restock" value={note} onChange={(e) => setNote(e.target.value)} />

      <button
        className="btn-primary mt-4 w-full"
        disabled={!valid}
        onClick={() => {
          createTransfer({ fromId, toId, lines, note: note.trim() || undefined })
          onClose()
        }}
      >
        <ArrowRightLeft size={18} /> Send {totalItems} item{totalItems !== 1 ? 's' : ''}
      </button>
      <p className="mt-2 text-center text-xs text-brand-900/40 dark:text-white/40">
        Stock leaves {locations.find((l) => l.id === fromId)?.name} now; the receiving side confirms arrival.
      </p>
    </Modal>
  )
}

function LocationModal({ location, onClose }: { location: BizLocation | null; onClose: () => void }) {
  const staff = useStore((s) => s.staff)
  const locations = useStore((s) => s.locations)
  const addLocation = useStore((s) => s.addLocation)
  const updateLocation = useStore((s) => s.updateLocation)
  const removeLocation = useStore((s) => s.removeLocation)

  const [name, setName] = useState(location?.name ?? '')
  const [type, setType] = useState<BizLocation['type']>(location?.type ?? 'branch')
  const [assignedStaffId, setAssigned] = useState(location?.assignedStaffId ?? '')
  // Optional per-branch Till/Paybill — 'none' means use the shop default.
  const [mpesaMode, setMpesaMode] = useState<'none' | 'till' | 'paybill'>(location?.mpesaType ?? 'none')
  const [mpesaTill, setMpesaTill] = useState(location?.mpesaTill ?? '')
  const [mpesaPaybill, setMpesaPaybill] = useState(location?.mpesaPaybill ?? '')
  const [mpesaAccount, setMpesaAccount] = useState(location?.mpesaAccount ?? '')

  const mpesaFields =
    mpesaMode === 'none'
      ? { mpesaType: undefined, mpesaTill: undefined, mpesaPaybill: undefined, mpesaAccount: undefined }
      : {
          mpesaType: mpesaMode,
          mpesaTill: mpesaMode === 'till' ? mpesaTill.trim() || undefined : undefined,
          mpesaPaybill: mpesaMode === 'paybill' ? mpesaPaybill.trim() || undefined : undefined,
          mpesaAccount: mpesaMode === 'paybill' ? mpesaAccount.trim() || undefined : undefined,
        }

  return (
    <Modal open onClose={onClose} title={location ? 'Edit location' : 'Add branch or warehouse'}>
      <div className="space-y-3">
        <div>
          <label className="label">Name</label>
          <input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Westlands Branch / Godown A" />
        </div>
        <div>
          <label className="label">Type</label>
          <div className="flex gap-2">
            {(['branch', 'warehouse'] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className={`chip flex-1 justify-center py-2 ${type === t ? 'bg-brand-600 text-white' : 'bg-black/5 text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`}>
                {t === 'branch' ? <Building2 size={14} /> : <WarehouseIcon size={14} />} {LOCATION_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Person in charge (optional)</label>
          <select className="input" value={assignedStaffId} onChange={(e) => setAssigned(e.target.value)}>
            <option value="">— none —</option>
            {staff.filter((m) => m.active).map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Per-branch M-PESA — only for branches that sell (warehouses don't). */}
        {type === 'branch' && (
          <div className="rounded-xl bg-black/5 p-3 dark:bg-white/10">
            <label className="label">This branch's own M-PESA (optional)</label>
            <div className="mb-2 flex gap-2">
              {([['none', 'Shop default'], ['till', 'Own Till'], ['paybill', 'Own Paybill']] as const).map(([v, lbl]) => (
                <button
                  key={v}
                  onClick={() => setMpesaMode(v)}
                  className={`chip flex-1 justify-center py-2 text-xs ${mpesaMode === v ? 'bg-brand-600 text-white' : 'bg-white text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {mpesaMode === 'till' && (
              <input className="input py-2 text-sm" inputMode="numeric" placeholder="Till (Buy Goods) number" value={mpesaTill} onChange={(e) => setMpesaTill(e.target.value)} />
            )}
            {mpesaMode === 'paybill' && (
              <div className="space-y-2">
                <input className="input py-2 text-sm" inputMode="numeric" placeholder="Paybill number" value={mpesaPaybill} onChange={(e) => setMpesaPaybill(e.target.value)} />
                <input className="input py-2 text-sm" placeholder="Account (optional)" value={mpesaAccount} onChange={(e) => setMpesaAccount(e.target.value)} />
              </div>
            )}
            <p className="mt-2 text-[11px] text-brand-900/50 dark:text-white/50">
              {mpesaMode === 'none'
                ? 'Receipts & reminders for this branch use the shop’s Till/Paybill from Settings.'
                : 'Sales made at this branch show this number on receipts and reminders, so money lands in the right account.'}
            </p>
          </div>
        )}
      </div>
      <div className="mt-5 flex gap-2">
        {location && locations.length > 1 && (
          <button
            className="btn-danger"
            onClick={() => {
              removeLocation(location.id)
              onClose()
            }}
            title="Remove (its stock moves to another location)"
          >
            <X size={18} />
          </button>
        )}
        <button
          className="btn-primary flex-1"
          disabled={!name.trim()}
          onClick={() => {
            if (location) updateLocation(location.id, { name: name.trim(), type, assignedStaffId: assignedStaffId || undefined, ...mpesaFields })
            else addLocation({ name: name.trim(), type, assignedStaffId: assignedStaffId || undefined, ...mpesaFields })
            onClose()
          }}
        >
          Save
        </button>
      </div>
    </Modal>
  )
}
