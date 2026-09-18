import { supabase } from '../supabaseClient'

// CONVENÇÃO DO PROJETO: datas como string, sempre no fuso local.
// new Date().toISOString() daria UTC e, em UTC-3, viraria o dia seguinte
// depois das 21h — por isso montamos YYYY-MM-DD na mão.
export function localToday() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * Pergunta ao assistente.
 * @param {string} question  pergunta em texto livre
 * @param {string} month     'YYYY-MM' (mês visível no app)
 * @param {Array<{role:'user'|'assistant', text:string}>} history
 * @returns {Promise<string>} resposta em texto
 */
export async function askAssistant(question, month, history = []) {
  const { data, error } = await supabase.functions.invoke('assistant', {
    body: {
      question,
      month: month || localToday().slice(0, 7),
      today: localToday(),
      history,
    },
  })

  if (error) {
    // A Edge Function devolve { error: '...' } com status != 2xx
    let msg = 'Não consegui falar com o assistente.'
    try {
      const body = await error.context?.json()
      if (body?.error) msg = body.error
    } catch {
      /* mantém a mensagem padrão */
    }
    throw new Error(msg)
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.answer) throw new Error('O assistente não respondeu.')
  return data.answer
}

export const SUGGESTED_QUESTIONS = [
  'Quanto posso gastar em mercado ainda esse mês?',
  'Posso gastar R$ 200 em restaurantes hoje?',
  'Como está o orçamento no geral?',
  'Alguma categoria vai estourar até o fim do mês?',
]
