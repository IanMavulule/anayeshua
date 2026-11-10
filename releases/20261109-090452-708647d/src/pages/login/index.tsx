import { useEffect, useState, type FormEvent } from 'react'
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

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  usePageMeta(t('Sign in'))
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useSession()
  const { login, loginWithGoogle, loading, error } = useAuthActions()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const destination = loginDestination(location.search)

  useEffect(() => {
    if (user) navigate(destination, { replace: true })
  }, [user, navigate, destination])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const signedIn = await login(email.trim(), password)
    if (signedIn) navigate(signedIn.role === 'admin' && destination === ROUTES.dashboard ? ROUTES.admin : destination, { replace: true })
  }

  async function handleGoogle(credential: string) {
    const signedIn = await loginWithGoogle(credential, i18n.language === 'en' ? 'en' : 'pt')
    if (signedIn) navigate(signedIn.role === 'admin' && destination === ROUTES.dashboard ? ROUTES.admin : destination, { replace: true })
  }

  const failure = errorMessage(error)

  return (
    <AuthLayout>
      <h1>{t('Welcome back')}</h1>
      <p className="lead">{t('Sign in to keep following the messages and devotionals.')}</p>
      <form id="login-form" onSubmit={handleSubmit} noValidate={false}>
        <TextField id="login-email" name="email" type="email" label={t('E-mail')} autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <TextField id="login-password" name="password" type="password" label={t('Password')} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <div aria-live="polite">{failure && <p id="login-error" className="form-error">{failure}</p>}</div>
        <Button type="submit" variant="primary" block disabled={loading}>{loading ? t('Signing in…') : t('Sign in')}</Button>
      </form>
      <GoogleSignIn onCredential={handleGoogle} disabled={loading} />
      <p className="auth__switch">
        {t('No account yet?')} <Link className="text-link" to={`${ROUTES.register}${location.search}`}>{t('Create a free account')}</Link>
      </p>
    </AuthLayout>
  )
}
