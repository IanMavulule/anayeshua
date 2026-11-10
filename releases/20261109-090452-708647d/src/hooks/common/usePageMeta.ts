import { useLayoutEffect } from 'react'
import { pageTitle } from '../../utils/constants/brand'

/** Define o título do documento (com a marca) e a classe do <body> de cada página. */
export function usePageMeta(page: string | undefined, bodyClass = ''): void {
  useLayoutEffect(() => {
    document.title = pageTitle(page)
    document.body.className = bodyClass
    return () => {
      document.body.className = ''
    }
  }, [page, bodyClass])
}
