import { useEffect, useState } from 'react'
import { formatCurrency } from '../lib/budget'
import { fetchCategorySummary } from '../lib/overspend'

export default function CategoryStatus({ categoryId, monthKey }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!categoryId) {
      setSummary(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchCategorySummary(categoryId, monthKey).then((result) => {
      if (!cancelled) {
        setSummary(result)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [categoryId, monthKey])

  if (!categoryId) return null
  if (loading || !summary) {
    return <p className="category-status">Carregando orçamento da categoria...</p>
  }

  const { budgetedThisMonth, available } = summary
  const tone = available < -0.005 ? 'negative' : available < 0.005 ? 'neutral' : 'positive'

  return (
    <p className={`category-status ${tone}`}>
      Orçado {formatCurrency(budgetedThisMonth)} · Disponível{' '}
      <strong>{formatCurrency(available)}</strong>
    </p>
  )
}
