import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import BudgetView from './components/BudgetView'
import TransactionsView from './components/TransactionsView'
import AddTransactionForm from './components/AddTransactionForm'

export default function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [tab, setTab] = useState('budget')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCheckingSession(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (checkingSession) return null
  if (!session) return <Login />

  function handleTransactionSaved() {
    setRefreshKey((k) => k + 1)
    setTab('transactions')
  }

  return (
    <>
      <header className="app-header">
        <h1>Orçamento familiar</h1>
        <button className="icon-btn" onClick={() => supabase.auth.signOut()} aria-label="Sair">
          Sair
        </button>
      </header>

      <div className="content">
        {tab === 'budget' && <BudgetView refreshKey={refreshKey} />}
        {tab === 'transactions' && <TransactionsView refreshKey={refreshKey} />}
        {tab === 'add' && <AddTransactionForm onSaved={handleTransactionSaved} />}
      </div>

      <nav className="tab-bar">
        <button className={tab === 'budget' ? 'active' : ''} onClick={() => setTab('budget')}>
          Orçamento
        </button>
        <button className={tab === 'add' ? 'active' : ''} onClick={() => setTab('add')}>
          + Lançar
        </button>
        <button className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>
          Transações
        </button>
      </nav>
    </>
  )
}
