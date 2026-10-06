import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'
import CategoryPicker from './CategoryPicker'
import CategoryStatus from './CategoryStatus'
import CurrencyInput, { amountToCents, centsToAmount } from './CurrencyInput'
import OverspendWarning from './OverspendWarning'
import { IconChevronLeft } from './icons'
import { monthKeyFromDateString } from '../lib/budget'
import { checkOverspend } from '../lib/overspend'
import { useToast } from '../lib/ToastContext'

export default function EditTransactionForm({ transaction, onBack, onSaved, onDeleted }) {
  const showToast = useToast()
  const [groups, setGroups] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? '')
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState(transaction.account_id ?? '')
  const [amountCents, setAmountCents] = useState(amountToCents(Math.abs(transaction.amount)))
  const [date, setDate] = useState(transaction.date)
  const [note, setNote] = useState(transaction.note ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [overspendInfo, setOverspendInfo] = useState(null)

  useEffect(() => {
    async function load() {
      const [g, c, a] = await Promise.all([
        supabase.from('category_groups').select('*').order('sort_order'),
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('accounts').select('*').order('sort_order'),
      ])
      setGroups(g.data ?? [])
      setCategories(c.data ?? [])
      setAccounts(a.data ?? [])
    }
    load()
  }, [])

  const kind = transaction.kind ?? 'expense'
  const accountOptions = accounts.filter((a) => kind === 'expense' || a.type !== 'credit_card')
  const selectedAccount = accounts.find((a) => a.id === accountId)
  const needsCategory = kind === 'expense' && selectedAccount?.type !== 'tracking'
  const pickableCategories = categories.filter((c) => !c.is_income && !c.is_card_payment)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (needsCategory && !categoryId) {
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
        category_id: needsCategory ? categoryId : null,
        amount: centsToAmount(amountCents),
        date,
        note: note || null,
        ...(accountId ? { account_id: accountId } : {}),
      })
      .eq('id', transaction.id)
    setSaving(false)
    if (updateError) {
      setError('Não foi possível salvar. Tente novamente.')
      return
    }

    const monthKey = monthKeyFromDateString(date)
    let overspend = null
    if (needsCategory) {
      try {
        overspend = await checkOverspend(categoryId, monthKey)
      } catch {
        overspend = null
      }
    }
    if (overspend) {
      setOverspendInfo(overspend)
    } else {
      showToast('Alterações salvas')
      onSaved()
    }
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
    showToast('Lançamento excluído')
    onDeleted()
  }

  if (overspendInfo) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <OverspendWarning
          overspendInfo={overspendInfo}
          categories={categories}
          onResolve={() => { setOverspendInfo(null); showToast('Alterações salvas'); onSaved() }}
        />
      </motion.div>
    )
  }

  return (
    <div>
      <div className="edit-header">
        <button className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconChevronLeft />
        </button>
        <span>{kind === 'income' ? 'Editar entrada' : 'Editar lançamento'}</span>
        <span style={{ width: 44 }} />
      </div>

      <form className="form-screen" onSubmit={handleSubmit}>
        {accounts.length > 0 && (
          <div className="form-field">
            <label htmlFor="edit-account">Conta</label>
            <select id="edit-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {selectedAccount?.type === 'tracking' && (
              <p className="category-status neutral">
                Caixinha fica fora do orçamento: este lançamento não usa categoria.
              </p>
            )}
          </div>
        )}

        {needsCategory && (
          <div className="form-field">
            <label htmlFor="edit-category">Categoria</label>
            <CategoryPicker
              groups={groups}
              categories={pickableCategories}
              value={categoryId}
              onChange={setCategoryId}
            />
            <CategoryStatus categoryId={categoryId} monthKey={monthKeyFromDateString(date)} />
          </div>
        )}

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

        <motion.button
          className="primary-btn"
          type="submit"
          disabled={saving || deleting}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1 }}
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </motion.button>

        <AnimatePresence mode="wait">
          {!confirmingDelete ? (
            <motion.button
              key="ask"
              type="button"
              className="danger-link-btn"
              onClick={() => setConfirmingDelete(true)}
              disabled={saving || deleting}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              Excluir lançamento
            </motion.button>
          ) : (
            <motion.div
              key="confirm"
              className="confirm-delete"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <p>Excluir este lançamento? Não dá pra desfazer.</p>
              <div className="confirm-delete-actions">
                <button type="button" className="secondary-btn" onClick={() => setConfirmingDelete(false)}>
                  Cancelar
                </button>
                <button type="button" className="danger-btn" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Excluindo...' : 'Sim, excluir'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  )
}
