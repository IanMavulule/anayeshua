import i18n from '../../locales'

/** Mensagem traduzida para os códigos de erro estáveis da API. */
export function errorMessage(code: string | null | undefined): string {
  switch (code) {
    case null:
    case undefined:
    case '':
      return ''
    case 'invalid_credentials':
      return i18n.t('Incorrect e-mail or password.')
    case 'too_many_attempts':
      return i18n.t('Too many attempts. Please wait a few minutes and try again.')
    case 'account_suspended':
      return i18n.t('This account is suspended. Please contact the ministry.')
    case 'email_taken':
      return i18n.t('There is already an account with this e-mail.')
    case 'signups_closed':
      return i18n.t('New registrations are closed at the moment.')
    case 'invalid_body':
      return i18n.t('Please check the fields and try again.')
    case 'invalid_account':
      return i18n.t('The number does not match the selected wallet.')
    case 'payment_in_progress':
      return i18n.t('There is already a payment waiting for confirmation. Please wait two minutes.')
    case 'insufficient_balance':
      return i18n.t('Insufficient balance in the wallet.')
    case 'failed':
      return i18n.t('The payment was declined.')
    case 'payment_rejected':
      return i18n.t('The payment was not accepted or has expired.')
    case 'provider_unreachable':
    case 'payments_not_configured':
      return i18n.t('Payments are not available yet. Please try again later.')
    case 'provider_error':
    case 'provider_auth':
      return i18n.t('The payment service is unavailable. Please try again later.')
    case 'premium_required':
      return i18n.t('This content is Premium.')
    case 'assistance_required':
      return i18n.t('Assistance is included in the 500 MT plan.')
    case 'comments_closed':
      return i18n.t('Sharing is closed at the moment.')
    case 'lesson_not_found':
      return i18n.t('This lesson is no longer available.')
    case 'too_many_open_questions':
      return i18n.t('You already have several open questions. Please wait for an answer.')
    case 'network_error':
      return i18n.t('Server unavailable. Start it with `npm run dev`.')
    case 'unauthorized':
      return i18n.t('Your session has expired. Please sign in again.')
    default:
      return i18n.t('Something went wrong. Please try again.')
  }
}
