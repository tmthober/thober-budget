import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabaseClient'
import { IconX, IconSettings, IconInfo, IconLogout } from './icons'

function initialsFromEmail(email) {
  if (!email) return '?'
  const name = email.split('@')[0]
  const parts = name.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function AccountDrawer({ open, onClose, email, onNavigate }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.aside
            className="account-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            role="dialog"
            aria-label="Menu da conta"
          >
            <div className="drawer-top">
              <div className="drawer-avatar drawer-avatar-lg">{initialsFromEmail(email)}</div>
              <button className="icon-btn" onClick={onClose} aria-label="Fechar menu">
                <IconX />
              </button>
            </div>

            <p className="drawer-email">{email || '—'}</p>

            <nav className="drawer-nav">
              <button className="drawer-nav-item" onClick={() => onNavigate('settings')}>
                <IconSettings size={20} />
                <span>Configurações</span>
              </button>
              <button className="drawer-nav-item" onClick={() => onNavigate('about')}>
                <IconInfo size={20} />
                <span>Sobre</span>
              </button>
            </nav>

            <button
              className="drawer-nav-item drawer-signout"
              onClick={() => supabase.auth.signOut()}
            >
              <IconLogout size={20} />
              <span>Sair</span>
            </button>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

export { initialsFromEmail }
