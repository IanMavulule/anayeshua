import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import GoogleSignIn from '../../components/auth/GoogleSignIn'
import AuthLayout from '../../components/layout/AuthLayout'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/Field'
import { useAuthActions, useSession } from '../../hooks/auth/useSession'
import { usePageMeta } from '../../hooks/common/usePageMeta'
import { loginDestination } from '../../utils/auth/loginDestination'
import { ROUTES } from '../../utils/constants/routes'
import { errorMessage } from '../../utils/format/errorMessage'

const MIN_PASSWORD = 8

/** Registo gratuito: dá acesso ao acompanhamento (mensagem do dia, aulas gratuitas, dúvidas). */
export default function RegisterPage() {
  const { t, i18n } = useTranslation()
  usePageMeta(t('Create account'))
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useSession()
  const { register, loginWithGoogle, loading, error, setError } = useAuthActions()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const destination = loginDestination(location.search)

  useEffect(() => {
    if (user) navigate(destination, { replace: true })
  }, [user, navigate, destination])

  const update = (field: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.password !== form.confirm) {
      setError('passwords_mismatch')
      return
    }
    const created = await register(form.name.trim(), form.email.trim(), form.password, i18n.language === 'en' ? 'en' : 'pt')
    if (created) navigate(destination, { replace: true })
  }

  async function handleGoogle(credential: string) {
    const signedIn = await loginWithGoogle(credential, i18n.language === 'en' ? 'en' : 'pt')
    if (signedIn) navigate(destination, { replace: true })
  }

  const message = error === 'passwords_mismatch' ? t('The passwords do not match.') : errorMessage(error)

  return (
    <AuthLayout>
      <h1>{t('Join the community')}</h1>
      <p className="lead">
        {t('With a free account you receive the message of the day, the prayer points, the free lessons and can send questions to the prophetess.')}
      </p>
      <form onSubmit={handleSubmit}>
        <TextField id="register-name" label={t('Name')} autoComplete="name" value={form.name} onChange={update('name')} minLength={2} maxLength={80} required />
        <TextField id="register-email" type="email" label={t('E-mail')} autoComplete="email" value={form.email} onChange={update('email')} required />
        <TextField
          id="register-password"
          type="password"
          label={t('Password')}
          hint={t('At least {{count}} characters.', { count: MIN_PASSWORD })}
          autoComplete="new-password"
          value={form.password}
          onChange={update('password')}
          minLength={MIN_PASSWORD}
          required
        />
        <TextField id="register-confirm" type="password" label={t('Confirm password')} autoComplete="new-password" value={form.confirm} onChange={update('confirm')} minLength={MIN_PASSWORD} required />
        <div aria-live="polite">{message && <p className="form-error">{message}</p>}</div>
        <Button type="submit" variant="primary" block disabled={loading}>{loading ? t('Creating account…') : t('Create account')}</Button>
      </form>
      <GoogleSignIn onCredential={handleGoogle} disabled={loading} />
      <p className="auth__switch">
        {t('Already have an account?')} <Link className="text-link" to={`${ROUTES.login}${location.search}`}>{t('Sign in')}</Link>
      </p>
    </AuthLayout>
  )
}
