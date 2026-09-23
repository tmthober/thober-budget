import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from './supabaseClient'
import { useHousehold } from './lib/HouseholdContext'
import Login from './components/Login'
import HouseholdSelector from './components/HouseholdSelector'
import BudgetView from './components/BudgetView'
import TransactionsView from './components/TransactionsView'
import AddTransactionForm from './components/AddTransactionForm'
import ReportsView from './components/ReportsView'
import AssistantView from './components/AssistantView'
import SettingsView from './components/SettingsView'
import AppHeader from './components/AppHeader'
import AccountDrawer from './components/AccountDrawer'
import { IconBudget, IconList, IconPlus, IconPieChart, IconAssistant } from './components/icons'

const TAB_TITLES = {
  budget: 'Orçamento',
  transactions: 'Transações',
  add: 'Nova transação',
  reports: 'Relatórios',
  assistant: 'Assistente',
  settings: 'Configurações',
  about: 'Sobre',
}

function AppContent() {
  const [tab, setTab] = useState('budget')
  const [previousTab, setPreviousTab] = useState('budget')
  const [refreshKey, setRefreshKey] = useState(0)
  const [email, setEmail] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [headerHidden, setHeaderHidden] = useState(false)

  const { selectedHousehold } = useHousehold()
  const contentRef = useRef(null)
  const lastScrollY = useRef(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email ?? '')
    })
  }, [])

  // Se não tem household selecionado, mostra selector
  if (!selectedHousehold) {
    return <HouseholdSelector />
  }

  // Header some ao rolar pra baixo, reaparece ao rolar pra cima.
  // Reseta (mostra) sempre que a aba muda, já que cada tela volta ao topo.
  useEffect(() => {
    setHeaderHidden(false)
    lastScrollY.current = 0
    if (contentRef.current) contentRef.current.scrollTop = 0
  }, [tab])

  function handleScroll(e) {
    const y = e.target.scrollTop
    const goingDown = y > lastScrollY.current
    const pastThreshold = y > 24
    if (goingDown && pastThreshold) setHeaderHidden(true)
    else if (!goingDown) setHeaderHidden(false)
    lastScrollY.current = y
  }

  if (checkingSession) return null
  if (!session) return <Login />

  // Mês visível (YYYY-MM), calculado na data local
  const month = new Date().toISOString().slice(0, 7)

  function openAdd() {
    setPreviousTab(tab)
    setTab('add')
  }

  function handleTransactionSaved() {
    setRefreshKey((k) => k + 1)
    setTab('transactions')
  }

  function handleDrawerNavigate(destination) {
    setDrawerOpen(false)
    setPreviousTab(tab === 'settings' || tab === 'about' ? previousTab : tab)
    setTab(destination)
  }

  const mainTabs = ['budget', 'transactions', 'reports', 'assistant']
  const activeBottomTab = mainTabs.includes(tab) ? tab : null

  return (
    <>
      <AppHeader
        title={TAB_TITLES[tab] || 'Orçamento familiar'}
        email={email}
        hidden={headerHidden}
        onAvatarClick={() => setDrawerOpen(true)}
      />

      <div className="content" ref={contentRef} onScroll={handleScroll}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {tab === 'budget' && <BudgetView refreshKey={refreshKey} />}
            {tab === 'reports' && <ReportsView />}
            {tab === 'assistant' && <AssistantView month={month} />}
            {tab === 'transactions' && <TransactionsView refreshKey={refreshKey} />}
            {tab === 'add' && (
              <AddTransactionForm onSaved={handleTransactionSaved} onCancel={() => setTab(previousTab)} />
            )}
            {tab === 'settings' && <SettingsView />}
            {tab === 'about' && <SettingsView aboutOnly />}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="tab-bar">
        <button
          className={activeBottomTab === 'budget' ? 'active' : ''}
          onClick={() => setTab('budget')}
          aria-label="Orçamento"
          aria-current={activeBottomTab === 'budget' ? 'page' : undefined}
        >
          <IconBudget />
          <span>Orçamento</span>
        </button>

        <button
          className={activeBottomTab === 'transactions' ? 'active' : ''}
          onClick={() => setTab('transactions')}
          aria-label="Transações"
          aria-current={activeBottomTab === 'transactions' ? 'page' : undefined}
        >
          <IconList />
          <span>Transações</span>
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
          className={activeBottomTab === 'reports' ? 'active' : ''}
          onClick={() => setTab('reports')}
          aria-label="Relatórios"
          aria-current={activeBottomTab === 'reports' ? 'page' : undefined}
        >
          <IconPieChart />
          <span>Relatórios</span>
        </button>

        <button
          className={activeBottomTab === 'assistant' ? 'active' : ''}
          onClick={() => setTab('assistant')}
          aria-label="Assistente"
          aria-current={activeBottomTab === 'assistant' ? 'page' : undefined}
        >
          <IconAssistant />
          <span>Assistente</span>
        </button>
      </nav>

      <AccountDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        email={email}
        onNavigate={handleDrawerNavigate}
      />
    </>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

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

  return <AppContent />
}
