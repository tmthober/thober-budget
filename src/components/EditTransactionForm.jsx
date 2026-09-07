import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import CategoryPicker from './CategoryPicker'
import CurrencyInput, { amountToCents, centsToAmount } from './CurrencyInput'
import { IconChevronLeft } from './icons'

export default function EditTransactionForm({ transaction, onBack, onSaved, onDeleted }) {
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState(transaction.category_id)
  const [amountCents, setAmountCents] = useState(amountToCents(Math.abs(transaction.amount)))
  const [date, setDate] = useState(transaction.date)
  const [note, setNote] = useState(transaction.note ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

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
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        category_id: categoryId,
        amount: centsToAmount(amountCents),
        date,
        note: note || null,
      })
      .eq('id', transaction.id)
    setSaving(false)
    if (updateError) {
      setError('Não foi possível salvar. Tente novamente.')
      return
    }
    onSaved()
  }

  async function handleDelete() {
    setDeleting(true)
    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transaction.id)
    setDeleting(false)
    if (deleteError) {
      setError('Não foi possível excluir. Tente novamente.')
      return
    }
    onDeleted()
  }

  return (
    <div>
      <div className="edit-header">
        <button className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconChevronLeft />
        </button>
        <span>Editar lançamento</span>
        <span style={{ width: 44 }} />
      </div>

      <form className="form-screen" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="edit-category">Categoria</label>
          <CategoryPicker
            groups={groups}
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />
        </div>

        <div className="form-field">
          <label htmlFor="edit-amount">Valor</label>
          <CurrencyInput id="edit-amount" cents={amountCents} onChange={setAmountCents} />
        </div>

        <div className="form-field">
          <label htmlFor="edit-date">Data</label>
          <input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="form-field">
          <label htmlFor="edit-note">Observação (opcional)</label>
          <input id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: almoço com Duds" />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="primary-btn" type="submit" disabled={saving || deleting}>
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>

        {!confirmingDelete ? (
          <button
            type="button"
            className="danger-link-btn"
            onClick={() => setConfirmingDelete(true)}
            disabled={saving || deleting}
          >
            Excluir lançamento
          </button>
        ) : (
          <div className="confirm-delete">
            <p>Excluir este lançamento? Não dá pra desfazer.</p>
            <div className="confirm-delete-actions">
              <button type="button" className="secondary-btn" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </button>
              <button type="button" className="danger-btn" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Excluindo...' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
