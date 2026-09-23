import { IconChevronLeft } from './icons'
import { presetRange, formatDateStr } from '../lib/reports'

const PRESETS = [
  { id: 'all', label: 'Tudo' },
  { id: 'month', label: 'Este mês' },
  { id: 'lastMonth', label: 'Mês passado' },
  { id: 'last3', label: 'Últimos 3 meses' },
  { id: 'year', label: 'Este ano' },
  { id: 'custom', label: 'Personalizado' },
]

export default function TransactionFilters({
  groups, categories,
  preset, setPreset,
  customStart, setCustomStart, customEnd, setCustomEnd,
  selectedCategoryIds, setSelectedCategoryIds,
  onBack,
}) {
  function toggleCategory(catId) {
    const next = new Set(selectedCategoryIds)
    if (next.has(catId)) next.delete(catId)
    else next.add(catId)
    setSelectedCategoryIds(next)
  }

  function toggleGroup(group, groupCats) {
    const allSelected = groupCats.every((c) => selectedCategoryIds.has(c.id))
    const next = new Set(selectedCategoryIds)
    if (allSelected) {
      groupCats.forEach((c) => next.delete(c.id))
    } else {
      groupCats.forEach((c) => next.add(c.id))
    }
    setSelectedCategoryIds(next)
  }

  function clearAll() {
    setPreset('all')
    setSelectedCategoryIds(new Set())
  }

  return (
    <div>
      <div className="edit-header">
        <button className="icon-btn" onClick={onBack} aria-label="Voltar">
          <IconChevronLeft />
        </button>
        <span>Filtros</span>
        <button className="icon-btn" onClick={clearAll} aria-label="Limpar filtros" style={{ fontSize: 12 }}>
          Limpar
        </button>
      </div>

      <p className="group-title"><span>Período</span></p>
      <div className="report-filters">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`chip ${preset === p.id ? 'active' : ''}`}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="report-custom-range">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          <span>até</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
        </div>
      )}

      <p className="group-title"><span>Categorias</span></p>
      {groups.map((group) => {
        const groupCats = categories.filter((c) => c.group_id === group.id)
        if (groupCats.length === 0) return null
        const allSelected = groupCats.every((c) => selectedCategoryIds.has(c.id))
        const someSelected = groupCats.some((c) => selectedCategoryIds.has(c.id))
        return (
          <div key={group.id}>
            <label className="filter-group-row">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                onChange={() => toggleGroup(group, groupCats)}
              />
              <span>{group.name}</span>
            </label>
            {groupCats.map((cat) => (
              <label className="filter-category-row" key={cat.id}>
                <input
                  type="checkbox"
                  checked={selectedCategoryIds.has(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                />
                <span>{cat.name}</span>
              </label>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export { PRESETS as FILTER_PRESETS }

export function resolveFilterRange(preset, customStart, customEnd) {
  if (preset === 'all') return null
  if (preset === 'custom') return { start: customStart, end: customEnd }
  return presetRange(preset, new Date())
}

export function defaultCustomDate() {
  return formatDateStr(new Date())
}
