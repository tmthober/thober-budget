import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { IconChevronLeft } from './icons'
import { formatCurrency, formatMonthLabel, toMonthKey } from '../lib/budget'
import { useToast } from '../lib/ToastContext'

// Formata 'YYYY-MM-DD' como 'DD/MM' para exibição na timeline
function formatDay(dateStr) {
  const [, , dd] = dateStr.split('-')
  return `${dd}/${dateStr.slice(5, 7)}`
}


export default function CategoryDetailView({ category, month, onBack, onDataChanged }) {
  const showToast = useToast()
  const monthKey = toMonthKey(month)

  const [transactions, setTransactions] = useState([])
  const [moves, setMoves] = useState([])
  const [budgetedThisMonth, setBudgetedThisMonth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Estado de edição do orçamento
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [editError, setEditError] = useState(null)
  const [saving, setSaving] = useState(false)

  const ymTarget = monthKey.slice(0, 7) // 'YYYY-MM'

  async function loadData() {
    setLoading(true)
    setLoadError(false)
    const [txRes, movesRes, budgetRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('category_id', category.id)
        .gte('date', `${ymTarget}-01`)
        .lte('date', `${ymTarget}-31`)
        .order('date', { ascending: true }),
      supabase
        .from('overspend_moves')
        .select('*, from_cat:from_category_id(name), to_cat:to_category_id(name)')
        .eq('month', monthKey)
        .or(`from_category_id.eq.${category.id},to_category_id.eq.${category.id}`),
      supabase
        .from('budget_entries')
        .select('budgeted_amount')
        .eq('category_id', category.id)
        .eq('month', monthKey)
        .maybeSingle(),
    ])

    if (txRes.error || movesRes.error || budgetRes.error) {
      setLoadError(true)
      setLoading(false)
      return
    }

    setTransactions(txRes.data ?? [])
    setMoves(movesRes.data ?? [])
    const bAmt = budgetRes.data ? Number(budgetRes.data.budgeted_amount) : 0
    setBudgetedThisMonth(bAmt)
    setEditValue(String(bAmt || ''))
    setLoading(false)
  }

  useEffect(() => { loadData() }, [category.id, monthKey])

  async function saveEdit() {
    setSaving(true)
    setEditError(null)
    const amount = parseFloat(String(editValue).replace(',', '.')) || 0
    const { error } = await supabase.from('budget_entries').upsert(
      { category_id: category.id, month: monthKey, budgeted_amount: amount },
      { onConflict: 'category_id,month' }
    )
    setSaving(false)
    if (error) {
      setEditError('Não foi possível salvar. Verifique sua internet e tente de novo.')
      return
    }
    setEditing(false)
    setBudgetedThisMonth(amount)
    setEditError(null)
    showToast('Orçamento atualizado')
    onDataChanged?.()
  }

  function cancelEdit() {
    setEditing(false)
    setEditValue(String(budgetedThisMonth || ''))
    setEditError(null)
  }

  // Monta a timeline: transações + moves, ordenados por data/posição
  // Moves não têm hora — colocamos ao final do dia do mês (sem data específica),
  // representados com dateSort = monthKey + sufixo para ficarem juntos no final
  function buildTimeline() {
    const items = []

    for (const tx of transactions) {
      items.push({
        key: `tx-${tx.id}`,
        sort: tx.date + '-tx',
        date: tx.date,
        type: 'transaction',
        data: tx,
      })
    }

    for (const mv of moves) {
      const isBorrowed = mv.to_category_id === category.id
      items.push({
        key: `mv-${mv.id}`,
        // Moves ficam após transações do dia final do mês (sem data exata)
        sort: monthKey.slice(0, 7) + '-99-mv',
        date: null,
        type: isBorrowed ? 'borrowed' : 'lent',
        data: mv,
      })
    }

    items.sort((a, b) => a.sort.localeCompare(b.sort))
    return items
  }

  const timeline = buildTimeline()
  const totalSpent = transactions.reduce((s, t) => s + Number(t.amount), 0)
  const totalBorrowed = moves
    .filter((m) => m.to_category_id === category.id)
    .reduce((s, m) => s + Number(m.amount), 0)
  const totalLent = moves
    .filter((m) => m.from_category_id === category.id)
    .reduce((s, m) => s + Number(m.amount), 0)

  return (
    <div className="detail-view">
      {/* Cabeçalho com botão voltar */}
      <div className="detail-header">
        <button className="icon-btn detail-back-btn" onClick={onBack} aria-label="Voltar">
          <IconChevronLeft />
        </button>
        <div className="detail-header-text">
          <h2 className="detail-title">{category.name}</h2>
          <p className="detail-subtitle">{formatMonthLabel(month)}</p>
        </div>
      </div>

      {loading && <div className="empty-state">Carregando...</div>}

      {!loading && loadError && (
        <div className="empty-state">
          <p>Não foi possível carregar. Verifique sua conexão.</p>
          <button className="secondary-btn" onClick={loadData} style={{ marginTop: 12 }}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {/* Card de resumo */}
          <div className="detail-summary-card">
            <div className="detail-summary-row">
              <span className="detail-summary-label">Orçado</span>
              {editing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    style={{ width: 110, fontSize: 14, padding: '4px 8px', textAlign: 'right' }}
                  />
                  <button
                    className="secondary-btn"
                    onClick={saveEdit}
                    disabled={saving}
                    style={{ padding: '4px 10px', fontSize: 13 }}
                  >
                    {saving ? '...' : 'Salvar'}
                  </button>
                  <button
                    className="secondary-btn"
                    onClick={cancelEdit}
                    disabled={saving}
                    style={{ padding: '4px 10px', fontSize: 13 }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="detail-summary-value">{formatCurrency(budgetedThisMonth)}</span>
                  <button
                    className="secondary-btn"
                    onClick={() => setEditing(true)}
                    style={{ padding: '4px 10px', fontSize: 13 }}
                  >
                    Editar
                  </button>
                </div>
              )}
            </div>
            {editError && (
              <p className="edit-error-text" style={{ textAlign: 'right', marginTop: 4 }}>
                {editError}
              </p>
            )}
            <div className="detail-summary-row">
              <span className="detail-summary-label">Gasto no mês</span>
              <span className="detail-summary-value">{formatCurrency(totalSpent)}</span>
            </div>
            {totalBorrowed > 0 && (
              <div className="detail-summary-row">
                <span className="detail-summary-label">Recebeu de empréstimo</span>
                <span className="detail-summary-value detail-borrowed">{formatCurrency(totalBorrowed)}</span>
              </div>
            )}
            {totalLent > 0 && (
              <div className="detail-summary-row">
                <span className="detail-summary-label">Emprestou pra outras</span>
                <span className="detail-summary-value detail-lent">{formatCurrency(totalLent)}</span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <h3 className="detail-section-title">Movimentações do mês</h3>

          {timeline.length === 0 ? (
            <p className="empty-state" style={{ paddingTop: 24 }}>
              Nenhuma movimentação neste mês.
            </p>
          ) : (
            <div className="detail-timeline">
              {timeline.map((item) => {
                if (item.type === 'transaction') {
                  const tx = item.data
                  return (
                    <div className="timeline-item" key={item.key}>
                      <div className="timeline-dot tx-dot" />
                      <div className="timeline-body">
                        <div className="timeline-row">
                          <span className="timeline-date">{formatDay(tx.date)}</span>
                          <span className="timeline-amount tx-amount">
                            − {formatCurrency(Number(tx.amount))}
                          </span>
                        </div>
                        {tx.note && (
                          <p className="timeline-note">{tx.note}</p>
                        )}
                      </div>
                    </div>
                  )
                }

                if (item.type === 'borrowed') {
                  const mv = item.data
                  const fromName = mv.from_cat?.name ?? 'outra categoria'
                  return (
                    <div className="timeline-item" key={item.key}>
                      <div className="timeline-dot borrow-dot" />
                      <div className="timeline-body">
                        <div className="timeline-row">
                          <span className="timeline-label borrow-label">Cobertura de estouro</span>
                          <span className="timeline-amount borrow-amount">
                            + {formatCurrency(Number(mv.amount))}
                          </span>
                        </div>
                        <p className="timeline-note">De: {fromName}</p>
                      </div>
                    </div>
                  )
                }

                if (item.type === 'lent') {
                  const mv = item.data
                  const toName = mv.to_cat?.name ?? 'outra categoria'
                  return (
                    <div className="timeline-item" key={item.key}>
                      <div className="timeline-dot lent-dot" />
                      <div className="timeline-body">
                        <div className="timeline-row">
                          <span className="timeline-label lent-label">Empréstimo concedido</span>
                          <span className="timeline-amount lent-amount">
                            − {formatCurrency(Number(mv.amount))}
                          </span>
                        </div>
                        <p className="timeline-note">Para: {toName}</p>
                      </div>
                    </div>
                  )
                }

                return null
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
