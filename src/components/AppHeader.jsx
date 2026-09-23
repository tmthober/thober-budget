import { motion } from 'framer-motion'
import { initialsFromEmail } from './AccountDrawer'

export default function AppHeader({ title, email, hidden, onAvatarClick }) {
  return (
    <div className="app-header-safe-area">
      <motion.div
        className="app-header"
        initial={false}
        animate={{ height: hidden ? 0 : 'auto', opacity: hidden ? 0 : 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ overflow: 'hidden' }}
      >
        <div className="app-header-inner">
          <h1>{title}</h1>
          <button className="drawer-avatar" onClick={onAvatarClick} aria-label="Abrir menu da conta">
            {initialsFromEmail(email)}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
