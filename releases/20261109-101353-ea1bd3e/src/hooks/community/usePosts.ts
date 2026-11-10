import { useTranslation } from 'react-i18next'
import type { PostType, PublicPost } from '../../types/api'
import { useApiData } from '../common/useApiData'

const languageOf = (value: string) => (value === 'en' ? 'en' : 'pt')

/** Mensagem do dia na língua actual (com recurso à outra língua). */
export function useTodayMessage() {
  const { i18n } = useTranslation()
  const { data, loading } = useApiData<{ post: PublicPost | null }>(`/api/posts/today?language=${languageOf(i18n.language)}`)
  return { post: data?.post ?? null, loading }
}

/** Anotações ou pontos de oração na língua actual. */
export function usePosts(type: PostType, limit = 20) {
  const { i18n } = useTranslation()
  const { data, loading } = useApiData<{ posts: PublicPost[] }>(
    `/api/posts?type=${type}&language=${languageOf(i18n.language)}&limit=${limit}`,
  )
  return { posts: data?.posts ?? [], loading }
}
