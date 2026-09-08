import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatCurrency } from '../lib/budget'
import { computeCategorySummaries } from '../lib/budget'
import { moveBudgetedAmount } from '../lib/overspend'
import CurrencyInput, { amountToCents, centsToAmount } from './CurrencyInput'

export default function OverspendWarning({ overspendInfo, categories, onResolve }) {
  const { category, monthKey, overspentAmount } = overspendInfo
  const [budgetEntries, setBudgetEntries] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [amountCents, setAmountCents] = useState(amountToCents(overspentAmount))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [b, t] = await Promise.all([
        supabase.from('budget_entries').select('*'),
        supabase.from('transactions').select('*'),
      ])
      setBudgetEntries(b.data ?? [])
      setTransactions(t.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="empty-state">Carregando categorias...</div>

  const summaries = computeCategorySummaries(categories, budgetEntries, transactions, monthKey)
  const options = summaries
    .filter((c) => c.id !== category.id && !c.is_income && c.available > 0)
    .sort((a, b) => b.available - a.available)

  function handleSelect(cat) {
    setSelectedId(cat.id)
    setAmountCents(amountToCents(Math.min(overspentAmount, cat.available)))
  }

  async function handleConfirm() {
    setError('')
    if (!selectedId) {
      setError('Escolha uma categoria pra cobrir a diferença.')
      return
    }
    const amount = centsToAmount(amountCents)
    if (!amount || amount <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    setSaving(true)
    const { error: moveError } = await moveBudgetedAmount(selectedId, category.id, monthKey, amount)
    setSaving(false)
    if (moveError) {
      setError('Não foi possível mover o valor. Tente novamente.')
      return
    }
    onResolve()
  }

  return (
    <div className="overspend-screen">
      <div className="overspend-alert">
        <p className="overspend-title">⚠️ {category.name} ficou negativa</p>
        <p className="overspend-sub">
          Você estourou {formatCurrency(overspentAmount)} do orçado nessa categoria. De qual
          categoria quer cobrir a diferença?
        </p>
      </div>

      {options.length === 0 ? (
        <p className="empty-state">
          Nenhuma outra categoria tem saldo disponível pra cobrir agora. Você pode ajustar o
          orçado manualmente na tela de Orçamento.
        </p>
      ) : (
        <div className="overspend-options">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`overspend-option ${selectedId === opt.id ? 'selected' : ''}`}
              onClick={() => handleSelect(opt)}
            >
              <span>{opt.name}</span>
              <span className="overspend-option-available">{formatCurrency(opt.available)}</span>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="form-field" style={{ padding: '0 18px' }}>
          <label htmlFor="move-amount">Valor a mover</label>
          <CurrencyInput id="move-amount" cents={amountCents} onChange={setAmountCents} />
        </div>
      )}

      {error && <p className="error-text" style={{ padding: '0 18px' }}>{error}</p>}

      <div className="overspend-actions">
        {selectedId && (
          <button className="primary-btn" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Movendo...' : 'Mover e continuar'}
          </button>
        )}
        <button className="secondary-btn" onClick={onResolve} disabled={saving} style={{ width: '100%' }}>
          Ignorar por enquanto
        </button>
      </div>
    </div>
  )
}
