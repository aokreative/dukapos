import { useMemo, useState } from 'react'
import { MessageCircle, Send, HandCoins, Wallet, Clock, ChevronRight, PartyPopper, ReceiptText, CheckCircle2 } from 'lucide-react'
import { useStore, selectOpenDebtsByCustomer, type DebtorSummary } from '../store/useStore'
import { money, displayPhone, agingBucket, relativeDays, shortDate, shortDateTime } from '../lib/format'
import { buildCombinedReminder, paymentInstructions, smsLink, whatsappLink } from '../lib/reminders'
import { PageHeader, Modal, Badge, EmptyState } from '../components/ui'
import AutomationPanel from '../components/AutomationPanel'
import type { Debt, PaymentMethod } from '../types'

const BUCKET_COLOR: Record<string, 'green' | 'amber' | 'red'> = {
  '0-30': 'green',
  '31-60': 'amber',
  '61-90': 'amber',
  '90+': 'red',
}

export default function Debts() {
  const settings = useStore((s) => s.settings)
  const debtors = useStore(selectOpenDebtsByCustomer)
  const markReminderSent = useStore((s) => s.markReminderSent)

  const [remindFor, setRemindFor] = useState<DebtorSummary | null>(null)
  const [payFor, setPayFor] = useState<DebtorSummary | null>(null)
  const [detailsFor, setDetailsFor] = useState<DebtorSummary | null>(null)

  const totals = useMemo(() => {
    const totalOwed = debtors.reduce((s, d) => s + d.totalBalance, 0)
    const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
    for (const d of debtors) for (const debt of d.debts) buckets[agingBucket(debt.createdAt)] += debt.balance
    return { totalOwed, buckets }
  }, [debtors])

  function sendReminder(summary: DebtorSummary, channel: 'whatsapp' | 'sms') {
    const msg = buildCombinedReminder(settings, summary.customer, summary.debts)
    const url = channel === 'whatsapp' ? whatsappLink(summary.customer.phone, msg) : smsLink(summary.customer.phone, msg)
    window.open(url, channel === 'whatsapp' ? '_blank' : '_self')
    summary.debts.forEach((d) => markReminderSent(d.id, channel))
    setRemindFor(null)
  }

  return (
    <div>
      <PageHeader title="Debts & Reminders" subtitle="Who owes you — automatic or one-tap reminders." />

      <AutomationPanel />

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
            <Wallet size={14} /> Total owed
          </div>
          <div className="mt-1 text-2xl font-black text-red-600 dark:text-red-400">{money(totals.totalOwed, settings.currency)}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
            <HandCoins size={14} /> Debtors
          </div>
          <div className="mt-1 text-2xl font-black text-brand-900 dark:text-white">{debtors.length}</div>
        </div>
        <div className="card col-span-2 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
            <Clock size={14} /> Debt aging
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['0-30', '31-60', '61-90', '90+'] as const).map((b) => (
              <Badge key={b} color={BUCKET_COLOR[b]}>
                {b}d · {money(totals.buckets[b], settings.currency)}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {debtors.length === 0 ? (
        <EmptyState icon={<PartyPopper size={32} />} title="No outstanding debts 🎉" hint="Every customer is paid up. Credit sales will show here to chase." />
      ) : (
        <div className="space-y-2">
          {debtors.map((d) => {
            const oldestBucket = agingBucket(d.oldestAt)
            return (
              <div key={d.customer.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-brand-900 dark:text-white">{d.customer.name}</span>
                      <Badge color={BUCKET_COLOR[oldestBucket]}>{oldestBucket}d</Badge>
                    </div>
                    <div className="text-sm text-brand-900/50 dark:text-white/50">{displayPhone(d.customer.phone)}</div>
                    <div className="mt-1 text-xs text-brand-900/40 dark:text-white/40">
                      {d.debts.length} unpaid sale{d.debts.length > 1 ? 's' : ''}
                      {d.lastReminderAt ? ` · reminded ${relativeDays(d.lastReminderAt)}` : ' · not yet reminded'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-red-600 dark:text-red-400">{money(d.totalBalance, settings.currency)}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button className="btn-ghost py-2 text-sm" onClick={() => setRemindFor(d)}>
                    <MessageCircle size={16} /> Remind
                  </button>
                  <button className="btn-ghost py-2 text-sm" onClick={() => setPayFor(d)}>
                    <Wallet size={16} /> Record pay
                  </button>
                  <button className="btn-ghost py-2 text-sm" onClick={() => setDetailsFor(d)}>
                    Details <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {remindFor && (
        <ReminderModal summary={remindFor} onClose={() => setRemindFor(null)} onSend={sendReminder} />
      )}
      {payFor && <RepaymentModal summary={payFor} onClose={() => setPayFor(null)} />}
      {detailsFor && (
        <DebtorDetailsModal
          summary={detailsFor}
          onClose={() => setDetailsFor(null)}
          onRecordPay={() => {
            setPayFor(detailsFor)
            setDetailsFor(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * The full story of one customer — every debt with its items, who served it,
 * every payment made, AND their fully-paid purchases. This is the screen that
 * settles "but I paid you!" arguments: paid purchases show as PAID ✓, debts
 * show exactly what was taken, when, and what has been paid off.
 */
function DebtorDetailsModal({
  summary,
  onClose,
  onRecordPay,
}: {
  summary: DebtorSummary
  onClose: () => void
  onRecordPay: () => void
}) {
  const settings = useStore((s) => s.settings)
  const sales = useStore((s) => s.sales)
  const allDebts = useStore((s) => s.debts)

  const customerSales = useMemo(
    () => sales.filter((s) => s.customerId === summary.customer.id).sort((a, b) => b.createdAt - a.createdAt),
    [sales, summary.customer.id],
  )
  const debtBySaleId = useMemo(() => {
    const m = new Map<string, (typeof allDebts)[number]>()
    for (const d of allDebts) if (d.customerId === summary.customer.id) m.set(d.saleId, d)
    return m
  }, [allDebts, summary.customer.id])

  const METHOD: Record<string, string> = { cash: 'Cash', mpesa: 'M-PESA', airtel: 'Airtel', card: 'Card', credit: 'Credit' }

  return (
    <Modal open onClose={onClose} title={`${summary.customer.name} — full record`}>
      {/* Open debts, in detail */}
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-brand-900/50 dark:text-white/50">Unpaid debts</h3>
        <span className="text-sm font-black text-red-600 dark:text-red-400">{money(summary.totalBalance, settings.currency)}</span>
      </div>
      <div className="space-y-2">
        {summary.debts
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((d) => {
            const sale = sales.find((s) => s.id === d.saleId)
            const servedBy = d.cashierName || sale?.cashierName
            return (
              <div key={d.id} className="rounded-xl border border-black/10 p-3 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-brand-900 dark:text-white">{d.receiptNo}</span>
                  <span className="text-sm font-black text-red-600 dark:text-red-400">{money(d.balance, settings.currency)} left</span>
                </div>
                <div className="text-xs text-brand-900/50 dark:text-white/50">
                  {shortDateTime(d.createdAt)}
                  {servedBy ? ` · given out by ${servedBy}` : ''}
                </div>
                {sale && (
                  <div className="mt-1.5 rounded-lg bg-black/5 px-2.5 py-1.5 text-xs text-brand-900/70 dark:bg-white/10 dark:text-white/70">
                    {sale.lines.map((l) => `${l.qty}× ${l.name}`).join(' · ')}
                  </div>
                )}
                <div className="mt-1.5 text-xs">
                  {d.payments.length === 0 ? (
                    <span className="text-brand-900/40 dark:text-white/40">No payments yet on this debt.</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {d.payments.map((p) => (
                        <li key={p.id} className="flex justify-between text-brand-900/70 dark:text-white/70">
                          <span>
                            {shortDateTime(p.at)} · {METHOD[p.method] || p.method}
                            {p.ref ? ` (${p.ref})` : ''}
                          </span>
                          <span className="font-semibold text-green-700 dark:text-green-400">-{money(p.amount, settings.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
      </div>

      {/* Everything else they bought — incl. fully-paid purchases */}
      <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
        Purchase history (incl. paid)
      </h3>
      {customerSales.length === 0 ? (
        <p className="text-sm text-brand-900/40 dark:text-white/40">No purchases recorded for this customer yet.</p>
      ) : (
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {customerSales.map((s) => {
            const debt = debtBySaleId.get(s.id)
            const status: 'paid' | 'open' | 'cleared' = !debt || s.creditAmount === 0 ? 'paid' : debt.status === 'settled' ? 'cleared' : 'open'
            return (
              <div key={s.id} className="rounded-xl bg-black/5 px-3 py-2 dark:bg-white/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-900 dark:text-white">
                    <ReceiptText size={13} className="text-brand-900/40 dark:text-white/40" /> {s.receiptNo}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-900 dark:text-white">{money(s.total, settings.currency)}</span>
                    {status === 'paid' && (
                      <Badge color="green"><CheckCircle2 size={11} /> PAID</Badge>
                    )}
                    {status === 'cleared' && <Badge color="green">debt cleared ✓</Badge>}
                    {status === 'open' && <Badge color="red">on credit</Badge>}
                  </span>
                </div>
                <div className="text-[11px] text-brand-900/50 dark:text-white/50">
                  {shortDateTime(s.createdAt)} · served by {s.cashierName} · {s.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn-primary" onClick={onRecordPay}>
          <Wallet size={16} /> Record payment
        </button>
        <button className="btn-ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}

function ReminderModal({
  summary,
  onClose,
  onSend,
}: {
  summary: DebtorSummary
  onClose: () => void
  onSend: (s: DebtorSummary, channel: 'whatsapp' | 'sms') => void
}) {
  const settings = useStore((s) => s.settings)
  const message = buildCombinedReminder(settings, summary.customer, summary.debts)

  return (
    <Modal open onClose={onClose} title={`Remind ${summary.customer.name}`}>
      <p className="mb-2 text-sm text-brand-900/60 dark:text-white/60">
        This message includes your payment details so they know exactly how to pay:
      </p>
      <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900 dark:bg-brand-900 dark:text-white/90">
        <pre className="whitespace-pre-wrap font-sans">{message}</pre>
      </div>
      <div className="mt-3 rounded-xl bg-gold-500/15 px-3 py-2 text-xs font-medium text-gold-600 dark:text-gold-400">
        Pay to: {paymentInstructions(settings).replace(/\n/g, '  ·  ')}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn-primary" onClick={() => onSend(summary, 'whatsapp')}>
          <MessageCircle size={18} /> WhatsApp
        </button>
        <button className="btn-ghost" onClick={() => onSend(summary, 'sms')}>
          <Send size={18} /> SMS
        </button>
      </div>
    </Modal>
  )
}

function RepaymentModal({ summary, onClose }: { summary: DebtorSummary; onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const recordDebtPayment = useStore((s) => s.recordDebtPayment)
  const [selected, setSelected] = useState<Debt>(summary.debts.slice().sort((a, b) => a.createdAt - b.createdAt)[0])
  const [amount, setAmount] = useState<number>(selected.balance)
  const [method, setMethod] = useState<PaymentMethod>('mpesa')
  const [ref, setRef] = useState('')

  function pay() {
    if (amount <= 0) return
    recordDebtPayment(selected.id, Math.min(amount, selected.balance), method, ref || undefined)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`${summary.customer.name} — record payment`}>
      <div className="mb-3 space-y-1.5">
        <label className="label">Which sale?</label>
        {summary.debts
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setSelected(d)
                setAmount(d.balance)
              }}
              className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${selected.id === d.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900' : 'border-black/10 dark:border-white/10'}`}
            >
              <div>
                <div className="text-sm font-semibold text-brand-900 dark:text-white">{d.receiptNo}</div>
                <div className="text-xs text-brand-900/50 dark:text-white/50">{shortDate(d.createdAt)}</div>
              </div>
              <div className="text-sm font-bold text-red-600 dark:text-red-400">{money(d.balance, settings.currency)}</div>
            </button>
          ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Amount</label>
          <input className="input" inputMode="decimal" value={amount || ''} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="mpesa">M-PESA</option>
            <option value="airtel">Airtel Money</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </div>
      </div>
      {method === 'mpesa' && (
        <div className="mt-3">
          <label className="label">M-PESA code (optional)</label>
          <input className="input" placeholder="e.g. RBG6X..." value={ref} onChange={(e) => setRef(e.target.value)} />
        </div>
      )}

      <div className="mt-2 flex gap-2 text-xs">
        <button className="chip bg-black/5 dark:bg-white/10" onClick={() => setAmount(selected.balance)}>
          Full · {money(selected.balance, settings.currency)}
        </button>
        <button className="chip bg-black/5 dark:bg-white/10" onClick={() => setAmount(Math.round(selected.balance / 2))}>
          Half
        </button>
      </div>

      <button className="btn-primary mt-4 w-full" onClick={pay} disabled={amount <= 0}>
        Record {money(Math.min(amount, selected.balance), settings.currency)} paid
      </button>
    </Modal>
  )
}
