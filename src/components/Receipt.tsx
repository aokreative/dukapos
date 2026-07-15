import { useEffect, useState } from 'react'
import { Printer, MessageCircle, Send, Plus, Undo2, ShieldAlert } from 'lucide-react'
import { Modal } from './ui'
import { useStore, selectRole, selectCurrentStaff } from '../store/useStore'
import type { Sale, BusinessSettings } from '../types'
import { money, shortDateTime, displayPhone } from '../lib/format'
import { can, canStaff } from '../lib/permissions'
import { paymentInstructionsShort, settingsForLocation, smsLink, whatsappLink, vatIncludedIn } from '../lib/reminders'

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-PESA',
  airtel: 'Airtel Money',
  card: 'Card',
  credit: 'Credit (Mkopo)',
  points: 'Points ⭐',
}

// Quick reasons a cashier can tap instead of typing — the common mistakes.
const VOID_REASONS = ['Wrong item', 'Wrong quantity', 'Wrong price', 'Wrong size/colour', 'Faulty item', 'Customer cancelled']

/** One line of shop contact details: phone · P.O. Box · email · website. */
export function contactLine(s: BusinessSettings): string {
  return [s.phone ? `Tel ${displayPhone(s.phone)}` : '', s.poBox || '', s.email || '', s.website || '']
    .filter(Boolean)
    .join(' · ')
}

export function buildReceiptText(sale: Sale, settings: BusinessSettings): string {
  const shopName = settings.name
  const currency = settings.currency
  const lines = sale.lines.map((l) => `${l.qty}${l.unit ? l.unit : ''} x ${l.name}  —  ${money(l.price * l.qty, currency)}`).join('\n')
  const tenders = sale.tenders.map((t) => `${METHOD_LABEL[t.method]}: ${money(t.amount, currency)}${t.ref ? ` (${t.ref})` : ''}`).join('\n')
  const warranties = sale.lines
    .filter((l) => l.warrantyMonths)
    .map((l) => `Warranty: ${l.name} — ${l.warrantyMonths} months`)
    .join('\n')
  // VAT added on top → show the full breakdown up to the grand total.
  const vatX = sale.vatAmount ?? 0
  const goods = Math.round((sale.total - vatX) * 100) / 100
  const vatIncl = vatX > 0 ? 0 : settings.vatMode === 'inclusive' ? vatIncludedIn(sale.total, settings) : 0
  const contacts = contactLine(settings)
  return (
    `*${shopName}*\n` +
    (contacts ? `${contacts}\n` : '') +
    (settings.etimsEnabled && settings.kraPin ? `KRA PIN: ${settings.kraPin} · eTIMS\n` : '') +
    `Receipt ${sale.receiptNo}\n` +
    `${shortDateTime(sale.createdAt)}\n` +
    `--------------------------\n` +
    `${lines}\n` +
    `--------------------------\n` +
    (sale.discount > 0 ? `Discount: -${money(sale.discount, currency)}\n` : '') +
    (vatX > 0
      ? `Goods: ${money(goods, currency)}\nVAT (${settings.vatRate}%): ${money(vatX, currency)}\n*GRAND TOTAL: ${money(sale.total, currency)}*\n`
      : `*TOTAL: ${money(sale.total, currency)}*\n` +
        (vatIncl > 0 ? `VAT (${settings.vatRate}%) incl.: ${money(vatIncl, currency)}\n` : '')) +
    `${tenders}\n` +
    (sale.creditAmount > 0 ? `\nBalance on credit: ${money(sale.creditAmount, currency)}\n` : '') +
    (sale.pointsEarned ? `⭐ Points earned: +${sale.pointsEarned}\n` : '') +
    (warranties ? `\n${warranties}\n` : '') +
    `\nAsante! Karibu tena.`
  )
}

export default function Receipt({
  sale,
  open,
  onClose,
  onNewSale,
}: {
  sale: Sale | null
  open: boolean
  onClose: () => void
  onNewSale: () => void
}) {
  const settings = useStore((s) => s.settings)
  const customers = useStore((s) => s.customers)
  const locations = useStore((s) => s.locations)
  const staff = useStore((s) => s.staff)
  const role = useStore(selectRole)
  const currentStaff = useStore(selectCurrentStaff)
  const voidSale = useStore((s) => s.voidSale)
  // Live voided state so the banner appears the instant the sale is reversed.
  const voided = useStore((s) => (sale ? !!s.sales.find((x) => x.id === sale.id)?.voided : false))

  const [voidOpen, setVoidOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  // Reset the void panel whenever a different receipt is shown.
  useEffect(() => {
    setVoidOpen(false)
    setReason('')
    setPin('')
    setErr('')
  }, [sale?.id])

  if (!sale) return null

  const customer = sale.customerId ? customers.find((c) => c.id === sale.customerId) : undefined
  const paid = sale.tenders.filter((t) => t.method !== 'credit').reduce((a, t) => a + t.amount, 0)
  const cashTender = sale.tenders.find((t) => t.method === 'cash')
  const receiptText = buildReceiptText(sale, settings)
  // VAT added on top (stored on the sale) vs. informational VAT-in-price.
  const vatX = sale.vatAmount ?? 0
  const goods = Math.round((sale.total - vatX) * 100) / 100
  const vatIncl = vatX > 0 ? 0 : settings.vatMode === 'inclusive' ? vatIncludedIn(sale.total, settings) : 0
  // Sales made at a branch with its own Till/Paybill show THAT number.
  const branch = locations.find((l) => l.id === sale.locationId)
  const eff = settingsForLocation(settings, branch)
  const payTo = paymentInstructionsShort(eff)
  const canVoidDirect = can(role, 'voidRefund')

  function confirmVoid() {
    if (!sale) return
    if (!reason.trim()) return setErr('Please choose or type a reason.')
    let byName = currentStaff?.name
    if (!canVoidDirect) {
      const mgr = staff.find((m) => m.active && m.pin === pin.trim() && canStaff(m, 'voidRefund'))
      if (!mgr) return setErr('Manager PIN not recognised.')
      byName = mgr.name
    }
    voidSale(sale.id, reason.trim(), byName)
    setVoidOpen(false)
    setErr('')
  }

  function printReceipt() {
    const w = window.open('', 'print', 'width=320,height=600')
    if (!w) return
    const rows = sale!.lines
      .map((l) => `<tr><td>${l.qty}${l.unit ? l.unit : ''} x ${l.name}</td><td style="text-align:right">${money(l.price * l.qty, settings.currency)}</td></tr>`)
      .join('')
    const warrantyRows = sale!.lines
      .filter((l) => l.warrantyMonths)
      .map((l) => {
        const until = new Date(sale!.createdAt + l.warrantyMonths! * 30 * 24 * 60 * 60 * 1000)
        return `<div class="muted">Warranty: ${l.name} — ${l.warrantyMonths} months (till ${until.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })})</div>`
      })
      .join('')
    const tenders = sale!.tenders
      .map((t) => `<tr><td>${METHOD_LABEL[t.method]}${t.ref ? ` (${t.ref})` : ''}</td><td style="text-align:right">${money(t.amount, settings.currency)}</td></tr>`)
      .join('')
    w.document.write(`
      <html><head><title>${sale!.receiptNo}</title>
      <style>
        *{font-family:monospace;font-size:12px;color:#000}
        body{width:280px;margin:0 auto;padding:8px}
        h1{font-size:16px;text-align:center;margin:4px 0}
        .muted{text-align:center;color:#333;margin:2px 0}
        .void{text-align:center;color:#b3261e;font-weight:bold;font-size:15px;border:2px solid #b3261e;padding:4px;margin:6px 0}
        table{width:100%;border-collapse:collapse;margin:6px 0}
        hr{border:none;border-top:1px dashed #000}
        .total{font-weight:bold;font-size:14px}
      </style></head><body>
      ${settings.logo ? `<img src="${settings.logo}" style="display:block;margin:2px auto 4px;max-height:60px;max-width:150px"/>` : ''}
      <h1>${settings.name}</h1>
      <div class="muted">${branch ? branch.name + ' · ' : ''}${settings.location || ''}</div>
      ${contactLine(settings) ? `<div class="muted">${contactLine(settings)}</div>` : ''}
      ${voided ? `<div class="void">VOIDED / REVERSED${sale!.voidReason ? `<br/><span style="font-weight:normal;font-size:11px">${sale!.voidReason}</span>` : ''}</div>` : ''}
      ${settings.etimsEnabled && settings.kraPin ? `<div class="muted">KRA PIN: ${settings.kraPin} · eTIMS</div>` : ''}
      <div class="muted">${payTo}</div>
      <hr/>
      <div>Receipt: ${sale!.receiptNo}</div>
      <div>${shortDateTime(sale!.createdAt)}</div>
      <div>Served by: ${sale!.cashierName}${sale!.assignedToName ? ` (sale for ${sale!.assignedToName})` : ''}</div>
      ${sale!.note ? `<div>Note: ${sale!.note}</div>` : ''}
      <hr/>
      <table>${rows}</table>
      <hr/>
      <table>
        ${sale!.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">-${money(sale!.discount, settings.currency)}</td></tr>` : ''}
        ${
          vatX > 0
            ? `<tr><td>Goods</td><td style="text-align:right">${money(goods, settings.currency)}</td></tr>
               <tr><td>VAT (${settings.vatRate}%)</td><td style="text-align:right">${money(vatX, settings.currency)}</td></tr>
               <tr class="total"><td>GRAND TOTAL</td><td style="text-align:right">${money(sale!.total, settings.currency)}</td></tr>`
            : `<tr class="total"><td>TOTAL</td><td style="text-align:right">${money(sale!.total, settings.currency)}</td></tr>
               ${vatIncl > 0 ? `<tr><td>VAT (${settings.vatRate}%) incl.</td><td style="text-align:right">${money(vatIncl, settings.currency)}</td></tr>` : ''}`
        }
        ${tenders}
        ${sale!.creditAmount > 0 ? `<tr><td>On credit</td><td style="text-align:right">${money(sale!.creditAmount, settings.currency)}</td></tr>` : ''}
        ${sale!.pointsEarned ? `<tr><td>Points earned</td><td style="text-align:right">+${sale!.pointsEarned}</td></tr>` : ''}
      </table>
      ${warrantyRows}
      <hr/>
      <div class="muted">${settings.tagline || 'Asante! Karibu tena.'}</div>
      </body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Receipt ${sale.receiptNo}`}>
      {voided && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          <ShieldAlert size={16} className="shrink-0" />
          <span>
            Voided / reversed{sale.voidedBy ? ` by ${sale.voidedBy}` : ''}
            {sale.voidReason ? ` — "${sale.voidReason}"` : ''}. Stock, any debt and points were reversed.
          </span>
        </div>
      )}
      <div className={`rounded-2xl bg-brand-50 p-4 dark:bg-brand-900 ${voided ? 'opacity-60' : ''}`}>
        <div className="text-center">
          {settings.logo && <img src={settings.logo} alt="" className="mx-auto mb-1 max-h-12 max-w-[130px] object-contain" />}
          {contactLine(settings) !== '' && (
            <div className="mb-1 text-[10px] leading-tight text-brand-900/40 dark:text-white/40">{contactLine(settings)}</div>
          )}
          <div className="text-xs uppercase tracking-wide text-brand-900/50 dark:text-white/50">{vatX > 0 ? 'Grand total' : 'Total'}</div>
          <div className={`text-3xl font-black text-brand-700 dark:text-gold-400 ${voided ? 'line-through' : ''}`}>{money(sale.total, settings.currency)}</div>
          {vatX > 0 && (
            <div className="text-xs text-brand-900/60 dark:text-white/60">Goods {money(goods, settings.currency)} + VAT ({settings.vatRate}%) {money(vatX, settings.currency)}</div>
          )}
          {vatIncl > 0 && (
            <div className="text-xs text-brand-900/50 dark:text-white/50">Incl. VAT ({settings.vatRate}%): {money(vatIncl, settings.currency)}</div>
          )}
          <div className="text-xs text-brand-900/50 dark:text-white/50">Receipt {sale.receiptNo}</div>
          {settings.etimsEnabled && settings.kraPin && (
            <div className="mt-0.5 text-[11px] font-medium text-brand-900/40 dark:text-white/40">KRA PIN {settings.kraPin} · eTIMS</div>
          )}
        </div>

        {/* Who served it & when */}
        <div className="mt-3 border-t border-black/10 pt-3 text-xs text-brand-900/60 dark:border-white/10 dark:text-white/60">
          <div>{shortDateTime(sale.createdAt)}</div>
          <div>Served by {sale.cashierName}{sale.assignedToName ? ` (for ${sale.assignedToName})` : ''}</div>
          {branch && <div>Branch: {branch.name}</div>}
          {customer && <div>Customer: {customer.name}</div>}
          {sale.note && <div className="italic">Note: "{sale.note}"</div>}
        </div>

        {/* Itemised — every item, quantity, unit price and line total */}
        <div className="mt-3 space-y-1 border-t border-black/10 pt-3 dark:border-white/10">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-900/40 dark:text-white/40">Items</div>
          {sale.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-2 text-sm">
              <span className="min-w-0 text-brand-900/80 dark:text-white/80">
                <span className="font-semibold">{l.qty}{l.unit ? l.unit : ''} × {l.name}</span>
                <span className="text-brand-900/40 dark:text-white/40"> @ {money(l.price, settings.currency)}{l.unit ? `/${l.unit}` : ''}</span>
                {l.warrantyMonths ? <span className="text-brand-900/40 dark:text-white/40"> · {l.warrantyMonths}mo warranty</span> : ''}
              </span>
              <span className="shrink-0 font-semibold text-brand-900 dark:text-white">{money(l.price * l.qty, settings.currency)}</span>
            </div>
          ))}
          {sale.discount > 0 && (
            <div className="flex justify-between border-t border-black/5 pt-1 text-sm text-brand-900/60 dark:border-white/5 dark:text-white/60">
              <span>Discount</span>
              <span>-{money(sale.discount, settings.currency)}</span>
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1 border-t border-black/10 pt-3 text-sm dark:border-white/10">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-900/40 dark:text-white/40">Payment</div>
          {sale.tenders.map((t, i) => (
            <div key={i} className="flex justify-between text-brand-900/80 dark:text-white/80">
              <span>{METHOD_LABEL[t.method]}{t.ref ? ` · ${t.ref}` : ''}</span>
              <span className="font-semibold">{money(t.amount, settings.currency)}</span>
            </div>
          ))}
          {cashTender && paid > sale.total && (
            <div className="flex justify-between font-semibold text-green-700 dark:text-green-400">
              <span>Change</span>
              <span>{money(paid - sale.total, settings.currency)}</span>
            </div>
          )}
          {sale.creditAmount > 0 && (
            <div className="mt-2 flex justify-between rounded-lg bg-red-100 px-3 py-2 font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-300">
              <span>On credit{customer ? ` · ${customer.name}` : ''}</span>
              <span>{money(sale.creditAmount, settings.currency)}</span>
            </div>
          )}
          {(sale.pointsEarned || sale.pointsRedeemed) && (
            <div className="mt-2 flex justify-between rounded-lg bg-gold-400/15 px-3 py-2 font-semibold text-gold-700 dark:text-gold-300">
              <span>⭐ {sale.pointsRedeemed ? `Used ${sale.pointsRedeemed}` : ''}{sale.pointsEarned ? `${sale.pointsRedeemed ? ' · ' : ''}Earned +${sale.pointsEarned}` : ''}</span>
              {customer && <span>Bal: {customer.points ?? 0}</span>}
            </div>
          )}
          {payTo && payTo !== 'Contact shop' && (
            <div className="mt-1 text-xs text-brand-900/50 dark:text-white/50">Pay to: {payTo}</div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn-ghost" onClick={printReceipt}>
          <Printer size={18} /> Print
        </button>
        {customer ? (
          <a className="btn-ghost" href={whatsappLink(customer.phone, receiptText)} target="_blank" rel="noreferrer">
            <MessageCircle size={18} /> WhatsApp
          </a>
        ) : (
          <button className="btn-ghost" disabled title="Attach a customer to send">
            <MessageCircle size={18} /> WhatsApp
          </button>
        )}
        {customer && (
          <a className="btn-ghost col-span-2" href={smsLink(customer.phone, receiptText)}>
            <Send size={18} /> Send receipt by SMS
          </a>
        )}
      </div>

      {/* Void / reverse — for a mistaken or faulty sale. Puts stock back, cancels
          any mkopo debt, and reverses loyalty points. Then ring the correct one. */}
      {!voided && (
        <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
          {!voidOpen ? (
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
              onClick={() => setVoidOpen(true)}
            >
              <Undo2 size={16} /> Void / reverse this sale
            </button>
          ) : (
            <div className="rounded-xl bg-red-50 p-3 dark:bg-red-500/10">
              <p className="mb-2 text-xs font-semibold text-red-700 dark:text-red-300">
                Reverse this sale? Stock goes back, any credit is cancelled and loyalty points are undone.
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {VOID_REASONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setReason(r); setErr('') }}
                    className={`chip px-2.5 py-1 text-xs ${reason === r ? 'bg-red-600 text-white' : 'bg-white text-brand-900/70 dark:bg-white/10 dark:text-white/70'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                className="input py-2 text-sm"
                placeholder="Reason (required)"
                value={reason}
                onChange={(e) => { setReason(e.target.value); setErr('') }}
              />
              {!canVoidDirect && (
                <div className="mt-2">
                  <label className="mb-1 block text-xs font-semibold text-red-700 dark:text-red-300">Manager PIN to authorise</label>
                  <input
                    className="input py-2 text-sm"
                    inputMode="numeric"
                    type="password"
                    placeholder="Manager / owner PIN"
                    value={pin}
                    onChange={(e) => { setPin(e.target.value); setErr('') }}
                  />
                </div>
              )}
              {err && <p className="mt-1.5 text-xs font-semibold text-red-600">{err}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-ghost py-2 text-sm" onClick={() => { setVoidOpen(false); setErr(''); setPin('') }}>
                  Cancel
                </button>
                <button className="btn-danger py-2 text-sm" onClick={confirmVoid}>
                  <Undo2 size={16} /> Void sale
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button className="btn-primary mt-3 w-full" onClick={onNewSale}>
        <Plus size={18} /> {voided ? 'Ring the correct sale' : 'New sale'}
      </button>
    </Modal>
  )
}
