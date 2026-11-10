import type { CourseField, FieldOption, Settings } from '../entities.ts'
import { withTransaction, type DocumentStore, type Queryable } from '../store/pgStore.ts'

/** Campo do curso ↔ valor da coluna `field` em course_field_options. */
const FIELDS = { categories: 'category', levels: 'level' } as const
type FieldKey = keyof typeof FIELDS

interface SettingsRow {
  name: string
  email: string
  description: string
  moderation: boolean
  comments: boolean
  signups: boolean
  maintenance: boolean
  categories_enabled: boolean
  levels_enabled: boolean
}

interface OptionRow {
  field: string
  id: string
  label: string
  label_en: string
}

/**
 * Configurações: uma linha em `settings` (id = 1) e as opções de categoria e
 * nível em `course_field_options`, pela ordem de `position`. Se a linha faltar,
 * usa os valores por omissão (com as opções que existirem na tabela, ou as
 * por omissão se não houver nenhuma).
 */
export class SettingsRepository implements DocumentStore<Settings> {
  private readonly exec: Queryable
  private readonly fallback: Settings

  constructor(exec: Queryable, fallback: Settings) {
    this.exec = exec
    this.fallback = fallback
  }

  private async load(exec: Queryable, lock: boolean): Promise<Settings> {
    const { rows } = await exec.query<SettingsRow>(`SELECT * FROM settings WHERE id = 1${lock ? ' FOR UPDATE' : ''}`)
    const options = await exec.query<OptionRow>(
      `SELECT field, id, label, label_en FROM course_field_options ORDER BY field, position, id`,
    )
    const row = rows[0]
    const field = (key: FieldKey, enabled: boolean | undefined): CourseField => {
      const list: FieldOption[] = options.rows
        .filter((option) => option.field === FIELDS[key])
        .map((option) => ({ id: option.id, label: option.label, labelEn: option.label_en }))
      return {
        enabled: enabled ?? this.fallback[key].enabled,
        options: row || list.length ? list : this.fallback[key].options,
      }
    }
    if (!row) {
      return { ...this.fallback, categories: field('categories', undefined), levels: field('levels', undefined) }
    }
    return {
      name: row.name,
      email: row.email,
      description: row.description,
      moderation: row.moderation,
      comments: row.comments,
      signups: row.signups,
      maintenance: row.maintenance,
      categories: field('categories', row.categories_enabled),
      levels: field('levels', row.levels_enabled),
    }
  }

  read(): Promise<Settings> {
    return this.load(this.exec, false)
  }

  /**
   * Grava as alterações. As opções de um campo enviado substituem as actuais
   * (por id, mantendo a ordem recebida); as que deixarem de constar são
   * apagadas. A chave estrangeira dos cursos impede apagar uma opção em uso
   * (o presenter já o verifica antes, com o código `option_in_use`).
   */
  write(patch: Partial<Settings>): Promise<Settings> {
    return withTransaction(this.exec, async (client) => {
      const next: Settings = { ...(await this.load(client, true)), ...patch }
      await client.query(
        `INSERT INTO settings (id, name, email, description, moderation, comments, signups, maintenance, categories_enabled, levels_enabled)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, email = EXCLUDED.email, description = EXCLUDED.description,
           moderation = EXCLUDED.moderation, comments = EXCLUDED.comments, signups = EXCLUDED.signups,
           maintenance = EXCLUDED.maintenance, categories_enabled = EXCLUDED.categories_enabled,
           levels_enabled = EXCLUDED.levels_enabled`,
        [
          next.name,
          next.email,
          next.description,
          next.moderation,
          next.comments,
          next.signups,
          next.maintenance,
          next.categories.enabled,
          next.levels.enabled,
        ],
      )
      for (const key of Object.keys(FIELDS) as FieldKey[]) {
        // Sem linha anterior, grava também as opções por omissão.
        const options = next[key].options
        const field = FIELDS[key]
        const ids = options.map((option) => option.id)
        if (new Set(ids).size !== ids.length) throw new Error('duplicate_option')
        await client.query(`DELETE FROM course_field_options WHERE field = $1 AND NOT (id = ANY($2::text[]))`, [field, ids])
        for (const [position, option] of options.entries()) {
          await client.query(
            `INSERT INTO course_field_options (field, id, label, label_en, position) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (field, id) DO UPDATE SET label = EXCLUDED.label, label_en = EXCLUDED.label_en, position = EXCLUDED.position`,
            [field, option.id, option.label, option.labelEn ?? '', position],
          )
        }
      }
      return this.load(client, false)
    })
  }
}
