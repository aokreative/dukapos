// Duka AI — ask questions about your business in plain language.
// With a backend + AI key it uses Claude; otherwise it answers locally from
// the shop's own numbers, so it always works (even offline).
import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { useStore } from '../store/useStore'
import { askAssistant } from '../lib/api'
import { buildShopSnapshot, localAnswer, SUGGESTED_QUESTIONS } from '../lib/assistant'

interface ChatMsg {
  role: 'user' | 'ai'
  text: string
}

export default function Assistant() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (msgs.length) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, busy])

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return
    setInput('')
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setBusy(true)
    try {
      const s = useStore.getState()
      const snapshot = buildShopSnapshot({
        business: s.settings.name,
        currency: s.settings.currency,
        sales: s.sales,
        products: s.products,
        customers: s.customers,
        debts: s.debts,
        suppliers: s.suppliers,
        supplierTxns: s.supplierTxns,
        staff: s.staff,
        locations: s.locations,
        transfers: s.transfers,
        returns: s.returns,
        businessType: s.settings.businessType,
      })
      // Claude via the backend when available (with chat memory for
      // follow-up questions); local rules otherwise.
      const remote = await askAssistant(q, snapshot, msgs.slice(-10))
      const answer = remote ?? localAnswer(q, snapshot)
      setMsgs((m) => [...m, { role: 'ai', text: answer }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] max-w-2xl flex-col md:h-[calc(100vh-5rem)]">
      <PageHeader title="Duka AI" subtitle="Ask anything about your shop — sales, debts, stock" />

      <div className="flex-1 space-y-3 overflow-y-auto pb-4 pr-1">
        {msgs.length === 0 && (
          <div className="card p-5 text-center">
            <Sparkles className="mx-auto mb-2 text-gold-500" size={28} />
            <div className="font-bold text-brand-900 dark:text-white">Habari! I'm Duka AI.</div>
            <p className="mt-1 text-sm text-brand-900/60 dark:text-white/60">
              I know your sales, debts and stock. Ask me anything — or tap a question below.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button key={q} className="chip bg-brand-50 text-brand-800 hover:bg-brand-100 dark:bg-white/10 dark:text-white dark:hover:bg-white/20" onClick={() => ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                m.role === 'user'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-brand-900 shadow-sm dark:bg-white/10 dark:text-white'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white px-4 py-2.5 text-sm text-brand-900/50 shadow-sm dark:bg-white/10 dark:text-white/50">
              Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-20 flex gap-2 pb-1 md:bottom-0"
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
      >
        <input
          className="input flex-1"
          placeholder="Ask about your shop…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn-primary px-4" type="submit" disabled={!input.trim() || busy} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}
