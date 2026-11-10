import type { User } from '../models/entities.ts'
import { hasActiveSubscription } from '../models/userModel.ts'

/** Membro tal como aparece no painel de administração. */
export function toAdminMember(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan: hasActiveSubscription(user) ? ('premium' as const) : ('free' as const),
    status: user.status,
    since: user.createdAt.slice(0, 10),
    last: user.lastLoginAt ? user.lastLoginAt.slice(0, 16) : '',
    subscriptionEndsAt: user.role === 'admin' ? null : user.subscription?.expiresAt ?? null,
  }
}

export type AdminMember = ReturnType<typeof toAdminMember>
