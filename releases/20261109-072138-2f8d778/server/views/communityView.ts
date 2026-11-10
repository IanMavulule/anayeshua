import type { Post, Testimony, User } from '../models/entities.ts'
import { hasActiveSubscription } from '../models/userModel.ts'

/** Conteúdo Premium aparece na lista para quem não tem plano, mas sem o texto. */
export function toPublicPost(post: Post, viewer: User | undefined) {
  const locked = post.premium && !(viewer && hasActiveSubscription(viewer))
  return { ...post, body: locked ? '' : post.body, locked }
}

export function toPublicTestimony(testimony: Testimony) {
  const { userId: _user, ...rest } = testimony
  return rest
}
