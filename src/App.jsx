import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import BudgetView from './components/BudgetView'
import TransactionsView from './components/TransactionsView'
import AddTransactionForm from './components/AddTransactionForm'
import ReportsView from './components/ReportsView'
import { IconBudget, IconList, IconPlus, IconLogout, IconPieChart } from './components/icons'

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
          <IconLogout />
        </button>
      </header>

      <div className="content">
        {tab === 'budget' && <BudgetView refreshKey={refreshKey} />}
        {tab === 'reports' && <ReportsView />}
        {tab === 'transactions' && <TransactionsView refreshKey={refreshKey} />}
        {tab === 'add' && <AddTransactionForm onSaved={handleTransactionSaved} />}
      </div>

      <nav className="tab-bar">
        <button
          className={tab === 'budget' ? 'active' : ''}
          onClick={() => setTab('budget')}
          aria-label="Orçamento"
          aria-current={tab === 'budget' ? 'page' : undefined}
        >
          <IconBudget />
          <span>Orçamento</span>
        </button>

        <button
          className={tab === 'reports' ? 'active' : ''}
          onClick={() => setTab('reports')}
          aria-label="Relatórios"
          aria-current={tab === 'reports' ? 'page' : undefined}
        >
          <IconPieChart />
          <span>Relatórios</span>
        </button>

        <div className="tab-bar-fab-slot">
          <button
            className="fab"
            onClick={() => setTab('add')}
            aria-label="Lançar despesa"
          >
            <IconPlus />
          </button>
        </div>

        <button
          className={tab === 'transactions' ? 'active' : ''}
          onClick={() => setTab('transactions')}
          aria-label="Transações"
          aria-current={tab === 'transactions' ? 'page' : undefined}
        >
          <IconList />
          <span>Transações</span>
        </button>
      </nav>
    </>
  )
}
