import { useTranslation } from 'react-i18next'
import type { PlanId } from '../../types/api'
import { Button } from '../ui/Button'
import Dialog from '../ui/Dialog'

type Props = {
  open: boolean
  reason: 'video' | 'assistance'
  onClose: () => void
  onChoose: (plan: PlanId) => void
}

const PLANS: { id: PlanId; days: number; assistance: boolean }[] = [
  { id: '200', days: 30, assistance: false },
  { id: '500', days: 90, assistance: true },
]

/**
 * Convite para subscrever quando o conteúdo está bloqueado. Para a assistência
 * só se oferece o plano de 500 MT, o único que a inclui.
 */
export default function PremiumGate({ open, reason, onClose, onChoose }: Props) {
  const { t } = useTranslation()
  const plans = reason === 'assistance' ? PLANS.filter((plan) => plan.assistance) : PLANS
  return (
    <Dialog open={open} labelledBy="premium-title" onClose={onClose}>
      <div id="premium-gate" className="gate">
        <div className="gate__glow" aria-hidden="true" />
        <h2 className="display" id="premium-title">
          {reason === 'assistance' ? t('Premium with assistance') : t('Unlock Premium')}
        </h2>
        <p className="muted">
          {reason === 'assistance'
            ? t('Assistance with Ana Yeshua is included in the 500 MT plan. Choose it to see the available times.')
            : t('Choose a plan to keep watching the Premium videos.')}
        </p>
        <div className="plan-options">
          {plans.map((plan) => (
            <article key={plan.id} className={`plan-option${plan.assistance ? ' plan-option--featured' : ''}`}>
              <p className="plan-option__days">{t('{{days}} days', { days: plan.days })}</p>
              <p className="plan-option__price">{plan.id}<small>MT</small></p>
              <p className="muted">
                {plan.assistance ? t('All videos, notes and assistance with Ana Yeshua.') : t('All videos and notes.')}
              </p>
              <Button variant={plan.assistance ? 'primary' : 'secondary'} block onClick={() => onChoose(plan.id)}>{t('Choose plan')}</Button>
            </article>
          ))}
        </div>
        <p className="form-note">{t('Payment by M-Pesa, e-Mola, mKesh or iMali through iMaliWay.')}</p>
      </div>
    </Dialog>
  )
}
