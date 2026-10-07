import { useEffect, useState } from 'react'
import { formatCurrency } from '../lib/budget'
import { loadAccountsData, computeBalances } from '../lib/accounts'

// Mostra o saldo atual de uma conta (usado para caixinhas no lançamento),
// no mesmo estilo do CategoryStatus. `refreshKey` força recarregar depois de
// salvar um lançamento.
export default function AccountStatus({ accountId, refreshKey }) {
  const [balance, setBalance] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!accountId) {
      setBalance(null)
      return
    }
    let cancelled = false
    setBalance(null)
    setFailed(false)
    loadAccountsData()
      .then((data) => {
        if (cancelled) return
        setBalance(computeBalances(data)[accountId] ?? 0)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => { cancelled = true }
  }, [accountId, refreshKey])

  if (!accountId) return null
  if (failed) return <p className="category-status neutral">Não foi possível carregar o saldo.</p>
  if (balance === null) return <p className="category-status">Carregando saldo...</p>

  const tone = balance < -0.005 ? 'negative' : balance < 0.005 ? 'neutral' : 'positive'
  return (
    <p className={`category-status ${tone}`}>
      Saldo disponível <strong>{formatCurrency(balance)}</strong>
    </p>
  )
}
