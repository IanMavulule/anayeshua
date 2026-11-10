import type { EventItem, Post } from '../entities.ts'
import type { Queryable } from '../store/pgStore.ts'
import { emptyToNull, isoInstant, localDateTime, TableRepository } from './tableRepository.ts'

/** Eventos: `date` é a data e hora local do campo datetime-local ('' = sem data). */
export const createEventRepository = (exec: Queryable) =>
  new TableRepository<EventItem>(exec, {
    table: 'events',
    columns: [
      { key: 'id', column: 'id' },
      { key: 'title', column: 'title' },
      { key: 'kind', column: 'kind' },
      { key: 'date', column: 'starts_at', read: localDateTime('t.starts_at'), toDb: emptyToNull },
      { key: 'place', column: 'place' },
      { key: 'entry', column: 'entry' },
      { key: 'status', column: 'status' },
      { key: 'description', column: 'description' },
      { key: 'image', column: 'image' },
    ],
  })

/** Conteúdo diário: `publishAt` e `createdAt` são instantes ISO (UTC). */
export const createPostRepository = (exec: Queryable) =>
  new TableRepository<Post>(exec, {
    table: 'posts',
    columns: [
      { key: 'id', column: 'id' },
      { key: 'type', column: 'type' },
      { key: 'title', column: 'title' },
      { key: 'body', column: 'body' },
      { key: 'language', column: 'language' },
      { key: 'publishAt', column: 'publish_at', read: isoInstant('t.publish_at') },
      { key: 'status', column: 'status' },
      { key: 'premium', column: 'premium' },
      { key: 'createdAt', column: 'created_at', read: isoInstant('t.created_at') },
    ],
  })
