import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../supabaseClient'
import CurrencyInput, { amountToCents, centsToAmount } from './CurrencyInput'
import { IconChevronLeft } from './icons'
import { formatCurrency } from '../lib/budget'
import { useToast } from '../lib/ToastContext'
import {
  ACCOUNT_TYPE_LABELS,
  loadAccountsData,
  computeBalances,
  startingBalanceFor,
} from '../lib/accounts'

function accountMeta(acc) {
  if (acc.type === 'credit_card') {
    const parts = []
    if (acc.closing_day) parts.push(`fecha dia ${acc.closing_day}`)
    if (acc.due_day) parts.push(`vence dia ${acc.due_day}`)
    return parts.length ? `Cartão · ${parts.join(' · ')}` : 'Cartão de crédito'
  }
  return ACCOUNT_TYPE_LABELS[acc.type]
}

function amtClass(value) {
  if (value > 0) return 'amt income'
  if (value < 0) return 'amt'
  return 'amt zero'
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')
}

function ScreenHeader({ title, onBack }) {
  return (
    <div className="edit-header">
      <button className="icon-btn" onClick={onBack} aria-label="Voltar">
        <IconChevronLeft />
      </button>
      <span>{title}</span>
      <span style={{ width: 44 }} />
    </div>
  )
}

function AccountEditor({ account, currentBalance, accounts, hasMovements, onBack, onSaved }) {
  const showToast = useToast()
  const isNew = !account
  const type = account ? account.type : 'tracking'
  const isCard = type === 'credit_card'

  // No cartão o usuário informa quanto DEVE (positivo); internamente é negativo.
  const initialCents = isNew ? 0 : amountToCents(Math.abs(currentBalance))
  const [name, setName] = useState(account?.name ?? '')
  const [cents, setCents] = useState(initialCents)
  const [closingDay, setClosingDay] = useState(account?.closing_day ?? '')
  const [dueDay, setDueDay] = useState(account?.due_day ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function parseDay(v) {
    if (v === '' || v === null) return null
    const n = parseInt(v, 10)
    return Number.isFinite(n) && n >= 1 && n <= 31 ? n : NaN
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Informe um nome.')
      return
    }
    const closing = parseDay(closingDay)
    const due = parseDay(dueDay)
    if (Number.isNaN(closing) || Number.isNaN(due)) {
      setError('Os dias de fechamento e vencimento devem ficar entre 1 e 31.')
      return
    }
    setSaving(true)
    const desired = (isCard ? -1 : 1) * centsToAmount(cents)

    let result
    if (isNew) {
      const nextOrder = accounts.reduce((m, a) => Math.max(m, a.sort_order), 0) + 1
      result = await supabase.from('accounts').insert({
        name: name.trim(),
        type: 'tracking',
        sort_order: nextOrder,
        starting_balance: desired,
      })
    } else {
      const patch = { name: name.trim() }
      if (isCard) {
        patch.closing_day = closing
        patch.due_day = due
      }
      // Só recalcula o saldo se o valor foi realmente alterado.
      if (cents !== initialCents) {
        patch.starting_balance = startingBalanceFor(account, currentBalance, desired)
      }
      result = await supabase.from('accounts').update(patch).eq('id', account.id)
    }
    setSaving(false)
    if (result.error) {
      setError('Não foi possível salvar. Tente novamente.')
      return
    }
    showToast(isNew ? 'Caixinha criada' : 'Conta atualizada')
    onSaved()
  }

  async function handleDelete() {
    setSaving(true)
    const { error: delError } = await supabase.from('accounts').delete().eq('id', account.id)
    setSaving(false)
    if (delError) {
      setError('Não foi possível excluir. Tente novamente.')
      return
    }
    showToast('Caixinha excluída')
    onSaved()
  }

  const title = isNew ? 'Nova caixinha' : `Editar ${ACCOUNT_TYPE_LABELS[type].toLowerCase()}`

  return (
    <div>
      <ScreenHeader title={title} onBack={onBack} />
      <form className="form-screen" onSubmit={handleSave}>
        <div className="form-field">
          <label htmlFor="acc-name">Nome</label>
          <input
            id="acc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Presentes de aniversário"
          />
        </div>

        <div className="form-field">
          <label htmlFor="acc-balance">
            {isCard ? 'Quanto você deve hoje (fatura em aberto)' : 'Saldo atual'}
          </label>
          <CurrencyInput id="acc-balance" cents={cents} onChange={setCents} />
          {!isNew && (
            <p className="category-status neutral">
              Ao mudar este valor, o app ajusta o saldo inicial da conta. Seus lançamentos não são alterados.
            </p>
          )}
        </div>

        {isCard && (
          <>
            <div className="form-field">
              <label htmlFor="acc-closing">Dia de fechamento da fatura</label>
              <input
                id="acc-closing"
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="acc-due">Dia de vencimento</label>
              <input
                id="acc-due"
                type="number"
                inputMode="numeric"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </div>
          </>
        )}

        {error && <p className="error-text">{error}</p>}

        <motion.button
          className="primary-btn"
          type="submit"
          disabled={saving}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1 }}
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </motion.button>

        <button
          type="button"
          className="secondary-btn"
          onClick={onBack}
          disabled={saving}
          style={{ width: '100%', marginTop: 10 }}
        >
          Cancelar
        </button>

        {!isNew && type === 'tracking' && (
          hasMovements ? (
            <p className="category-status neutral" style={{ marginTop: 14 }}>
              Esta caixinha tem movimentações e não pode ser excluída.
            </p>
          ) : !confirmingDelete ? (
            <button
              type="button"
              className="danger-link-btn"
              onClick={() => setConfirmingDelete(true)}
              disabled={saving}
            >
              Excluir caixinha
            </button>
          ) : (
            <div className="confirm-delete">
              <p>Excluir esta caixinha? Não dá pra desfazer.</p>
              <div className="confirm-delete-actions">
                <button type="button" className="secondary-btn" onClick={() => setConfirmingDelete(false)}>
                  Cancelar
                </button>
                <button type="button" className="danger-btn" onClick={handleDelete} disabled={saving}>
                  Sim, excluir
                </button>
              </div>
            </div>
          )
        )}
      </form>
    </div>
  )
}

function TransferForm({ accounts, onBack, onSaved }) {
  const showToast = useToast()
  const [fromId, setFromId] = useState(accounts[0]?.id ?? '')
  const [toId, setToId] = useState(accounts[1]?.id ?? '')
  const [cents, setCents] = useState(0)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const toAccount = accounts.find((a) => a.id === toId)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!fromId || !toId) {
      setError('Escolha as duas contas.')
      return
    }
    if (fromId === toId) {
      setError('A conta de origem e a de destino precisam ser diferentes.')
      return
    }
    if (!cents || cents <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    setSaving(true)
    const { error: insertError } = await supabase.from('account_transfers').insert({
      date,
      from_account_id: fromId,
      to_account_id: toId,
      amount: centsToAmount(cents),
      note: note || null,
    })
    setSaving(false)
    if (insertError) {
      setError('Não foi possível salvar. Tente novamente.')
      return
    }
    showToast('Transferência salva')
    onSaved()
  }

  return (
    <div>
      <ScreenHeader title="Transferir" onBack={onBack} />
      <form className="form-screen" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="tr-from">De</label>
          <select id="tr-from" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="tr-to">Para</label>
          <select id="tr-to" value={toId} onChange={(e) => setToId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {toAccount?.type === 'credit_card' && (
            <p className="category-status neutral">Pagamento de fatura: reduz o que você deve no cartão.</p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="tr-amount">Valor</label>
          <CurrencyInput id="tr-amount" cents={cents} onChange={setCents} />
        </div>

        <div className="form-field">
          <label htmlFor="tr-date">Data</label>
          <input id="tr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="form-field">
          <label htmlFor="tr-note">Observação (opcional)</label>
          <input id="tr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: pagamento da fatura" />
        </div>

        {error && <p className="error-text">{error}</p>}

        <motion.button
          className="primary-btn"
          type="submit"
          disabled={saving}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1 }}
        >
          {saving ? 'Salvando...' : 'Salvar transferência'}
        </motion.button>

        <button
          type="button"
          className="secondary-btn"
          onClick={onBack}
          disabled={saving}
          style={{ width: '100%', marginTop: 10 }}
        >
          Cancelar
        </button>
      </form>
    </div>
  )
}

export default function AccountsView() {
  const showToast = useToast()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(false)
  const [screen, setScreen] = useState({ name: 'list' })
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  async function load() {
    setLoadError(false)
    try {
      setData(await loadAccountsData())
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => { load() }, [])

  function backToList(reload) {
    setScreen({ name: 'list' })
    if (reload) load()
  }

  async function deleteTransfer(id) {
    const { error } = await supabase.from('account_transfers').delete().eq('id', id)
    setConfirmDeleteId(null)
    if (error) {
      showToast('Não foi possível excluir')
      return
    }
    showToast('Transferência excluída')
    load()
  }

  if (loadError) {
    return (
      <div className="empty-state">
        <p>Não foi possível carregar as contas. Confira se o SQL da migração de contas foi executado no Supabase.</p>
        <button className="secondary-btn" onClick={load} style={{ marginTop: 12 }}>
          Tentar novamente
        </button>
      </div>
    )
  }
  if (!data) return <div className="empty-state">Carregando...</div>

  const balances = computeBalances(data)
  const { accounts, transfers } = data
  const budgetAccounts = accounts.filter((a) => a.type !== 'tracking')
  const trackingAccounts = accounts.filter((a) => a.type === 'tracking')
  const sum = (list) => list.reduce((s, a) => s + (balances[a.id] ?? 0), 0)
  const accountsById = Object.fromEntries(accounts.map((a) => [a.id, a]))

  if (screen.name === 'transfer') {
    return <TransferForm accounts={accounts} onBack={() => backToList(false)} onSaved={() => backToList(true)} />
  }

  if (screen.name === 'edit') {
    const acc = screen.account
    const hasMovements = acc
      ? data.transactions.some((t) => t.account_id === acc.id) ||
        transfers.some((t) => t.from_account_id === acc.id || t.to_account_id === acc.id)
      : false
    return (
      <AccountEditor
        account={acc}
        currentBalance={acc ? balances[acc.id] ?? 0 : 0}
        accounts={accounts}
        hasMovements={hasMovements}
        onBack={() => backToList(false)}
        onSaved={() => backToList(true)}
      />
    )
  }

  function renderRow(acc) {
    const value = balances[acc.id] ?? 0
    return (
      <button className="tx-row" key={acc.id} onClick={() => setScreen({ name: 'edit', account: acc })}>
        <div>
          <p className="name">{acc.name}</p>
          <p className="meta">{accountMeta(acc)}</p>
        </div>
        <span className={amtClass(value)}>{formatCurrency(value)}</span>
      </button>
    )
  }

  return (
    <div>
      <div className="accounts-actions">
        <button className="primary-btn" onClick={() => setScreen({ name: 'transfer' })} disabled={accounts.length < 2}>
          Transferir
        </button>
        <button className="secondary-btn" onClick={() => setScreen({ name: 'edit', account: null })}>
          Nova caixinha
        </button>
      </div>

      <p className="group-title">
        <span>Contas do orçamento</span>
        <span>{formatCurrency(sum(budgetAccounts))}</span>
      </p>
      {budgetAccounts.map(renderRow)}

      <p className="group-title">
        <span>Caixinhas (fora do orçamento)</span>
        <span>{formatCurrency(sum(trackingAccounts))}</span>
      </p>
      {trackingAccounts.length === 0 ? (
        <div className="empty-state" style={{ padding: '20px 24px' }}>
          Nenhuma caixinha ainda. Toque em "Nova caixinha" para criar a primeira.
        </div>
      ) : (
        trackingAccounts.map(renderRow)
      )}

      <p className="group-title"><span>Transferências recentes</span></p>
      {transfers.length === 0 ? (
        <div className="empty-state" style={{ padding: '20px 24px' }}>Nenhuma transferência ainda.</div>
      ) : (
        transfers.slice(0, 10).map((t) => (
          <div className="tx-row transfer-row" key={t.id}>
            <div>
              <p className="name">
                {accountsById[t.from_account_id]?.name ?? '?'} → {accountsById[t.to_account_id]?.name ?? '?'}
              </p>
              <p className="meta">
                {formatDate(t.date)}
                {t.note && ` · ${t.note}`}
              </p>
            </div>
            <div className="transfer-right">
              <span className="amt neutral">{formatCurrency(t.amount)}</span>
              {confirmDeleteId === t.id ? (
                <span className="transfer-confirm">
                  <button className="link-btn" onClick={() => setConfirmDeleteId(null)}>Cancelar</button>
                  <button className="link-btn danger" onClick={() => deleteTransfer(t.id)}>Excluir</button>
                </span>
              ) : (
                <button className="link-btn danger" onClick={() => setConfirmDeleteId(t.id)}>Excluir</button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
