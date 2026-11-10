import { useCallback, useState } from 'react'
import type { PublicTestimony } from '../../types/api'
import { ApiError, api } from '../../utils/api/apiClient'
import { useApiData } from '../common/useApiData'

/** Testemunhos de uma aula (publicados + os pendentes do próprio autor). */
export function useTestimonies(courseId: string, lessonId: string) {
  const url =
    courseId && lessonId
      ? `/api/testimonies?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(lessonId)}`
      : null
  const { data, loading, refetch } = useApiData<{ testimonies: PublicTestimony[] }>(url)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const share = useCallback(
    async (text: string) => {
      setSaving(true)
      setError(null)
      try {
        const { testimony } = await api.post<{ testimony: PublicTestimony }>('/api/testimonies', { courseId, lessonId, text })
        await refetch()
        return testimony
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.code : 'unknown_error')
        return null
      } finally {
        setSaving(false)
      }
    },
    [courseId, lessonId, refetch],
  )

  return { testimonies: data?.testimonies ?? [], loading, share, saving, error }
}
