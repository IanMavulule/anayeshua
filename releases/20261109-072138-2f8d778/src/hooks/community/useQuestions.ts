import { useCallback, useState } from 'react'
import type { Question } from '../../types/api'
import { ApiError, api } from '../../utils/api/apiClient'
import { useApiData } from '../common/useApiData'

/**
 * Dúvidas do membro. Com `lessonId`, só as dessa aula. Sem sessão (`enabled`
 * falso) não pede nada, para não gerar erros de autorização.
 */
export function useQuestions(lessonId?: string, enabled = true) {
  const url = !enabled ? null : lessonId ? `/api/questions/mine?lessonId=${encodeURIComponent(lessonId)}` : '/api/questions/mine'
  const { data, loading, refetch } = useApiData<{ questions: Question[] }>(url)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ask = useCallback(
    async (courseId: string, questionLessonId: string, body: string) => {
      setSending(true)
      setError(null)
      try {
        await api.post('/api/questions', { courseId, lessonId: questionLessonId, body })
        await refetch()
        return true
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.code : 'unknown_error')
        return false
      } finally {
        setSending(false)
      }
    },
    [refetch],
  )

  return { questions: data?.questions ?? [], loading, ask, sending, error }
}

/** Feedback sobre a assistência marcada (apenas Premium). */
export function useAssistanceFeedback() {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(async (rating: number, comment: string) => {
    setSending(true)
    setError(null)
    try {
      await api.post('/api/feedback', { rating, comment })
      setSent(true)
      return true
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.code : 'unknown_error')
      return false
    } finally {
      setSending(false)
    }
  }, [])

  return { send, sending, sent, error }
}
