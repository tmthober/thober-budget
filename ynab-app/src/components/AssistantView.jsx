import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { askAssistant, SUGGESTED_QUESTIONS } from '../lib/assistant'

// LIÇÃO DO PROJETO: animação de tela cheia usa SÓ opacity.
// transform (x/y) do Framer Motion quebra position: sticky nos filhos.
const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }

const ACCENT = '#2f6f5e'

export default function AssistantView({ month }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  async function send(text) {
    const question = (text ?? input).trim()
    if (!question || loading) return

    const history = messages.map((m) => ({ role: m.role, text: m.text }))
    setMessages((prev) => [...prev, { role: 'user', text: question }])
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const answer = await askAssistant(question, month, history)
      setMessages((prev) => [...prev, { role: 'assistant', text: answer }])
    } catch (err) {
      setError(err.message)
      // Deixa a pergunta de volta no campo pra não perder o que foi digitado
      setInput(question)
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const empty = messages.length === 0

  return (
    <motion.div {...fade} style={S.screen}>
      <header style={S.header}>
        <h2 style={S.title}>Assistente</h2>
        <p style={S.subtitle}>
          Pergunte quanto dá pra gastar. Ele olha o disponível, o ponto do mês e sugere de onde
          tirar.
        </p>
      </header>

      <div style={S.thread}>
        {empty && (
          <div style={S.suggestions}>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button key={q} type="button" style={S.chip} onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              ...S.bubble,
              ...(m.role === 'user' ? S.bubbleUser : S.bubbleBot),
            }}
          >
            {m.text}
          </div>
        ))}

        {loading && (
          <div style={{ ...S.bubble, ...S.bubbleBot, ...S.thinking }}>Pensando…</div>
        )}

        {error && (
          <div style={S.error} role="alert">
            {error}
            <button type="button" style={S.retry} onClick={() => send()}>
              Tentar novamente
            </button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div style={S.composer}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ex: posso gastar R$ 150 em delivery hoje?"
          rows={2}
          maxLength={500}
          style={S.textarea}
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{
            ...S.sendBtn,
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          Enviar
        </button>
      </div>
    </motion.div>
  )
}

const S = {
  screen: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
  header: { padding: '16px 16px 8px' },
  title: { margin: 0, fontSize: 20, fontWeight: 700 },
  subtitle: { margin: '4px 0 0', fontSize: 13, opacity: 0.7, lineHeight: 1.4 },
  thread: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: '8px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  suggestions: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 },
  chip: {
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(47,111,94,0.35)',
    background: 'rgba(47,111,94,0.06)',
    color: 'inherit',
    fontSize: 14,
    cursor: 'pointer',
  },
  bubble: {
    padding: '10px 12px',
    borderRadius: 14,
    fontSize: 15,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    maxWidth: '90%',
  },
  bubbleUser: { alignSelf: 'flex-end', background: ACCENT, color: '#fff' },
  bubbleBot: { alignSelf: 'flex-start', background: 'rgba(127,127,127,0.14)' },
  thinking: { opacity: 0.7, fontStyle: 'italic' },
  error: {
    alignSelf: 'stretch',
    background: 'rgba(200,60,60,0.12)',
    border: '1px solid rgba(200,60,60,0.35)',
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-start',
  },
  retry: {
    border: 'none',
    background: ACCENT,
    color: '#fff',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 13,
    cursor: 'pointer',
  },
  composer: {
    display: 'flex',
    gap: 8,
    padding: 12,
    borderTop: '1px solid rgba(127,127,127,0.2)',
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    borderRadius: 12,
    border: '1px solid rgba(127,127,127,0.35)',
    padding: '10px 12px',
    fontSize: 15,
    fontFamily: 'inherit',
    background: 'transparent',
    color: 'inherit',
  },
  sendBtn: {
    border: 'none',
    background: ACCENT,
    color: '#fff',
    borderRadius: 12,
    padding: '12px 16px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
