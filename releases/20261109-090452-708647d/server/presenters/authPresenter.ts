import type { Request, Response } from 'express'
import type { AppContext } from '../context.ts'
import { expiredSessionCookie, sessionCookie } from '../middleware/authMiddleware.ts'
import { HttpError, parseBody } from '../middleware/errorMiddleware.ts'
import { createFailureLimiter } from '../middleware/rateLimiter.ts'
import type { User } from '../models/entities.ts'
import { normalizeEmail } from '../models/userModel.ts'
import { googleLoginSchema, loginSchema, profileSchema, registerSchema } from '../schemas/authSchemas.ts'
import { hashPassword, verifyPassword } from '../services/passwordService.ts'
import { newId, nowIso } from '../utils/ids.ts'
import { toPublicUser } from '../views/userView.ts'

/** Sessão, registo, login e perfil do utilizador. */
export function createAuthPresenter({ db, config, tokens, google }: AppContext) {
  const limiter = createFailureLimiter()
  const secure = config.production
  const startSession = (user: User) => sessionCookie(tokens.createSession(user.id, user.role), secure)

  return {
    session(request: Request, response: Response) {
      response.json({ authenticated: Boolean(request.user), user: request.user ? toPublicUser(request.user) : null })
    },

    async register(request: Request, response: Response) {
      if (!(await db.settings.read()).signups) throw new HttpError(403, 'signups_closed')
      const body = parseBody(registerSchema, request.body)
      const email = normalizeEmail(body.email)
      if (await db.users.find((user) => user.email === email)) throw new HttpError(409, 'email_taken')
      const user: User = {
        id: newId('u'),
        name: body.name,
        email,
        passwordHash: hashPassword(body.password),
        role: 'member',
        status: 'active',
        language: body.language,
        subscription: null,
        createdAt: nowIso(),
        lastLoginAt: nowIso(),
      }
      try {
        await db.users.insert(user)
      } catch (error) {
        // Dois registos simultâneos com o mesmo e-mail: o índice único decide.
        if (String((error as Error).message).startsWith('duplicate') || (error as { code?: string }).code === '23505') {
          throw new HttpError(409, 'email_taken')
        }
        throw error
      }
      response.setHeader('Set-Cookie', startSession(user))
      response.status(201).json({ user: toPublicUser(user) })
    },

    async login(request: Request, response: Response) {
      const body = parseBody(loginSchema, request.body)
      const email = normalizeEmail(body.email)
      const key = `${request.ip}|${email}`
      if (limiter.blocked(key)) throw new HttpError(429, 'too_many_attempts')
      const user = await db.users.find((item) => item.email === email)
      if (!user || !verifyPassword(body.password, user.passwordHash)) {
        limiter.hit(key)
        throw new HttpError(401, 'invalid_credentials')
      }
      if (user.status !== 'active') throw new HttpError(403, 'account_suspended')
      limiter.reset(key)
      const updated = (await db.users.update(user.id, { lastLoginAt: nowIso() }))!
      response.setHeader('Set-Cookie', startSession(updated))
      response.json({ user: toPublicUser(updated) })
    },

    /** Client ID público para o botão da Google (null = desligado). */
    googleConfig(_request: Request, response: Response) {
      response.json({ clientId: google.clientId })
    },

    /**
     * Entrada com Google: confirma o ID token, encontra o membro pela conta Google
     * ou pelo e-mail (confirmado pela Google) e liga-os; sem conta, cria uma
     * (se os registos estiverem abertos), sem palavra-passe.
     */
    async google(request: Request, response: Response) {
      const body = parseBody(googleLoginSchema, request.body)
      const key = `${request.ip}|google`
      if (limiter.blocked(key)) throw new HttpError(429, 'too_many_attempts')
      let profile
      try {
        profile = await google.verify(body.credential)
      } catch (error) {
        if (error instanceof HttpError && error.status === 401) limiter.hit(key)
        throw error
      }
      const email = normalizeEmail(profile.email)
      let user =
        (await db.users.find((item) => item.googleId === profile.sub)) ??
        (await db.users.find((item) => item.email === email))

      if (user) {
        if (user.status !== 'active') throw new HttpError(403, 'account_suspended')
        // Uma conta já ligada a outra conta Google não muda de dono.
        if (user.googleId && user.googleId !== profile.sub) throw new HttpError(409, 'google_account_mismatch')
        user = (await db.users.update(user.id, { googleId: profile.sub, lastLoginAt: nowIso() }))!
        response.setHeader('Set-Cookie', startSession(user))
        response.json({ user: toPublicUser(user) })
        return
      }

      if (!(await db.settings.read()).signups) throw new HttpError(403, 'signups_closed')
      const created: User = {
        id: newId('u'),
        name: (profile.name || email.split('@')[0]).slice(0, 80),
        email,
        passwordHash: '',
        googleId: profile.sub,
        role: 'member',
        status: 'active',
        language: body.language,
        subscription: null,
        createdAt: nowIso(),
        lastLoginAt: nowIso(),
      }
      try {
        await db.users.insert(created)
      } catch (error) {
        if ((error as { code?: string }).code === '23505') throw new HttpError(409, 'email_taken')
        throw error
      }
      response.setHeader('Set-Cookie', startSession(created))
      response.status(201).json({ user: toPublicUser(created) })
    },

    logout(_request: Request, response: Response) {
      response.setHeader('Set-Cookie', expiredSessionCookie(secure))
      response.status(204).end()
    },

    async updateProfile(request: Request, response: Response) {
      const body = parseBody(profileSchema, request.body)
      const user = request.user!
      const patch: Partial<User> = {}
      if (body.name) patch.name = body.name
      if (body.language) patch.language = body.language
      if (body.newPassword) {
        if (!verifyPassword(body.currentPassword ?? '', user.passwordHash)) {
          throw new HttpError(400, 'invalid_current_password')
        }
        patch.passwordHash = hashPassword(body.newPassword)
      }
      const updated = (await db.users.update(user.id, patch))!
      response.json({ user: toPublicUser(updated) })
    },
  }
}
