import { useTranslation } from 'react-i18next'
import type { PublicPayment } from '../../types/api'
import { errorMessage } from '../../utils/format/errorMessage'
import { Button, ButtonLink } from '../ui/Button'
import Icon from '../ui/Icon'

type Props = {
  payment: PublicPayment
  methodName: string
  backHref: string
  onRetry: () => void
}

/** Estado do pagamento push: à espera da confirmação, confirmado ou falhado. */
export default function PaymentStatusPanel({ payment, methodName, backHref, onRetry }: Props) {
  const { t } = useTranslation()
  const details = (
    <dl className="pay-status__details">
      <div><dt>{t('Amount')}</dt><dd>{payment.amount} MT</dd></div>
      <div><dt>{t('Method')}</dt><dd>{methodName}, {payment.accountMasked}</dd></div>
      <div><dt>{t('Reference')}</dt><dd>{payment.partnerTransactionId}</dd></div>
    </dl>
  )

  if (payment.status === 'pending') {
    return (
      <section className="pay-status" aria-live="polite">
        <span className="pay-status__icon pay-status__icon--pending" aria-hidden="true"><Icon name="sparkle" /></span>
        <h1 className="display">{t('Confirm on your phone')}</h1>
        <p className="muted">{t('We sent a payment request to your phone. Enter your PIN to approve it. This page updates automatically.')}</p>
        {details}
      </section>
    )
  }

  if (payment.status === 'confirmed') {
    return (
      <section className="pay-status pay-status--success" aria-live="polite">
        <span className="pay-status__icon" aria-hidden="true"><Icon name="check" /></span>
        <h1 className="display">{t('Payment confirmed')}</h1>
        <p className="muted">{t('Your Premium plan is active. Thank you for supporting the ministry!')}</p>
        {details}
        <ButtonLink to={backHref} variant="primary">{t('Continue watching')}</ButtonLink>
      </section>
    )
  }

  return (
    <section className="pay-status pay-status--error" aria-live="polite">
      <span className="pay-status__icon" aria-hidden="true"><Icon name="close" /></span>
      <h1 className="display">{payment.status === 'expired' ? t('The request expired') : t('Payment not completed')}</h1>
      <p className="muted">
        {payment.status === 'expired'
          ? t('The confirmation was not received in time. You can try again.')
          : errorMessage(payment.failureReason) || t('The payment was declined.')}
      </p>
      {details}
      <Button variant="primary" onClick={onRetry}>{t('Try again')}</Button>
    </section>
  )
}
