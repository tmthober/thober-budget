import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import CategoryPicker from './CategoryPicker'
import CategoryStatus from './CategoryStatus'
import CurrencyInput, { centsToAmount } from './CurrencyInput'
import OverspendWarning from './OverspendWarning'
import { monthKeyFromDateString } from '../lib/budget'
import { checkOverspend } from '../lib/overspend'
import { useToast } from '../lib/ToastContext'

export default function AddTransactionForm({ onSaved, onCancel }) {
  const showToast = useToast()
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [amountCents, setAmountCents] = useState(0)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [overspendInfo, setOverspendInfo] = useState(null)

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

    const savedCategoryId = categoryId
    const monthKey = monthKeyFromDateString(date)
    setAmountCents(0)
    setNote('')

    let overspend = null
    try {
      overspend = await checkOverspend(savedCategoryId, monthKey)
    } catch {
      overspend = null
    }
    if (overspend) {
      setOverspendInfo(overspend)
    } else {
      showToast('Lançamento salvo')
      onSaved()
    }
  }

  if (overspendInfo) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <OverspendWarning
          overspendInfo={overspendInfo}
          categories={categories}
          onResolve={() => { setOverspendInfo(null); showToast('Lançamento salvo'); onSaved() }}
        />
      </motion.div>
    )
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
        <CategoryStatus categoryId={categoryId} monthKey={monthKeyFromDateString(date)} />
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

      <motion.button
        className="primary-btn"
        type="submit"
        disabled={saving}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1 }}
      >
        {saving ? 'Salvando...' : 'Salvar lançamento'}
      </motion.button>

      <button
        type="button"
        className="secondary-btn"
        onClick={onCancel}
        disabled={saving}
        style={{ width: '100%', marginTop: 10 }}
      >
        Cancelar
      </button>
    </form>
  )
}
