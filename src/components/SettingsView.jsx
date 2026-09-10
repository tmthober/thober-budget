import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function SettingsView() {
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data?.user?.email ?? '')
    })
  }, [])

  return (
    <div>
      <p className="group-title"><span>Conta</span></p>
      <div className="settings-row">
        <span className="settings-label">Email</span>
        <span className="settings-value">{email || '—'}</span>
      </div>

      <p className="group-title"><span>Sessão</span></p>
      <button className="danger-link-btn settings-signout" onClick={() => supabase.auth.signOut()}>
        Sair
      </button>

      <p className="group-title"><span>Sobre</span></p>
      <div className="settings-about">
        <p className="settings-about-title">Orçamento Familiar</p>
        <p className="settings-about-text">
          App de orçamento por envelopes (método parecido com o YNAB), feito sob medida pra
          uso da família — sem contas separadas nem controle por pessoa nesta versão.
        </p>
      </div>
    </div>
  )
}
