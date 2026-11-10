import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../../components/layout/LanguageSwitcher'
import PaymentStatusPanel from '../../components/payment/PaymentStatusPanel'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/Field'
import Icon from '../../components/ui/Icon'
import { useApiData } from '../../hooks/common/useApiData'
import { usePageMeta } from '../../hooks/common/usePageMeta'
import { useCheckout } from '../../hooks/payments/useCheckout'
import type { PaymentMethod, PlanId, PlanInfo } from '../../types/api'
import { BRAND } from '../../utils/constants/brand'
import { ROUTES } from '../../utils/constants/routes'
import { errorMessage } from '../../utils/format/errorMessage'

const METHODS: { id: PaymentMethod; name: string; mark: string; hint: string; placeholder: string }[] = [
  { id: 'mpesa', name: 'M-Pesa', mark: 'M', hint: 'Vodacom', placeholder: '84 123 4567' },
  { id: 'emola', name: 'e-Mola', mark: 'e', hint: 'Movitel', placeholder: '86 123 4567' },
  { id: 'mkesh', name: 'mKesh', mark: 'm', hint: 'Tmcel', placeholder: '82 123 4567' },
  { id: 'imali', name: 'iMali', mark: 'i', hint: 'iMali', placeholder: '123456789' },
]

/** Checkout do Premium: plano, carteira móvel e pedido push pelo iMaliWay. */
export default function PaymentPage() {
  const { t } = useTranslation()
  usePageMeta(t('Premium payment'))
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const { data: plansData } = useApiData<{ plans: PlanInfo[]; provider: 'imaliway' | 'unconfigured' }>('/api/payments/plans')
  // Sem credenciais iMaliWay no servidor, o pagamento não pode ser feito.
  const unavailable = plansData?.provider === 'unconfigured'
  const { start, reset, payment, submitting, error } = useCheckout()

  const [plan, setPlan] = useState<PlanId>(params.get('plan') === '500' ? '500' : '200')
  const [method, setMethod] = useState<PaymentMethod>('mpesa')
  const [account, setAccount] = useState('')
  const accountRef = useRef<HTMLInputElement>(null)

  const plans = plansData?.plans ?? [
    { id: '200', amount: 200, days: 30, label: '', assistance: false },
    { id: '500', amount: 500, days: 90, label: '', assistance: true },
  ]
  const selectedPlan = plans.find((item) => item.id === plan) ?? plans[0]
  const selectedMethod = METHODS.find((item) => item.id === method)!

  const backParams = new URLSearchParams()
  for (const key of ['list', 'video', 'tab']) if (params.get(key)) backParams.set(key, params.get(key)!)
  const backHref = ROUTES.devotionals + (backParams.toString() ? `?${backParams.toString()}` : '')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!account.trim()) {
      accountRef.current?.focus()
      return
    }
    await start(plan, method, account.trim())
  }

  const failure = errorMessage(error)

  return (
    <div className="checkout">
      <header className="checkout__header wrap">
        <Link to={ROUTES.dashboard} aria-label={BRAND.name}>
          <img src="/brand/logo-teal.webp" width={160} height={36} alt={BRAND.name} />
        </Link>
        <span className="checkout__secure"><Icon name="lock" />{t('Secure payment')}</span>
        <LanguageSwitcher />
      </header>

      <main id="conteudo" className="wrap checkout__main">
        <Link className="checkout__back muted" to={backHref}><Icon name="arrow-left" />{t('Back to the devotional')}</Link>
        <div className="checkout__layout">
          <section className="checkout__content">
            {payment ? (
              <PaymentStatusPanel payment={payment} methodName={selectedMethod.name} backHref={backHref} onRetry={reset} />
            ) : (
              <>
                <h1 className="display">{t('Choose the plan and payment method')}</h1>
                <p className="lead">{t('You will receive a confirmation request on your phone. Approve it with your PIN to activate the plan.')}</p>
                <form className="checkout__form" onSubmit={handleSubmit}>
                  <fieldset className="choice-grid">
                    <legend>{t('Plan')}</legend>
                    {plans.map((item) => (
                      <label key={item.id} className="choice">
                        <input type="radio" name="plan" value={item.id} checked={plan === item.id} onChange={() => setPlan(item.id)} />
                        <span className="choice__copy">
                          <strong>{item.amount} MT</strong>
                          <small>
                            {item.assistance
                              ? t('{{days}} days, with assistance', { days: item.days })
                              : t('{{days}} days of Premium access', { days: item.days })}
                          </small>
                        </span>
                        <span className="choice__check" aria-hidden="true"><Icon name="check" /></span>
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="choice-grid">
                    <legend>{t('Available methods')}</legend>
                    {METHODS.map((item) => (
                      <label key={item.id} className="choice">
                        <input type="radio" name="method" value={item.id} checked={method === item.id} onChange={() => setMethod(item.id)} />
                        <span className={`choice__mark choice__mark--${item.id}`} aria-hidden="true">{item.mark}</span>
                        <span className="choice__copy">
                          <strong>{item.name}</strong>
                          <small>{item.hint}</small>
                        </span>
                        <span className="choice__check" aria-hidden="true"><Icon name="check" /></span>
                      </label>
                    ))}
                  </fieldset>
                  <TextField
                    id="account-number"
                    ref={accountRef}
                    label={method === 'imali' ? t('iMali account number') : t('Phone number linked to {{method}}', { method: selectedMethod.name })}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder={selectedMethod.placeholder}
                    value={account}
                    onChange={(event) => setAccount(event.target.value)}
                    required
                  />
                  <div aria-live="polite">
                    {unavailable && <p className="form-error">{t('Payments are not available yet. Please try again later.')}</p>}
                    {failure && <p className="form-error">{failure}</p>}
                  </div>
                  <Button type="submit" variant="primary" block disabled={submitting || unavailable}>
                    {submitting ? t('Sending request…') : t('Pay {{amount}} MT', { amount: selectedPlan.amount })}
                  </Button>
                </form>
              </>
            )}
          </section>

          <aside className="panel panel--gold checkout__summary" aria-label={t('Plan summary')}>
            <h2 className="panel__title">{t('{{days}}-day Premium plan', { days: selectedPlan.days })}</h2>
            <p className="checkout__price"><strong>{selectedPlan.amount}</strong><span>MT</span></p>
            <p className="muted">{t('Access to Premium content after the payment is confirmed.')}</p>
            <ul className="check-list">
              <li><Icon name="check" />{t('All videos in every series')}</li>
              <li><Icon name="check" />{t('Notes from every lesson')}</li>
              {selectedPlan.assistance && <li><Icon name="check" />{t('Personal assistance with Ana Yeshua')}</li>}
            </ul>
            <p className="checkout__total"><span>{t('Total')}</span><strong>{selectedPlan.amount} MT</strong></p>
          </aside>
        </div>
        <p className="form-note checkout__provider">
          {t('Payments processed by iMaliWay: M-Pesa, e-Mola, mKesh and iMali.')}
        </p>
      </main>
    </div>
  )
}
