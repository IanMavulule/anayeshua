import { useAdmin } from './AdminContext'

/** Mostra o carregamento inicial ou o erro ao obter os dados do painel. */
export default function AdminLoadState() {
  const { loading, loadError, reload } = useAdmin()
  if (loadError) {
    return (
      <div className="adm-empty adm-load-error" role="alert">
        <strong>Não foi possível carregar o painel</strong>
        <p>{loadError}</p>
        <button className="adm-btn adm-btn--primary" type="button" onClick={reload}>Tentar novamente</button>
      </div>
    )
  }
  return loading ? <div className="adm-loading" aria-busy="true">A carregar dados…</div> : null
}
