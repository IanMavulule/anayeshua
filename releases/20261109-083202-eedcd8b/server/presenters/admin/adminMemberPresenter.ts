import type { Request, Response } from 'express'
import type { AppContext } from '../../context.ts'
import { HttpError, parseBody, requireIdParam } from '../../middleware/errorMiddleware.ts'
import type { User } from '../../models/entities.ts'
import { extendSubscription, hasActiveSubscription, normalizeEmail } from '../../models/userModel.ts'
import { memberSchema } from '../../schemas/adminSchemas.ts'
import { generatePassword, hashPassword } from '../../services/passwordService.ts'
import { newId, nowIso } from '../../utils/ids.ts'
import { toAdminMember } from '../../views/memberView.ts'

/** Gestão de membros pelo painel. */
export function createAdminMemberPresenter({ db }: AppContext) {
  const ensureUniqueEmail = async (email: string, exceptId?: string) => {
    if (await db.users.find((user) => user.email === email && user.id !== exceptId)) throw new HttpError(409, 'email_taken')
  }

  return {
    // Cria a conta com uma palavra-passe temporária, devolvida uma única vez.
    async create(request: Request, response: Response) {
      const body = parseBody(memberSchema, request.body)
      const email = normalizeEmail(body.email)
      await ensureUniqueEmail(email)
      const temporaryPassword = generatePassword()
      const user: User = {
        id: newId('u'),
        name: body.name,
        email,
        passwordHash: hashPassword(temporaryPassword),
        role: 'member',
        status: body.status,
        language: 'pt',
        subscription: body.plan === 'premium' ? extendSubscription(null, '200', null) : null,
        createdAt: nowIso(),
        lastLoginAt: null,
      }
      await db.users.insert(user, 'start')
      response.status(201).json({ member: toAdminMember(user), temporaryPassword })
    },

    // "premium" manual concede 30 dias a quem não tem plano activo; "free" remove a subscrição.
    async update(request: Request, response: Response) {
      const id = requireIdParam(request.params.id)
      const body = parseBody(memberSchema, request.body)
      const email = normalizeEmail(body.email)
      await ensureUniqueEmail(email, id)
      if (id === request.user!.id && body.status !== 'active') throw new HttpError(400, 'cannot_suspend_self')
      const user = await db.users.update(id, (current) => {
        let subscription = current.subscription
        if (body.plan === 'free') subscription = null
        else if (!hasActiveSubscription(current)) subscription = extendSubscription(null, '200', null)
        return { ...current, name: body.name, email, status: body.status, subscription }
      })
      if (!user) throw new HttpError(404, 'not_found')
      response.json({ member: toAdminMember(user) })
    },

    async remove(request: Request, response: Response) {
      const id = requireIdParam(request.params.id)
      if (id === request.user!.id) throw new HttpError(400, 'cannot_delete_self')
      if (!await db.users.remove(id)) throw new HttpError(404, 'not_found')
      response.status(204).end()
    },
  }
}
