import { useState } from 'react'
import { useAdmin } from '../AdminContext'
import Icon from '../icons'
import { POST_TYPES, fmtDate, type PostType } from '../adminData'

/** Mensagem do dia, anotações e pontos de oração (PT/EN). */
export default function DailyPanel() {
  const { data, panel, openPost, deletePost } = useAdmin()
  const [type, setType] = useState<'all' | PostType>('all')

  const posts = data.posts
    .filter((post) => type === 'all' || post.type === type)
    .slice()
    .sort((a, b) => b.publishAt.localeCompare(a.publishAt))
  const count = (value: 'all' | PostType) => data.posts.filter((post) => value === 'all' || post.type === value).length
  const now = Date.now()

  return (
    <section className="adm-panel" id="panel-daily" role="tabpanel" aria-labelledby="nav-daily" tabIndex={0} hidden={panel !== 'panel-daily'}>
      <div className="adm-head">
        <div>
          <span className="eyebrow">Conteúdo diário</span>
          <h1>Palavra do dia</h1>
          <p className="adm-head-sub">
            Publique a mensagem do dia sobre a visitação do Espírito Santo, as anotações diárias e os pontos de oração. Este
            conteúdo é a parte gratuita da plataforma, salvo os itens marcados como Premium.
          </p>
        </div>
        <div className="adm-head-actions">
          <button className="adm-btn adm-btn--primary" type="button" onClick={() => openPost()}>
            Nova publicação <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>

      <div className="adm-chips" role="group" aria-label="Filtrar por tipo">
        {(['all', 'daily-message', 'note', 'prayer-point'] as const).map((value) => (
          <button
            key={value}
            className={'adm-chip' + (type === value ? ' is-active' : '')}
            type="button"
            aria-pressed={type === value}
            onClick={() => setType(value)}
          >
            {value === 'all' ? 'Todas' : POST_TYPES[value]} <b>{count(value)}</b>
          </button>
        ))}
      </div>

      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">Publicação</th>
              <th scope="col">Tipo</th>
              <th scope="col">Publicar a partir de</th>
              <th scope="col">Estado</th>
              <th scope="col" className="adm-cell-actions">Acções</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => {
              const scheduled = post.status === 'published' && Date.parse(post.publishAt) > now
              return (
                <tr key={post.id}>
                  <td>
                    <strong>{post.title}</strong>
                    <small>{post.body.slice(0, 120)}{post.body.length > 120 ? '…' : ''}</small>
                  </td>
                  <td>
                    {POST_TYPES[post.type]}
                    <small>{post.language === 'en' ? 'Inglês' : 'Português'}{post.premium ? ' · Premium' : ''}</small>
                  </td>
                  <td><span className="adm-date">{fmtDate(post.publishAt)}</span></td>
                  <td>
                    <span className={'st ' + (post.status === 'draft' ? 'st--draft' : scheduled ? 'st--scheduled' : 'st--published')}>
                      {post.status === 'draft' ? 'Rascunho' : scheduled ? 'Agendado' : 'Publicado'}
                    </span>
                  </td>
                  <td className="adm-cell-actions">
                    <div className="adm-acts">
                      <button className="adm-ibtn" type="button" title="Editar" onClick={() => openPost(post.id)}><Icon name="edit" /></button>
                      <button className="adm-ibtn adm-ibtn--danger" type="button" title="Eliminar" onClick={() => deletePost(post.id)}><Icon name="trash" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="adm-empty" hidden={posts.length > 0}>
        <strong>Sem publicações</strong>
        <p>Crie a primeira mensagem do dia para a mostrar na página inicial e na área dos membros.</p>
      </div>
    </section>
  )
}
