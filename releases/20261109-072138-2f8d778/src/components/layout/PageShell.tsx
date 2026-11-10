import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import AppFooter from './AppFooter'
import AppHeader from './AppHeader'

/** Estrutura comum das páginas: salto para o conteúdo, cabeçalho, conteúdo e rodapé. */
export default function PageShell({ children, overlayHeader = false }: { children: ReactNode; overlayHeader?: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      <a className="skip-link" href="#conteudo">{t('Skip to content')}</a>
      <AppHeader overlay={overlayHeader} />
      <main id="conteudo" className={overlayHeader ? 'main main--overlay' : 'main'}>
        {children}
      </main>
      <AppFooter />
    </>
  )
}
