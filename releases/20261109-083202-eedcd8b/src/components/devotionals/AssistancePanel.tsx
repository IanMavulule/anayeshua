import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAssistanceFeedback } from '../../hooks/community/useQuestions'
import { SOCIAL_LINKS } from '../../utils/constants/brand'
import { errorMessage } from '../../utils/format/errorMessage'
import { Button, ButtonLink } from '../ui/Button'
import { TextAreaField } from '../ui/Field'

/** Marcação de assistência (Premium) e feedback depois da sessão. */
export default function AssistancePanel() {
  const { t } = useTranslation()
  const { send, sending, sent, error } = useAssistanceFeedback()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (await send(rating, comment.trim())) setComment('')
  }

  const failure = errorMessage(error)

  return (
    <div className="assistance">
      <h3 className="panel__title">{t('Premium assistance')}</h3>
      <p className="muted">{t('Choose an available time to book your assistance.')}</p>
      <ButtonLink to={SOCIAL_LINKS.assistanceBooking} external variant="primary" block>{t('See available times')}</ButtonLink>

      <form className="assistance__feedback" onSubmit={handleSubmit}>
        <h4>{t('How was your assistance?')}</h4>
        <div className="rating" role="radiogroup" aria-label={t('Rating')}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              className={value <= rating ? 'active' : ''}
              aria-label={t('{{count}} of 5', { count: value })}
              onClick={() => setRating(value)}
            >
              ★
            </button>
          ))}
        </div>
        <TextAreaField id="feedback-comment" label={t('Comment (optional)')} rows={3} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} />
        <Button type="submit" variant="secondary" block disabled={sending}>{t('Send feedback')}</Button>
        <div aria-live="polite">
          {sent && <p className="form-success">{t('Thank you! Your feedback was sent to the ministry.')}</p>}
          {failure && <p className="form-error">{failure}</p>}
        </div>
      </form>
    </div>
  )
}
