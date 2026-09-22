import { motion } from 'framer-motion'
import { initialsFromEmail } from './AccountDrawer'

export default function AppHeader({ title, email, hidden, onAvatarClick }) {
  return (
    <motion.header
      className="app-header"
      animate={{ y: hidden ? '-100%' : 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <h1>{title}</h1>
      <button className="drawer-avatar" onClick={onAvatarClick} aria-label="Abrir menu da conta">
        {initialsFromEmail(email)}
      </button>
    </motion.header>
  )
}
