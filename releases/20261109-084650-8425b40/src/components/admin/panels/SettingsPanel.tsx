import { useEffect, useState } from 'react'
import { useAdmin } from '../AdminContext'
import type { AdminSettings } from '../adminData'
import CourseFieldsSettings from './CourseFieldsSettings'

const SWITCHES: { key: 'moderation' | 'comments' | 'signups' | 'maintenance'; title: string; text: string }[] = [
  { key: 'moderation', title: 'Moderação de testemunhos', text: 'Novas partilhas aguardam aprovação antes de serem publicadas.' },
  { key: 'comments', title: 'Comentários nos devocionais', text: 'Permitir que os membros comentem cada aula.' },
  { key: 'signups', title: 'Novos registos', text: 'Aceitar novas inscrições na plataforma.' },
  { key: 'maintenance', title: 'Modo de manutenção', text: 'Mostrar apenas uma página de manutenção aos visitantes.' },
]

export default function SettingsPanel() {
  const { data, panel, saveSettings, reload } = useAdmin()
  const { settings } = data

  const [form, setForm] = useState({ name: settings.name, email: settings.email, description: settings.description })

  useEffect(() => {
    setForm({ name: settings.name, email: settings.email, description: settings.description })
  }, [settings.name, settings.email, settings.description])

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    saveSettings(form)
  }

  const toggle = (key: 'moderation' | 'comments' | 'signups' | 'maintenance') =>
    saveSettings({ [key]: !settings[key] } as Partial<AdminSettings>)

  return (
    <section
      className="adm-panel"
      id="panel-settings"
      role="tabpanel"
      aria-labelledby="nav-settings"
      tabIndex={0}
      hidden={panel !== 'panel-settings'}
    >
      <div className="adm-head">
        <div>
          <span className="eyebrow">Sistema</span>
          <h1>Configurações</h1>
          <p className="adm-head-sub">Ajuste a identidade pública da plataforma, o comportamento da comunidade e os campos de cada curso.</p>
        </div>
      </div>

      <div className="adm-settings">
        <div className="adm-card">
          <div className="adm-card-head">
            <div>
              <h2>Identidade da plataforma</h2>
              <span className="adm-card-meta">Visível para os membros</span>
            </div>
          </div>
          <form className="adm-form-stack" id="settings-form" onSubmit={submit}>
            <div className="adm-field">
              <label htmlFor="set-name">Nome da plataforma</label>
              <input className="adm-input" id="set-name" type="text" maxLength={80} value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="adm-field">
              <label htmlFor="set-email">E-mail de contacto</label>
              <input className="adm-input" id="set-email" type="email" maxLength={120} value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            </div>
            <div className="adm-field">
              <label htmlFor="set-description">Descrição</label>
              <textarea className="adm-textarea" id="set-description" maxLength={220} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}></textarea>
            </div>
            <div>
              <button className="adm-btn adm-btn--primary" type="submit">Guardar alterações</button>
            </div>
          </form>
        </div>

        <div className="adm-card">
          <div className="adm-card-head">
            <div>
              <h2>Preferências</h2>
              <span className="adm-card-meta">Comportamento do site</span>
            </div>
          </div>

          {SWITCHES.map((item) => (
            <div className="adm-switch" key={item.key}>
              <div>
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </div>
              <button
                className="adm-switch-btn"
                type="button"
                role="switch"
                aria-checked={settings[item.key]}
                aria-label={item.title}
                onClick={() => toggle(item.key)}
              ></button>
            </div>
          ))}

          <div className="adm-danger">
            <h3>Dados</h3>
            <p>Os dados ficam guardados no servidor, em <code>data/</code>. Recarregue para ver alterações feitas noutro dispositivo.</p>
            <button className="adm-btn adm-btn--ghost" type="button" onClick={reload}>Recarregar dados</button>
          </div>
        </div>

        <CourseFieldsSettings />
      </div>
    </section>
  )
}
