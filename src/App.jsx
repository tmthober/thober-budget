import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import BudgetView from './components/BudgetView'
import TransactionsView from './components/TransactionsView'
import AddTransactionForm from './components/AddTransactionForm'
import ReportsView from './components/ReportsView'
import SettingsView from './components/SettingsView'
import { IconBudget, IconList, IconPlus, IconPieChart, IconSettings } from './components/icons'

export default function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [tab, setTab] = useState('budget')
  const [previousTab, setPreviousTab] = useState('budget')
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

  function openAdd() {
    setPreviousTab(tab)
    setTab('add')
  }

  function handleTransactionSaved() {
    setRefreshKey((k) => k + 1)
    setTab('transactions')
  }

  return (
    <>
      <header className="app-header">
        <h1>Orçamento familiar</h1>
      </header>

      <div className="content">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {tab === 'budget' && <BudgetView refreshKey={refreshKey} />}
            {tab === 'reports' && <ReportsView />}
            {tab === 'transactions' && <TransactionsView refreshKey={refreshKey} />}
            {tab === 'add' && (
              <AddTransactionForm onSaved={handleTransactionSaved} onCancel={() => setTab(previousTab)} />
            )}
            {tab === 'settings' && <SettingsView />}
          </motion.div>
        </AnimatePresence>
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
          <motion.button
            className="fab"
            onClick={openAdd}
            aria-label="Lançar despesa"
            style={{ y: -14 }}
            whileHover={{ y: -16, scale: 1.05 }}
            whileTap={{ y: -14, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <IconPlus />
          </motion.button>
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

        <button
          className={tab === 'settings' ? 'active' : ''}
          onClick={() => setTab('settings')}
          aria-label="Configurações"
          aria-current={tab === 'settings' ? 'page' : undefined}
        >
          <IconSettings />
          <span>Menu</span>
        </button>
      </nav>
    </>
  )
}
