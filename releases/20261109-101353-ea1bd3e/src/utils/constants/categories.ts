import i18n from '../../locales'
import type { CategoryOption } from '../../types/api'

/** Filtro "todas" das listas de devocionais. */
export const ALL_CATEGORIES = 'todas'

// Categorias activas, recebidas com o catálogo (configuradas no painel).
let configured: CategoryOption[] = []

/** Guarda as categorias recebidas do servidor; chamado por useCatalog. */
export function setCategoryOptions(options: CategoryOption[]): void {
  configured = options
}

/**
 * Nome de uma categoria na língua actual, a partir da configuração do painel.
 * Sem categorias activas (campo desligado) devolve '' e o site esconde-a.
 */
export function categoryLabel(category: string): string {
  if (category === ALL_CATEGORIES) return i18n.t('All')
  const option = configured.find((item) => item.id === category)
  if (!option) return ''
  const english = i18n.language?.startsWith('en')
  return (english && option.labelEn) || option.label
}
