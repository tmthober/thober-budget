import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Combobox de categoria: digitando, filtra a lista; sem digitar nada,
// mostra todas agrupadas e dá pra rolar. Não depende de nenhuma lib externa.
export default function CategoryPicker({ groups, categories, value, onChange }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const selected = categories.find((c) => c.id === value)

  useEffect(() => {
    // Mantém o texto do input sincronizado com a categoria escolhida
    // quando o dropdown está fechado (ex: valor inicial, ou após selecionar).
    if (!open) setQuery(selected ? selected.name : '')
  }, [selected, open])

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const normalizedQuery = query.trim().toLowerCase()

  function matches(cat) {
    if (!normalizedQuery) return true
    return cat.name.toLowerCase().includes(normalizedQuery)
  }

  function handleSelect(cat) {
    onChange(cat.id)
    setQuery(cat.name)
    setOpen(false)
  }

  const visibleGroups = groups
    .map((group) => ({
      group,
      cats: categories.filter((c) => c.group_id === group.id && matches(c)),
    }))
    .filter((g) => g.cats.length > 0)

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (value) onChange('') // se a pessoa volta a digitar, invalida a seleção antiga
        }}
        onFocus={() => setOpen(true)}
        placeholder="Digite ou toque para ver todas"
        autoComplete="off"
      />

      <AnimatePresence>
        {open && (
          <motion.div
            className="combobox-list"
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            {visibleGroups.length === 0 && (
              <p className="combobox-empty">Nenhuma categoria encontrada</p>
            )}
            {visibleGroups.map(({ group, cats }) => (
              <div key={group.id}>
                <p className="combobox-group-label">{group.name}</p>
                {cats.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    className="combobox-option"
                    onMouseDown={(e) => e.preventDefault()} // evita perder o foco antes do click
                    onClick={() => handleSelect(cat)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
