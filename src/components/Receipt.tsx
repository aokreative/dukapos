import { Printer, MessageCircle, Send, Plus } from 'lucide-react'
import { Modal } from './ui'
import { useStore } from '../store/useStore'
import type { Sale, BusinessSettings } from '../types'
import { money, shortDateTime } from '../lib/format'
import { paymentInstructionsShort, smsLink, whatsappLink, vatIncludedIn } from '../lib/reminders'

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-PESA',
  airtel: 'Airtel Money',
  card: 'Card',
  credit: 'Credit (Mkopo)',
  points: 'Points ⭐',
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
  const vat = vatIncludedIn(sale.total, settings)
  return (
    `*${shopName}*\n` +
    (settings.etimsEnabled && settings.kraPin ? `KRA PIN: ${settings.kraPin} · eTIMS\n` : '') +
    `Receipt ${sale.receiptNo}\n` +
    `${shortDateTime(sale.createdAt)}\n` +
    `--------------------------\n` +
    `${lines}\n` +
    `--------------------------\n` +
    (sale.discount > 0 ? `Discount: -${money(sale.discount, currency)}\n` : '') +
    `*TOTAL: ${money(sale.total, currency)}*\n` +
    (vat > 0 ? `VAT (${settings.vatRate}%) incl.: ${money(vat, currency)}\n` : '') +
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
  if (!sale) return null

  const customer = sale.customerId ? customers.find((c) => c.id === sale.customerId) : undefined
  const paid = sale.tenders.filter((t) => t.method !== 'credit').reduce((a, t) => a + t.amount, 0)
  const cashTender = sale.tenders.find((t) => t.method === 'cash')
  const receiptText = buildReceiptText(sale, settings)
  const vat = vatIncludedIn(sale.total, settings)

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
        table{width:100%;border-collapse:collapse;margin:6px 0}
        hr{border:none;border-top:1px dashed #000}
        .total{font-weight:bold;font-size:14px}
      </style></head><body>
      <h1>${settings.name}</h1>
      <div class="muted">${settings.location || ''}</div>
      ${settings.etimsEnabled && settings.kraPin ? `<div class="muted">KRA PIN: ${settings.kraPin} · eTIMS</div>` : ''}
      <div class="muted">${paymentInstructionsShort(settings)}</div>
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
        <tr class="total"><td>TOTAL</td><td style="text-align:right">${money(sale!.total, settings.currency)}</td></tr>
        ${vat > 0 ? `<tr><td>VAT (${settings.vatRate}%) incl.</td><td style="text-align:right">${money(vat, settings.currency)}</td></tr>` : ''}
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
    <Modal open={open} onClose={onClose} title="Sale complete ✓">
      <div className="rounded-2xl bg-brand-50 p-4 dark:bg-brand-900">
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide text-brand-900/50 dark:text-white/50">Total</div>
          <div className="text-3xl font-black text-brand-700 dark:text-gold-400">{money(sale.total, settings.currency)}</div>
          {vat > 0 && (
            <div className="text-xs text-brand-900/50 dark:text-white/50">Incl. VAT ({settings.vatRate}%): {money(vat, settings.currency)}</div>
          )}
          <div className="text-xs text-brand-900/50 dark:text-white/50">Receipt {sale.receiptNo}</div>
          {settings.etimsEnabled && settings.kraPin && (
            <div className="mt-0.5 text-[11px] font-medium text-brand-900/40 dark:text-white/40">KRA PIN {settings.kraPin} · eTIMS</div>
          )}
        </div>

        <div className="mt-4 space-y-1 text-sm">
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

      <button className="btn-primary mt-3 w-full" onClick={onNewSale}>
        <Plus size={18} /> New sale
      </button>
    </Modal>
  )
}
