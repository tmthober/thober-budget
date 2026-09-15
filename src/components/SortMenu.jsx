import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconArrowsUpDown } from './icons'

const OPTIONS = [
  { id: 'date_desc', label: 'Mais recentes primeiro' },
  { id: 'date_asc', label: 'Mais antigas primeiro' },
  { id: 'amount_desc', label: 'Maior valor primeiro' },
  { id: 'amount_asc', label: 'Menor valor primeiro' },
]

export default function SortMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Ordenar">
        <IconArrowsUpDown />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="sort-menu"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            {OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className={`sort-menu-option ${value === opt.id ? 'active' : ''}`}
                onClick={() => { onChange(opt.id); setOpen(false) }}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
