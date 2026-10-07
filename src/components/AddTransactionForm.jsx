import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import CategoryPicker from './CategoryPicker'
import CategoryStatus from './CategoryStatus'
import AccountStatus from './AccountStatus'
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
  const [kind, setKind] = useState('expense')
  const [accounts, setAccounts] = useState([])
  const [accountId, setAccountId] = useState('')
  const [balanceRefresh, setBalanceRefresh] = useState(0)
  const [amountCents, setAmountCents] = useState(0)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
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
      const list = a.data ?? []
      setAccounts(list)
      const firstChecking = list.find((x) => x.type === 'checking') ?? list[0]
      if (firstChecking) setAccountId(firstChecking.id)
    }
    load()
  }, [])

  // Entrada não vai para cartão; gasto pode ir para qualquer conta.
  const accountOptions = accounts.filter((a) => kind === 'expense' || a.type !== 'credit_card')
  const selectedAccount = accounts.find((a) => a.id === accountId)
  // Entrada e gasto de caixinha ficam fora do orçamento: sem categoria.
  const needsCategory = kind === 'expense' && selectedAccount?.type !== 'tracking'
  const pickableCategories = categories.filter((c) => !c.is_income && !c.is_card_payment)

  function changeKind(next) {
    setKind(next)
    if (next === 'income' && selectedAccount?.type === 'credit_card') {
      const firstChecking = accounts.find((a) => a.type === 'checking')
      if (firstChecking) setAccountId(firstChecking.id)
    }
  }

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
    const { error: insertError } = await supabase.from('transactions').insert({
      kind,
      category_id: needsCategory ? categoryId : null,
      amount: centsToAmount(amountCents),
      date,
      note: note || null,
      ...(accountId ? { account_id: accountId } : {}),
    })
    setSaving(false)
    if (insertError) {
      setError('Não foi possível salvar. Tente novamente.')
      return
    }

    const savedCategoryId = categoryId
    const monthKey = monthKeyFromDateString(date)
    setAmountCents(0)
    setBalanceRefresh((n) => n + 1)
    setNote('')

    let overspend = null
    if (needsCategory) {
      try {
        overspend = await checkOverspend(savedCategoryId, monthKey)
      } catch {
        overspend = null
      }
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
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
      <div className="kind-toggle" role="group" aria-label="Tipo de lançamento">
        <button type="button" className={kind === 'expense' ? 'active' : ''} onClick={() => changeKind('expense')}>
          Gasto
        </button>
        <button type="button" className={kind === 'income' ? 'active' : ''} onClick={() => changeKind('income')}>
          Entrada
        </button>
      </div>

      {accounts.length > 0 && (
        <div className="form-field">
          <label htmlFor="account">Conta</label>
          <select id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {kind === 'expense' && selectedAccount?.type === 'credit_card' && (
            <p className="category-status neutral">
              Compra no cartão: o valor também é reservado em Pagamento do cartão.
            </p>
          )}
          {selectedAccount?.type === 'tracking' && (
            <AccountStatus accountId={selectedAccount.id} refreshKey={balanceRefresh} />
          )}
          {selectedAccount?.type === 'tracking' && (
            <p className="category-status neutral">
              Caixinha fica fora do orçamento: este lançamento não usa categoria.
            </p>
          )}
          {kind === 'income' && selectedAccount?.type === 'checking' && (
            <p className="category-status neutral">
              A entrada vai para "Pronto para orçar".
            </p>
          )}
        </div>
      )}

      {needsCategory && (
        <div className="form-field">
          <label htmlFor="category">Categoria</label>
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
        {saving ? 'Salvando...' : kind === 'income' ? 'Salvar entrada' : 'Salvar lançamento'}
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
