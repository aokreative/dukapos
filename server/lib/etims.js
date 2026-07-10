// KRA eTIMS (electronic Tax Invoice Management System) — sales submission.
//
// Real eTIMS integration requires onboarding with KRA: you register the
// business on eTIMS, get a device/branch registered (OSCU/VSCU), and receive
// an API endpoint + credentials. Until those are set, this module simulates —
// receipts still show the shop's KRA PIN so the paper trail is ready.
//
// Env (see INTEGRATIONS.md):
//   ETIMS_ENDPOINT  e.g. https://etims-api-sbx.kra.go.ke/etims-api  (sandbox)
//   ETIMS_TIN       the shop's KRA PIN (P0xxxxxxxxX)
//   ETIMS_BHF_ID    branch id, usually "00"
//   ETIMS_CMC_KEY   the device/communication key issued at device init

const ENDPOINT = (process.env.ETIMS_ENDPOINT || '').replace(/\/$/, '')
const TIN = process.env.ETIMS_TIN || ''
const BHF_ID = process.env.ETIMS_BHF_ID || '00'
const CMC_KEY = process.env.ETIMS_CMC_KEY || ''

export function etimsConfigured() {
  return !!(ENDPOINT && TIN && CMC_KEY)
}

/**
 * Submit one sale to eTIMS (trnsSales/saveSales shape). Returns a receipt
 * signature the POS can print. Simulates when not configured.
 * sale: { receiptNo, total, vat, lines: [{name, qty, price}], at }
 */
export async function etimsSubmitSale(sale) {
  if (!etimsConfigured()) {
    return {
      configured: false,
      simulated: true,
      signature: 'SIM' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      detail: 'eTIMS not configured — simulated. Set ETIMS_* env vars to go live.',
    }
  }
  const now = new Date(sale.at || Date.now())
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  const body = {
    tin: TIN,
    bhfId: BHF_ID,
    cmcKey: CMC_KEY,
    invcNo: sale.receiptNo,
    salesTyCd: 'N', // normal sale
    rcptTyCd: 'S', // sale receipt
    pmtTyCd: '01', // cash-equivalent
    salesSttsCd: '02', // approved
    cfmDt: stamp,
    salesDt: stamp.slice(0, 8),
    totAmt: sale.total,
    totTaxAmt: sale.vat || 0,
    itemList: (sale.lines || []).map((l, i) => ({
      itemSeq: i + 1,
      itemNm: l.name,
      qty: l.qty,
      prc: l.price,
      splyAmt: l.price * l.qty,
      totAmt: l.price * l.qty,
    })),
  }
  const res = await fetch(`${ENDPOINT}/trnsSales/saveSales`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cmcKey: CMC_KEY, tin: TIN, bhfId: BHF_ID },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || (data.resultCd && data.resultCd !== '000')) {
    throw new Error(data.resultMsg || `eTIMS submit failed: HTTP ${res.status}`)
  }
  return {
    configured: true,
    simulated: false,
    signature: data?.data?.rcptSign || data?.data?.intrlData || 'OK',
    detail: 'Invoice registered with KRA eTIMS',
  }
}
