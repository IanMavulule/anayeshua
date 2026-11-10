import type { PublicUser, User } from '../models/entities.ts'
import { hasActiveSubscription, hasAssistance } from '../models/userModel.ts'

/** Utilizador tal como o próprio o vê. O hash da palavra-passe nunca sai do servidor. */
export function toPublicUser(user: User, now = Date.now()): PublicUser {
  const { passwordHash: _hidden, googleId: _google, ...rest } = user
  return { ...rest, premium: hasActiveSubscription(user, now), assistance: hasAssistance(user, now) }
}
