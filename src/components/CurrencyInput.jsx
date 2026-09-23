// Input de valor em R$ no estilo "calculadora de banco": a pessoa só digita
// números, e a vírgula/formatação aparece sozinha. Trabalha com centavos
// (inteiro) por baixo dos panos para nunca ter erro de arredondamento.

function centsToDisplay(cents) {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function CurrencyInput({ id, cents, onChange, placeholder = 'R$ 0,00' }) {
  function handleChange(e) {
    const digitsOnly = e.target.value.replace(/\D/g, '')
    const parsed = digitsOnly === '' ? 0 : parseInt(digitsOnly, 10)
    onChange(parsed)
  }

  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={cents ? `R$ ${centsToDisplay(cents)}` : ''}
      onChange={handleChange}
    />
  )
}

export function centsToAmount(cents) {
  return cents / 100
}

export function amountToCents(amount) {
  return Math.round((amount ?? 0) * 100)
}
