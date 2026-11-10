import { useAdmin } from './AdminContext'
import CourseEditor, { courseSaveLabel } from './CourseEditor'
import Icon from './icons'
import { POST_TYPES } from './adminData'
import type { EventStatus, MemberStatus, Plan, PostType } from './adminData'

export default function AdminOverlays() {
  const {
    drawerType,
    contentDraft,
    eventDraft,
    memberDraft,
    postDraft,
    drawerStatus,
    saving,
    closeDrawer,
    saveActive,
    updateEvent,
    handleEventImageFile,
    eventImageBusy,
    updateMember,
    updatePost,
    postTitleRef,
    eventTitleRef,
    eventDateRef,
    memberNameRef,
    memberEmailRef,
    confirm,
    settleConfirm,
    player,
    closePlayer,
    toasts,
  } = useAdmin()

  const isNew = drawerType === 'content'
    ? !contentDraft?.id
    : drawerType === 'event'
      ? !eventDraft?.id
      : drawerType === 'post'
        ? !postDraft?.id
        : !memberDraft?.id

  const heads = {
    content: { eyebrow: 'Curso', title: isNew ? 'Novo curso' : 'Editar curso', sub: 'Preencha os passos e veja como fica, e o que ainda falta, antes de publicar.' },
    event: { eyebrow: 'Evento', title: isNew ? 'Novo evento' : 'Editar evento', sub: 'Actualize os dados do evento.' },
    member: { eyebrow: 'Membro', title: isNew ? 'Criar conta de membro' : 'Editar membro', sub: 'Defina o acesso e o plano do membro. Uma conta nova recebe uma palavra-passe temporária.' },
    post: { eyebrow: 'Palavra do dia', title: isNew ? 'Nova publicação' : 'Editar publicação', sub: 'Mensagem do dia, anotação ou ponto de oração, em português ou inglês.' },
  } as const
  const head = drawerType ? heads[drawerType] : heads.content

  return (
    <>
      <div className="adm-scrim" id="scrim" hidden={true}></div>

      {/*  Drawer de edição  */}
      <div className="adm-drawer" id="drawer" hidden={!drawerType} aria-hidden={!drawerType}>
        <button className="adm-drawer-backdrop" type="button" aria-label="Fechar painel" onClick={closeDrawer}></button>
        <div className={'adm-drawer-panel' + (drawerType === 'content' ? ' adm-drawer-panel--wide' : '')} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
          <div className="adm-drawer-head">
            <span className="eyebrow" id="drawer-eyebrow">{head.eyebrow}</span>
            <h2 id="drawer-title">{head.title}</h2>
            <p className="adm-drawer-sub" id="drawer-sub">{head.sub}</p>
            <button className="adm-drawer-close" type="button" aria-label="Fechar" onClick={closeDrawer}>✕</button>
          </div>

          <div className="adm-drawer-body" id="drawer-body">
            {drawerType === 'content' && contentDraft ? <CourseEditor /> : null}

            {drawerType === 'event' && eventDraft ? (
              <form className="adm-form" id="form-event" noValidate onSubmit={(event) => event.preventDefault()}>
                <div className="adm-field">
                  <label htmlFor="e-title">Nome do evento</label>
                  <input className="adm-input" id="e-title" ref={eventTitleRef} type="text" maxLength={90} placeholder="Ex.: Ventres do Avivamento" autoComplete="off" value={eventDraft.title} onChange={(event) => updateEvent({ title: event.target.value })} />
                </div>
                <div className="adm-row">
                  <div className="adm-field">
                    <label htmlFor="e-kind">Tipo de encontro</label>
                    <input className="adm-input" id="e-kind" type="text" maxLength={60} placeholder="Ex.: Mesa Profética" autoComplete="off" value={eventDraft.kind} onChange={(event) => updateEvent({ kind: event.target.value })} />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="e-date">Data e hora</label>
                    <input className="adm-input" id="e-date" ref={eventDateRef} type="datetime-local" value={eventDraft.date} onChange={(event) => updateEvent({ date: event.target.value })} />
                  </div>
                </div>
                <div className="adm-field">
                  <label htmlFor="e-place">Local</label>
                  <input className="adm-input" id="e-place" type="text" maxLength={120} placeholder="Ex.: Sede — Ministério Siloé Betel" autoComplete="off" value={eventDraft.place} onChange={(event) => updateEvent({ place: event.target.value })} />
                </div>
                <div className="adm-row">
                  <div className="adm-field">
                    <label htmlFor="e-entry">Entrada</label>
                    <input className="adm-input" id="e-entry" type="text" maxLength={40} placeholder="Livre" autoComplete="off" value={eventDraft.entry} onChange={(event) => updateEvent({ entry: event.target.value })} />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="e-status">Estado</label>
                    <select className="adm-select" id="e-status" value={eventDraft.status} onChange={(event) => updateEvent({ status: event.target.value as EventStatus })}>
                      <option value="published">Confirmado</option>
                      <option value="draft">Rascunho</option>
                    </select>
                  </div>
                </div>
                <div className="adm-field">
                  <label htmlFor="e-description">Descrição</label>
                  <textarea className="adm-textarea" id="e-description" maxLength={240} placeholder="O que acontece neste encontro." value={eventDraft.description} onChange={(event) => updateEvent({ description: event.target.value })}></textarea>
                </div>
                <div className="adm-field">
                  <span className="adm-label" id="e-image-label">Foto do evento</span>
                  <div className="adm-cover-stage adm-event-photo" aria-labelledby="e-image-label">
                    {eventDraft.image ? (
                      <img src={eventDraft.image} width={1400} height={788} alt="Foto do evento" />
                    ) : (
                      <p className="adm-event-photo__empty">Sem foto. O evento aparece só com a data.</p>
                    )}
                    <label className="adm-cover-upload" aria-disabled={eventImageBusy}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        disabled={eventImageBusy}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) handleEventImageFile(file)
                          event.target.value = ''
                        }}
                      />
                      <Icon name="upload" />
                      {eventImageBusy ? 'A carregar…' : eventDraft.image ? 'Trocar foto' : 'Carregar foto'}
                    </label>
                  </div>
                  <p className="adm-hint">
                    JPG, PNG ou WebP · é recortada automaticamente para 16:9.
                    {eventDraft.image ? <> <button className="adm-link" type="button" onClick={() => updateEvent({ image: '' })}>Remover foto</button></> : null}
                  </p>
                </div>
              </form>
            ) : null}

            {drawerType === 'post' && postDraft ? (
              <form className="adm-form" onSubmit={(event) => { event.preventDefault(); saveActive() }}>
                <div className="adm-row">
                  <div className="adm-field">
                    <label htmlFor="p-type">Tipo</label>
                    <select className="adm-select" id="p-type" value={postDraft.type} onChange={(event) => updatePost({ type: event.target.value as PostType })}>
                      {Object.entries(POST_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div className="adm-field">
                    <label htmlFor="p-language">Língua</label>
                    <select className="adm-select" id="p-language" value={postDraft.language} onChange={(event) => updatePost({ language: event.target.value as 'pt' | 'en' })}>
                      <option value="pt">Português</option>
                      <option value="en">Inglês</option>
                    </select>
                  </div>
                </div>
                <div className="adm-field">
                  <label htmlFor="p-title">Título</label>
                  <input className="adm-input" id="p-title" ref={postTitleRef} type="text" maxLength={160} autoComplete="off" value={postDraft.title} onChange={(event) => updatePost({ title: event.target.value })} />
                </div>
                <div className="adm-field">
                  <label htmlFor="p-body">Texto</label>
                  <textarea className="adm-textarea adm-textarea--tall" id="p-body" maxLength={8000} value={postDraft.body} onChange={(event) => updatePost({ body: event.target.value })}></textarea>
                </div>
                <div className="adm-row">
                  <div className="adm-field">
                    <label htmlFor="p-date">Publicar a partir de</label>
                    <input className="adm-input" id="p-date" type="datetime-local" value={postDraft.publishAt} onChange={(event) => updatePost({ publishAt: event.target.value })} />
                  </div>
                  <div className="adm-field">
                    <label htmlFor="p-status">Estado</label>
                    <select className="adm-select" id="p-status" value={postDraft.status} onChange={(event) => updatePost({ status: event.target.value as 'published' | 'draft' })}>
                      <option value="published">Publicado</option>
                      <option value="draft">Rascunho</option>
                    </select>
                  </div>
                </div>
                <label className="adm-free">
                  <input className="adm-check" type="checkbox" checked={postDraft.premium} onChange={(event) => updatePost({ premium: event.target.checked })} />
                  Só para membros Premium
                </label>
              </form>
            ) : null}

            {drawerType === 'member' && memberDraft ? (
              <form className="adm-form" id="form-member" noValidate onSubmit={(event) => event.preventDefault()}>
                <div className="adm-field">
                  <label htmlFor="m-name">Nome completo</label>
                  <input className="adm-input" id="m-name" ref={memberNameRef} type="text" maxLength={80} autoComplete="off" value={memberDraft.name} onChange={(event) => updateMember({ name: event.target.value })} />
                </div>
                <div className="adm-field">
                  <label htmlFor="m-email">E-mail</label>
                  <input className="adm-input" id="m-email" ref={memberEmailRef} type="email" maxLength={120} autoComplete="off" value={memberDraft.email} onChange={(event) => updateMember({ email: event.target.value })} />
                </div>
                <div className="adm-row">
                  <div className="adm-field">
                    <label htmlFor="m-plan">Plano</label>
                    <select className="adm-select" id="m-plan" value={memberDraft.plan} onChange={(event) => updateMember({ plan: event.target.value as Plan })}>
                      <option value="free">Gratuito</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div className="adm-field">
                    <label htmlFor="m-status">Estado</label>
                    <select className="adm-select" id="m-status" value={memberDraft.status} onChange={(event) => updateMember({ status: event.target.value as MemberStatus })}>
                      <option value="active">Activo</option>
                      <option value="suspended">Suspenso</option>
                    </select>
                  </div>
                </div>
                <p className="adm-hint">Ao criar a conta, o painel mostra uma palavra-passe temporária. Partilhe-a com o membro, que a pode mudar depois de entrar.</p>
              </form>
            ) : null}
          </div>

          <div className="adm-drawer-foot">
            <span className="adm-status-text" id="drawer-status" aria-live="polite">{drawerStatus}</span>
            <button className="adm-btn adm-btn--ghost" type="button" onClick={closeDrawer}>Cancelar</button>
            <button className="adm-btn adm-btn--primary" type="button" id="drawer-save" onClick={saveActive} disabled={saving}>{saving ? 'A guardar…' : drawerType === 'content' && contentDraft ? courseSaveLabel(contentDraft.status, !contentDraft.id) : 'Guardar'}</button>
          </div>
        </div>
      </div>

      {/*  Confirmação  */}
      <div className="adm-modal" id="confirm" hidden={!confirm}>
        <button className="adm-modal-backdrop" type="button" aria-label="Cancelar" onClick={() => settleConfirm(false)}></button>
        <div className="adm-modal-panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-text">
          <h2 id="confirm-title">{confirm?.title || ''}</h2>
          <p id="confirm-text">{confirm?.text || ''}</p>
          <div className="adm-modal-acts">
            <button className="adm-btn adm-btn--ghost" type="button" onClick={() => settleConfirm(false)}>Cancelar</button>
            <button className="adm-btn adm-btn--danger" type="button" id="confirm-ok" onClick={() => settleConfirm(true)}>{confirm?.label || 'Confirmar'}</button>
          </div>
        </div>
      </div>

      <div className="adm-modal adm-modal--player" id="player" hidden={!player.open}>
        <button className="adm-modal-backdrop" type="button" aria-label="Fechar pré-visualização" onClick={closePlayer}></button>
        <div className="adm-modal-panel adm-player-panel" role="dialog" aria-modal="true" aria-labelledby="player-title">
          <div className="adm-player-head">
            <div>
              <span className="eyebrow" id="player-kicker">{player.kicker}</span>
              <h2 id="player-title">{player.title}</h2>
            </div>
            <button className="adm-drawer-close" type="button" aria-label="Fechar" onClick={closePlayer}>✕</button>
          </div>
          <div className="adm-player-stage">
            {player.src ? <video key={player.src} id="player-video" src={player.src} controls playsInline preload="metadata"></video> : null}
            <div className="adm-player-empty" id="player-empty" hidden={Boolean(player.src)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><rect x="3" y="5" width={18} height={14}></rect><path d="M10 9.5l5 2.5-5 2.5z"></path></svg>
              <strong>Ficheiro no armazenamento</strong>
            </div>
          </div>
          <p className="adm-player-note" id="player-note">
            {player.src
              ? 'Pré-visualização do ficheiro guardado no servidor.'
              : 'Esta aula ainda não tem um vídeo carregado.'}
          </p>
        </div>
      </div>

      <div className="adm-toasts" id="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <div
            className={'adm-toast' + (item.error ? ' adm-toast--error' : '')}
            key={item.id}
            style={item.leaving ? { opacity: 0, transform: 'translateY(6px)' } : undefined}
          >
            <Icon name={item.error ? 'alert' : 'check'} />
            <div>
              <strong>{item.title}</strong>
              <p>{item.message}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
