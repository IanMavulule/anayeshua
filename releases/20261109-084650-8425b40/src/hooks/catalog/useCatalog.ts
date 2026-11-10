import type { CatalogSeries, CategoryOption, PublicEvent } from '../../types/api'
import { setCategoryOptions } from '../../utils/constants/categories'
import { useApiData } from '../common/useApiData'

const NO_CATEGORIES: CategoryOption[] = []

/** Catálogo e categorias activas. As categorias ficam disponíveis para categoryLabel. */
export function useCatalog() {
  const { data, loading, error, refetch } = useApiData<{ series: CatalogSeries[]; categories?: CategoryOption[] }>('/api/catalog')
  const categories = data?.categories ?? NO_CATEGORIES
  // Antes do render dos filhos, para que os cartazes já mostrem os nomes certos.
  setCategoryOptions(categories)
  return { series: data?.series ?? [], categories, loading, error, refetch }
}

export function useEvents() {
  const { data, loading, error } = useApiData<{ events: PublicEvent[] }>('/api/events')
  return { events: data?.events ?? [], loading, error }
}
