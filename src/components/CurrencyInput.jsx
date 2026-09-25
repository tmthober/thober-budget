// Input de valor em R$ no estilo "calculadora de banco": a pessoa só digita
// números, e a vírgula/formatação aparece sozinha. Trabalha com centavos
// (inteiro) por baixo dos panos para nunca ter erro de arredondamento.
// Aceita operações simples (+/-) enquanto digita; calcula ao fazer blur.

import { useState } from 'react'

function centsToDisplay(cents) {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function evaluateExpression(expr) {
  // Remove espaços
  expr = expr.trim()
  if (!expr) return null

  // Valida: só dígitos, +, e -
  // Padrão: número (obrigatório), seguido de zero ou mais (operador + número)
  const pattern = /^\d+(?:[+\-]\d+)*$/
  if (!pattern.test(expr)) return null

  try {
    // Avalia a expressão: eval é seguro aqui porque já validamos o padrão
    const result = eval(expr)
    return isFinite(result) && result >= 0 ? result : null
  } catch {
    return null
  }
}

export default function CurrencyInput({ id, cents, onChange, placeholder = 'R$ 0,00' }) {
  const [displayValue, setDisplayValue] = useState('')

  function handleChange(e) {
    const input = e.target.value

    // Remove "R$ " se colar um valor já formatado
    let cleaned = input.replace('R$ ', '')

    // Aceita dígitos, +, -
    cleaned = cleaned.replace(/[^\d+\-]/g, '')

    setDisplayValue(cleaned)
  }

  function handleBlur() {
    if (!displayValue) {
      setDisplayValue('')
      onChange(0)
      return
    }

    const result = evaluateExpression(displayValue)
    if (result !== null) {
      // Converteu pra número; agora converte pra centavos
      const resultCents = amountToCents(result)
      onChange(resultCents)
      setDisplayValue(`R$ ${centsToDisplay(resultCents)}`)
    } else {
      // Expressão inválida; volta ao estado anterior
      if (cents) {
        setDisplayValue(`R$ ${centsToDisplay(cents)}`)
      } else {
        setDisplayValue('')
      }
    }
  }

  function handleFocus() {
    // Ao focar, limpa a formatação pra editar a expressão
    if (displayValue.startsWith('R$ ')) {
      // Converte de volta pra número puro
      const numericStr = displayValue.replace('R$ ', '').replace(/\./g, '').replace(',', '.')
      const parsed = parseFloat(numericStr)
      if (!isNaN(parsed) && parsed > 0) {
        setDisplayValue(String(Math.round(parsed)))
      } else {
        setDisplayValue('')
      }
    }
  }

  return (
    <input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  )
}

export function centsToAmount(cents) {
  return cents / 100
}

export function amountToCents(amount) {
  return Math.round((amount ?? 0) * 100)
}