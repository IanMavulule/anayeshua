import { useTranslation } from 'react-i18next'
import { usePosts } from '../../hooks/community/usePosts'
import { formatDate } from '../../utils/format/date'
import EmptyState from '../ui/EmptyState'

/** Anotações diárias da profetisa (separador "Anotações" do player). */
export default function NotesPanel() {
  const { t } = useTranslation()
  const { posts, loading } = usePosts('note', 5)

  return (
    <div className="side-notes">
      {!loading && posts.length === 0 && <EmptyState title={t('Notes from Ana')}>{t('The official notes will be shown here when they are published.')}</EmptyState>}
      {posts.map((post) => (
        <article key={post.id} className="side-notes__item">
          <header>
            <strong>{post.title}</strong>
            <time dateTime={post.publishAt}>{formatDate(post.publishAt)}</time>
          </header>
          <p>{post.locked ? t('This note is Premium.') : post.body}</p>
        </article>
      ))}
    </div>
  )
}
