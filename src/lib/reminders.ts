// ---------------------------------------------------------------------------
// Debt reminders — the heart of the added feature.
//
// Builds a friendly reminder message that ALWAYS includes how the customer can
// pay you back (the payment method), then turns it into a WhatsApp or SMS link
// that opens the phone's own app pre-filled. Works fully offline: we don't send
// anything from a server, we hand the ready message to WhatsApp / the SMS app.
// ---------------------------------------------------------------------------

import type { BizLocation, BusinessSettings, Customer, Debt } from '../types'
import type { ShopMpesaCreds } from './api'
import { money, normalizePhone } from './format'

/**
 * Merge a branch's own Till/Paybill over the shop default. When a branch has
 * its own M-PESA number set, sales made there show/collect to THAT number on
 * receipts and reminders; otherwise the shop-wide default (Settings) applies.
 */
export function settingsForLocation(
  s: BusinessSettings,
  loc?: Pick<BizLocation, 'mpesaType' | 'mpesaTill' | 'mpesaPaybill' | 'mpesaAccount'> | null,
): BusinessSettings {
  if (!loc || !loc.mpesaType) return s
  return {
    ...s,
    mpesaType: loc.mpesaType,
    mpesaTill: loc.mpesaType === 'till' ? (loc.mpesaTill || '').trim() : s.mpesaTill,
    mpesaPaybill: loc.mpesaType === 'paybill' ? (loc.mpesaPaybill || '').trim() : s.mpesaPaybill,
    mpesaAccount: loc.mpesaAccount != null && loc.mpesaAccount !== '' ? loc.mpesaAccount.trim() : s.mpesaAccount,
  }
}

/**
 * The shop's OWN M-PESA STK credentials, ready to send to the backend so a
 * "Prompt" at the till pushes the bill to the customer's phone and the money
 * lands in THIS shop's till/Paybill. Returns null unless the owner has turned
 * it on and filled in all four keys — otherwise the till simply works the
 * normal way (customer pays the till/Paybill shown on the receipt).
 */
export function shopMpesaCreds(s: BusinessSettings): ShopMpesaCreds | null {
  if (!s.mpesaStkEnabled) return null
  const shortcode = (s.mpesaStkShortcode || (s.mpesaType === 'paybill' ? s.mpesaPaybill : s.mpesaTill) || '').trim()
  const key = (s.mpesaConsumerKey || '').trim()
  const secret = (s.mpesaConsumerSecret || '').trim()
  const passkey = (s.mpesaPasskey || '').trim()
  if (!key || !secret || !passkey || !shortcode) return null
  return {
    consumerKey: key,
    consumerSecret: secret,
    passkey,
    shortcode,
    env: s.mpesaStkEnv === 'sandbox' ? 'sandbox' : 'production',
    txType: s.mpesaType === 'paybill' ? 'CustomerPayBillOnline' : 'CustomerBuyGoodsOnline',
  }
}

/** VAT that is *included* in a VAT-inclusive total (Kenyan convention). */
export function vatIncludedIn(total: number, s: Pick<BusinessSettings, 'vatEnabled' | 'vatRate'>): number {
  if (!s.vatEnabled || !s.vatRate) return 0
  return Math.round((total * s.vatRate) / (100 + s.vatRate))
}

/**
 * Human-readable payment instructions derived from the shop's settings.
 * This is the "payment method" that gets embedded in every reminder.
 */
export function paymentInstructions(s: BusinessSettings): string {
  const lines: string[] = []
  if (s.mpesaType === 'till' && s.mpesaTill.trim()) {
    lines.push(`M-PESA Buy Goods (Till): ${s.mpesaTill.trim()}`)
  } else if (s.mpesaType === 'paybill' && s.mpesaPaybill.trim()) {
    const acc = s.mpesaAccount.trim()
    lines.push(`M-PESA Paybill: ${s.mpesaPaybill.trim()}${acc ? ` (Acc: ${acc})` : ''}`)
  }
  if (s.airtelNumber?.trim()) lines.push(`Airtel Money: ${s.airtelNumber.trim()}`)
  if (s.acceptCash) lines.push('Or pay cash at the shop')
  if (lines.length === 0) lines.push('Please contact the shop to arrange payment')
  return lines.join('\n')
}

/** A single-line version for tight UI. */
export function paymentInstructionsShort(s: BusinessSettings): string {
  if (s.mpesaType === 'till' && s.mpesaTill.trim()) return `M-PESA Till ${s.mpesaTill.trim()}`
  if (s.mpesaType === 'paybill' && s.mpesaPaybill.trim())
    return `M-PESA Paybill ${s.mpesaPaybill.trim()}${s.mpesaAccount.trim() ? ` / ${s.mpesaAccount.trim()}` : ''}`
  if (s.acceptCash) return 'Cash at shop'
  return 'Contact shop'
}

export const DEFAULT_TEMPLATE =
  'Habari {name}, this is a friendly reminder from {business}. ' +
  'Your outstanding balance is {amount} (receipt {receipt}).\n\n' +
  'Kindly pay via:\n{pay}\n\nAsante sana!'

/**
 * Fill the reminder template for a given customer + debt.
 * The {pay} placeholder is replaced with the payment instructions, guaranteeing
 * the payment method is present even if the owner edits the template.
 */
export function buildReminderMessage(
  settings: BusinessSettings,
  customer: Customer,
  debt: Debt,
): string {
  const pay = paymentInstructions(settings)
  const template = settings.reminderTemplate?.trim() || DEFAULT_TEMPLATE
  let msg = template
    .replaceAll('{name}', customer.name || 'customer')
    .replaceAll('{business}', settings.name || 'our shop')
    .replaceAll('{amount}', money(debt.balance, settings.currency))
    .replaceAll('{receipt}', debt.receiptNo)
    .replaceAll('{pay}', pay)

  // Safety net: if the owner removed {pay}, append the payment method anyway.
  if (!template.includes('{pay}')) {
    msg += `\n\nPay via:\n${pay}`
  }
  return msg
}

/** Combined balance across several debts, for a "remind about everything" message. */
export function buildCombinedReminder(
  settings: BusinessSettings,
  customer: Customer,
  debts: Debt[],
): string {
  const total = debts.reduce((s, d) => s + d.balance, 0)
  const pay = paymentInstructions(settings)
  const receipts = debts.map((d) => d.receiptNo).join(', ')
  return (
    `Habari ${customer.name || 'customer'}, a friendly reminder from ${settings.name || 'our shop'}. ` +
    `Your total outstanding balance is ${money(total, settings.currency)} across ${debts.length} ` +
    `sale${debts.length > 1 ? 's' : ''} (${receipts}).\n\n` +
    `Kindly pay via:\n${pay}\n\nAsante sana!`
  )
}

/** WhatsApp click-to-chat deep link with the message pre-filled. */
export function whatsappLink(phone: string, message: string): string {
  const n = normalizePhone(phone)
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`
}

/** SMS link with the body pre-filled — opens the native messaging app. */
export function smsLink(phone: string, message: string): string {
  const n = normalizePhone(phone)
  // The `?&body=` form is the most widely-compatible across Android & iOS.
  return `sms:${n}?&body=${encodeURIComponent(message)}`
}
