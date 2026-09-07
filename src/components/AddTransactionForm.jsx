import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import CategoryPicker from './CategoryPicker'
import CurrencyInput, { centsToAmount } from './CurrencyInput'

export default function AddTransactionForm({ onSaved }) {
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [amountCents, setAmountCents] = useState(0)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [g, c] = await Promise.all([
        supabase.from('category_groups').select('*').order('sort_order'),
        supabase.from('categories').select('*').order('sort_order'),
      ])
      setGroups(g.data ?? [])
      setCategories(c.data ?? [])
    }
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!categoryId) {
      setError('Escolha uma categoria.')
      return
    }
    if (!amountCents || amountCents <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    setSaving(true)
    const { error: insertError } = await supabase.from('transactions').insert({
      category_id: categoryId,
      amount: centsToAmount(amountCents),
      date,
      note: note || null,
    })
    setSaving(false)
    if (insertError) {
      setError('Não foi possível salvar. Tente novamente.')
      return
    }
    setAmountCents(0)
    setNote('')
    onSaved()
  }

  return (
    <form className="form-screen" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="category">Categoria</label>
        <CategoryPicker
          groups={groups}
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
        />
      </div>

      <div className="form-field">
        <label htmlFor="amount">Valor</label>
        <CurrencyInput id="amount" cents={amountCents} onChange={setAmountCents} />
      </div>

      <div className="form-field">
        <label htmlFor="date">Data</label>
        <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="form-field">
        <label htmlFor="note">Observação (opcional)</label>
        <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: almoço com Duds" />
      </div>

      {error && <p className="error-text">{error}</p>}

      <button className="primary-btn" type="submit" disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar lançamento'}
      </button>
    </form>
  )
}
