import type { Post } from './entities.ts'

export const POST_TYPES = ['daily-message', 'note', 'prayer-point'] as const

/** Um post é visível quando está publicado e a data de publicação já chegou. */
export function isPostVisible(post: Post, now = Date.now()): boolean {
  return post.status === 'published' && Date.parse(post.publishAt) <= now
}

/** Mais recente primeiro. */
export function byPublishDateDesc(a: Post, b: Post): number {
  return b.publishAt.localeCompare(a.publishAt)
}
