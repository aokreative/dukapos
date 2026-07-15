// The customer's full profile — one tap from Customers or Debts.
// Shows contact info (incl. shop-owner details for business customers),
// balances BOTH ways (their debts to you; what you owe them when they also
// supply you), every debt in detail with its comment thread, and the complete
// purchase history with PAID / on credit / cleared badges.
import { useMemo, useState } from 'react'
import { Wallet, ReceiptText, CheckCircle2, MessageCircle, Phone, Store, Link2, Printer, Send } from 'lucide-react'
import { Modal, Badge } from './ui'
import { useStore } from '../store/useStore'
import { money, displayPhone, shortDate, shortDateTime } from '../lib/format'
import { buildCombinedReminder, whatsappLink, smsLink } from '../lib/reminders'
import type { Customer, Debt, PaymentMethod } from '../types'

const METHOD: Record<string, string> = { cash: 'Cash', mpesa: 'M-PESA', airtel: 'Airtel', card: 'Card', credit: 'Credit' }

export default function CustomerProfile({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const sales = useStore((s) => s.sales)
  const debts = useStore((s) => s.debts)
  const suppliers = useStore((s) => s.suppliers)
  const supplierTxns = useStore((s) => s.supplierTxns)
  const addDebtComment = useStore((s) => s.addDebtComment)

  const [payOpen, setPayOpen] = useState(false)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const myDebts = useMemo(
    () => debts.filter((d) => d.customerId === customer.id).sort((a, b) => a.createdAt - b.createdAt),
    [debts, customer.id],
  )
  const openDebts = myDebts.filter((d) => d.status === 'open' && d.balance > 0)
  const totalOwed = openDebts.reduce((a, d) => a + d.balance, 0)

  const customerSales = useMemo(
    // Voided (reversed) sales are left out of the customer's statement entirely.
    () => sales.filter((s) => s.customerId === customer.id && !s.voided).sort((a, b) => b.createdAt - a.createdAt),
    [sales, customer.id],
  )
  const debtBySaleId = useMemo(() => {
    const m = new Map<string, Debt>()
    for (const d of myDebts) m.set(d.saleId, d)
    return m
  }, [myDebts])

  // When this customer is also one of your suppliers, show what YOU owe THEM.
  const linkedSupplier = suppliers.find((sup) => sup.customerId === customer.id)
  const shopOwesThem = linkedSupplier
    ? Math.max(0, supplierTxns.reduce((a, t) => (t.supplierId === linkedSupplier.id ? a + (t.type === 'delivery' ? t.amount : -t.amount) : a), 0))
    : 0

  const settledDebts = myDebts.filter((d) => d.status === 'settled')
  const totalSpent = customerSales.reduce((a, s) => a + s.total, 0)
  const cur = settings.currency
  const fromT = from ? new Date(from + 'T00:00:00').getTime() : -Infinity
  const toT = to ? new Date(to + 'T23:59:59').getTime() : Infinity
  const salesShown = customerSales.filter((s) => s.createdAt >= fromT && s.createdAt <= toT)

  // A full account statement the customer can keep — every purchase, how it was
  // paid, and what (if anything) is still pending. Works long after settlement.
  function statementText(): string {
    const rows = customerSales
      .map((s) => {
        const debt = debtBySaleId.get(s.id)
        const tag = !debt || s.creditAmount === 0 ? 'PAID' : debt.status === 'settled' ? 'credit — cleared ✓' : `credit — ${money(debt.balance, cur)} pending`
        return `${shortDate(s.createdAt)}  ${s.receiptNo}: ${money(s.total, cur)}  [${tag}]`
      })
      .join('\n')
    return (
      `*${settings.name} — Statement*\n${customer.name} · ${displayPhone(customer.phone)}\nAs of ${shortDate(Date.now())}\n\n` +
      `${rows || 'No purchases recorded yet.'}\n\n` +
      `Total purchases: ${money(totalSpent, cur)}\nStill pending: ${totalOwed > 0 ? money(totalOwed, cur) : 'nothing ✓'}` +
      (customer.points ? `\nPoints: ${customer.points}` : '') +
      `\n\nAsante! Karibu tena.`
    )
  }

  function printStatement() {
    const w = window.open('', 'print', 'width=380,height=680')
    if (!w) return
    const rows = customerSales
      .map((s) => {
        const debt = debtBySaleId.get(s.id)
        const tag = !debt || s.creditAmount === 0 ? 'PAID' : debt.status === 'settled' ? 'cleared ✓' : `${money(debt.balance, cur)} due`
        const pays = debt && debt.payments.length ? `<div class="pays">${debt.payments.map((p) => `paid ${money(p.amount, cur)} · ${shortDate(p.at)} · ${(p.method || '').toUpperCase()}`).join('<br/>')}</div>` : ''
        return `<tr><td>${shortDate(s.createdAt)}<br/><span class="r">${s.receiptNo}</span></td><td>${s.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}${pays}</td><td class="a">${money(s.total, cur)}<br/><span class="tag">${tag}</span></td></tr>`
      })
      .join('')
    w.document.write(`
      <html><head><title>Statement — ${customer.name}</title>
      <style>*{font-family:system-ui,Arial,sans-serif;font-size:12px;color:#111}body{max-width:420px;margin:0 auto;padding:16px}h1{font-size:18px;margin:0}.sub{color:#555;font-size:12px;margin:2px 0 12px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #eee;padding:6px 4px;vertical-align:top}th{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#166534}.a{text-align:right;white-space:nowrap}.r{color:#888}.tag{font-size:10px;color:#666}.pays{color:#0a7a37;font-size:10px;margin-top:2px}.tot{display:flex;justify-content:space-between;margin-top:12px;font-weight:700}.due{color:#b3261e}.muted{color:#888;font-size:11px;margin-top:14px;text-align:center}</style>
      </head><body>
      ${settings.logo ? `<img src="${settings.logo}" style="display:block;margin:0 0 6px;max-height:56px;max-width:150px"/>` : ''}
      <h1>${settings.name}</h1>
      <div class="sub">${[settings.location, settings.phone ? 'Tel ' + displayPhone(settings.phone) : '', settings.poBox, settings.email, settings.website].filter(Boolean).join(' · ')} · Customer statement</div>
      <div><b>${customer.name}</b> · ${displayPhone(customer.phone)}</div>
      <div class="sub">As of ${shortDateTime(Date.now())}</div>
      <table><thead><tr><th>Date</th><th>Items / payments</th><th class="a">Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="3">No purchases yet.</td></tr>'}</tbody></table>
      <div class="tot"><span>Total purchases</span><span>${money(totalSpent, cur)}</span></div>
      <div class="tot ${totalOwed > 0 ? 'due' : ''}"><span>Still pending</span><span>${totalOwed > 0 ? money(totalOwed, cur) : 'nothing ✓'}</span></div>
      ${customer.points ? `<div class="tot"><span>Loyalty points</span><span>⭐ ${customer.points}</span></div>` : ''}
      <div class="muted">Thank you for your business — Asante!</div>
      </body></html>`)
    w.document.close(); w.focus(); w.print()
  }

  return (
    <>
      <Modal open onClose={onClose} title={customer.name}>
        {/* Contact & badges */}
        <div className="rounded-2xl bg-brand-50 p-4 dark:bg-brand-900">
          <div className="flex flex-wrap items-center gap-2">
            {customer.isShop && <Badge color="amber"><Store size={11} /> shop / business</Badge>}
            {linkedSupplier && <Badge color="green"><Link2 size={11} /> also your supplier</Badge>}
            {(customer.points || 0) > 0 && <Badge color="gold">⭐ {customer.points} points</Badge>}
          </div>
          <div className="mt-2 space-y-1 text-sm text-brand-900/70 dark:text-white/70">
            <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 hover:underline">
              <Phone size={13} /> {customer.isShop ? 'Shop' : 'Phone'}: {displayPhone(customer.phone)}
            </a>
            {customer.ownerName && (
              <div className="flex items-center gap-1.5">
                <Store size={13} /> Owner: {customer.ownerName}
                {customer.ownerPhone && (
                  <a href={`tel:${customer.ownerPhone}`} className="hover:underline">· {displayPhone(customer.ownerPhone)}</a>
                )}
              </div>
            )}
            {customer.note && <div className="text-xs text-brand-900/50 dark:text-white/50">{customer.note}</div>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-white/70 py-2 dark:bg-white/10">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">They owe you</div>
              <div className={`text-lg font-black ${totalOwed > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                {totalOwed > 0 ? money(totalOwed, settings.currency) : 'Nothing ✓'}
              </div>
            </div>
            <div className="rounded-xl bg-white/70 py-2 dark:bg-white/10">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/50 dark:text-white/50">You owe them</div>
              <div className={`text-lg font-black ${shopOwesThem > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}`}>
                {shopOwesThem > 0 ? money(shopOwesThem, settings.currency) : 'Nothing ✓'}
              </div>
            </div>
          </div>
        </div>

        {/* Unpaid debts in detail */}
        {openDebts.length > 0 && (
          <>
            <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-brand-900/50 dark:text-white/50">Unpaid debts</h3>
            <div className="space-y-2">
              {openDebts.map((d) => {
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
                                {p.note ? <span className="italic"> — "{p.note}"</span> : ''}
                              </span>
                              <span className="font-semibold text-green-700 dark:text-green-400">-{money(p.amount, settings.currency)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <CommentThread
                      comments={d.comments ?? []}
                      draft={commentDrafts[d.id] ?? ''}
                      setDraft={(v) => setCommentDrafts((m) => ({ ...m, [d.id]: v }))}
                      onAdd={() => {
                        const text = (commentDrafts[d.id] ?? '').trim()
                        if (!text) return
                        addDebtComment(d.id, text)
                        setCommentDrafts((m) => ({ ...m, [d.id]: '' }))
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Settled debts — kept forever so a customer can see how they cleared. */}
        {settledDebts.length > 0 && (
          <>
            <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-brand-900/50 dark:text-white/50">Cleared debts — how they paid</h3>
            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {settledDebts.map((d) => (
                <div key={d.id} className="rounded-xl bg-black/5 px-3 py-2 dark:bg-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-brand-900 dark:text-white">{d.receiptNo}</span>
                    <Badge color="green"><CheckCircle2 size={11} /> cleared</Badge>
                  </div>
                  <div className="text-[11px] text-brand-900/50 dark:text-white/50">taken {shortDate(d.createdAt)} · {money(d.originalAmount, settings.currency)}</div>
                  {d.payments.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {d.payments.map((p) => (
                        <li key={p.id} className="flex justify-between text-brand-900/70 dark:text-white/70">
                          <span>{shortDate(p.at)} · {METHOD[p.method] || p.method}{p.ref ? ` (${p.ref})` : ''}</span>
                          <span className="font-semibold text-green-700 dark:text-green-400">-{money(p.amount, settings.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Purchase history incl. fully-paid sales */}
        <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-brand-900/50 dark:text-white/50">
          Purchase history (incl. paid)
        </h3>
        {customerSales.length > 0 && (
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <label className="text-[10px] font-semibold text-brand-900/50 dark:text-white/50">From<input type="date" className="input mt-0.5 py-1.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="text-[10px] font-semibold text-brand-900/50 dark:text-white/50">To<input type="date" className="input mt-0.5 py-1.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            {(from || to) && <button className="btn-ghost py-1.5 text-xs" onClick={() => { setFrom(''); setTo('') }}>Clear</button>}
          </div>
        )}
        {salesShown.length === 0 ? (
          <p className="text-sm text-brand-900/40 dark:text-white/40">{customerSales.length === 0 ? 'No purchases recorded yet.' : 'No purchases in that date range.'}</p>
        ) : (
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {salesShown.map((s) => {
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
                      {status === 'paid' && <Badge color="green"><CheckCircle2 size={11} /> PAID</Badge>}
                      {status === 'cleared' && <Badge color="green">debt cleared ✓</Badge>}
                      {status === 'open' && <Badge color="red">on credit</Badge>}
                    </span>
                  </div>
                  <div className="text-[11px] text-brand-900/50 dark:text-white/50">
                    {shortDateTime(s.createdAt)} · served by {s.cashierName}{s.assignedToName ? ` (for ${s.assignedToName})` : ''}
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-brand-900/60 dark:text-white/60">
                    {s.lines.map((l, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{l.qty}{l.unit ? l.unit : ''}× {l.name} <span className="text-brand-900/35 dark:text-white/35">@ {money(l.price, settings.currency)}</span></span>
                        <span className="shrink-0 font-semibold">{money(l.price * l.qty, settings.currency)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-2 border-t border-black/5 pt-0.5 dark:border-white/5">
                      <span>Paid by {s.tenders.map((t) => METHOD[t.method] || t.method).join(', ')}</span>
                      {s.note ? <span className="italic text-brand-900/40 dark:text-white/40">"{s.note}"</span> : null}
                    </li>
                  </ul>
                </div>
              )
            })}
          </div>
        )}

        {/* Actions */}
        {totalOwed > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn-primary" onClick={() => setPayOpen(true)}>
              <Wallet size={16} /> Record payment
            </button>
            <a
              className="btn-ghost"
              href={whatsappLink(customer.phone, buildCombinedReminder(settings, customer, openDebts))}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={16} /> Remind
            </a>
          </div>
        )}

        {/* Statement — full purchase & payment history; works after settlement. */}
        <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-brand-900/50 dark:text-white/50">Give the customer their statement</h3>
        <div className="grid grid-cols-3 gap-2">
          <button className="btn-ghost text-sm" onClick={printStatement}>
            <Printer size={16} /> Print
          </button>
          <a className="btn-ghost text-sm" href={whatsappLink(customer.phone, statementText())} target="_blank" rel="noreferrer">
            <MessageCircle size={16} /> WhatsApp
          </a>
          <a className="btn-ghost text-sm" href={smsLink(customer.phone, statementText())}>
            <Send size={16} /> SMS
          </a>
        </div>
      </Modal>

      {payOpen && <RepaymentModal customer={customer} onClose={() => setPayOpen(false)} />}
    </>
  )
}

/** Record a repayment against one of the customer's open debts. */
export function RepaymentModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const settings = useStore((s) => s.settings)
  const debts = useStore((s) => s.debts)
  const recordDebtPayment = useStore((s) => s.recordDebtPayment)

  const open = useMemo(
    () => debts.filter((d) => d.customerId === customer.id && d.status === 'open' && d.balance > 0).sort((a, b) => a.createdAt - b.createdAt),
    [debts, customer.id],
  )
  const [selected, setSelected] = useState<Debt | undefined>(open[0])
  const [amount, setAmount] = useState<number>(open[0]?.balance ?? 0)
  const [method, setMethod] = useState<PaymentMethod>('mpesa')
  const [ref, setRef] = useState('')
  const [note, setNote] = useState('')

  if (!selected) return null

  function pay() {
    if (!selected || amount <= 0) return
    recordDebtPayment(selected.id, Math.min(amount, selected.balance), method, ref || undefined, note.trim() || undefined)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={`${customer.name} — record payment`}>
      <div className="mb-3 space-y-1.5">
        <label className="label">Which sale?</label>
        {open.map((d) => (
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
      <div className="mt-3">
        <label className="label">Comment (optional)</label>
        <input className="input" placeholder='e.g. "paid at the shop, 9am"' value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

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

/** Comments on a debt — "promised Friday", "Brian collected 500 at 9am"… */
export function CommentThread({
  comments,
  draft,
  setDraft,
  onAdd,
}: {
  comments: { id: string; text: string; at: number; byStaffName: string }[]
  draft: string
  setDraft: (v: string) => void
  onAdd: () => void
}) {
  return (
    <div className="mt-1.5">
      {comments.length > 0 && (
        <ul className="mb-1 space-y-0.5 text-xs">
          {comments.map((c) => (
            <li key={c.id} className="text-brand-900/70 dark:text-white/70">
              <span className="italic">"{c.text}"</span>
              <span className="text-brand-900/40 dark:text-white/40"> — {c.byStaffName}, {shortDateTime(c.at)}</span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          onAdd()
        }}
      >
        <input className="input flex-1 py-1.5 text-xs" placeholder="Add a comment…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="btn-ghost px-3 py-1.5 text-xs" disabled={!draft.trim()}>
          Add
        </button>
      </form>
    </div>
  )
}
