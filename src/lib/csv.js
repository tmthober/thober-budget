// Exportação de transações em CSV.
//
// Delimitador ; e decimal com vírgula — é o que o Excel em português
// espera por padrão (com decimal "." e delimitador "," o Excel PT-BR
// costuma jogar tudo numa coluna só).

function escapeCsvField(value) {
  const str = String(value ?? '')
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatAmountForCsv(amount) {
  return Number(amount).toFixed(2).replace('.', ',')
}

export function transactionsToCsv(transactions, categoriesById, groupsById) {
  const header = ['Data', 'Grupo', 'Categoria', 'Valor', 'Observação']
  const rows = transactions.map((t) => {
    const cat = categoriesById[t.category_id]
    const group = cat ? groupsById[cat.group_id] : null
    return [
      t.date,
      group?.name ?? '',
      cat?.name ?? 'Categoria removida',
      formatAmountForCsv(t.amount),
      t.note ?? '',
    ].map(escapeCsvField).join(';')
  })
  return [header.join(';'), ...rows].join('\n')
}

export function downloadCsv(csvContent, filename) {
  // BOM no início garante que o Excel abra os acentos certinho.
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
