import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AssistancePanel from '../../components/devotionals/AssistancePanel'
import LessonQuestions from '../../components/devotionals/LessonQuestions'
import PrayerPoints from '../../components/devotionals/PrayerPoints'
import NotesPanel from '../../components/devotionals/NotesPanel'
import PremiumGate from '../../components/devotionals/PremiumGate'
import SeriesOutline from '../../components/devotionals/SeriesOutline'
import TestimonySection from '../../components/devotionals/TestimonySection'
import SeriesPoster from '../../components/devotionals/SeriesPoster'
import PageShell from '../../components/layout/PageShell'
import Badge from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'
import Loader from '../../components/ui/Loader'
import Rail from '../../components/ui/Rail'
import { useSession } from '../../hooks/auth/useSession'
import { useCatalog } from '../../hooks/catalog/useCatalog'
import { useVideoPlayer } from '../../hooks/catalog/useVideoPlayer'
import { usePageMeta } from '../../hooks/common/usePageMeta'
import type { CatalogLesson, CatalogSeries, PlanId } from '../../types/api'
import { loginUrl } from '../../utils/auth/loginDestination'
import { SOCIAL_LINKS } from '../../utils/constants/brand'
import { ALL_CATEGORIES, categoryLabel } from '../../utils/constants/categories'
import { ROUTES } from '../../utils/constants/routes'

// O leitor (Video.js + hls.js) só é descarregado quando se abre uma aula.
const LessonPlayer = lazy(() => import('../../components/devotionals/LessonPlayer'))

type OutlineTab = 'content' | 'notes' | 'assistance'
type Gate = { open: boolean; reason: 'video' | 'assistance' }

/**
 * Biblioteca de devocionais. O URL (`?list=&video=&tab=`) é a única fonte de
 * verdade do que está aberto: os cliques só alteram o URL e um efeito abre a
 * aula correspondente, por isso deep-links e o botão "voltar" funcionam.
 */
export default function DevotionalsPage() {
  const { t } = useTranslation()
  usePageMeta(t('Devotionals'))
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, loading: sessionLoading } = useSession()
  const { series, categories, loading: catalogLoading, error: catalogError } = useCatalog()

  const [filter, setFilter] = useState<string>(ALL_CATEGORIES)
  const [current, setCurrent] = useState<{ series: CatalogSeries; lesson: CatalogLesson } | null>(null)
  const [outlineTab, setOutlineTab] = useState<OutlineTab>('content')
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState('')
  const [gate, setGate] = useState<Gate>({ open: false, reason: 'video' })

  const watchRef = useRef<HTMLElement | null>(null)
  const userInitiatedRef = useRef(false)
  const lastHandledRef = useRef('')
  /** Aula cujos pontos de oração foram pedidos na lista; desce até eles quando a aula abrir. */
  const [prayerTarget, setPrayerTarget] = useState('')
  const premium = Boolean(user?.premium)
  // A assistência é só do plano de 500 MT; o Premium de 200 MT não a inclui.
  const assistance = Boolean(user?.assistance)

  const { session: playerSession, getToken, handleFailure, play, release } = useVideoPlayer(() => setNotice(t('The file for this video is not available yet.')))

  const goToLogin = useCallback(
    (list: string, video?: string) => {
      const params = new URLSearchParams({ list })
      if (video) params.set('video', video)
      navigate(loginUrl(`${ROUTES.devotionals}?${params.toString()}`))
    },
    [navigate],
  )

  /* --- Abrir a aula indicada no URL -------------------------------------- */
  useEffect(() => {
    if (catalogLoading || sessionLoading) return
    const list = searchParams.get('list')
    const videoParam = searchParams.get('video')
    const key = `${list}|${videoParam}|${user?.id ?? ''}|${premium}|${assistance}`
    if (key === lastHandledRef.current) return
    lastHandledRef.current = key

    const item = series.find((entry) => entry.id === list)
    if (!item) {
      release()
      setCurrent(null)
      return
    }
    const lesson = item.lessons.find((entry) => entry.id === videoParam) ?? item.lessons[0]
    if (!lesson) return
    if (!user) {
      goToLogin(item.id, videoParam ?? undefined)
      return
    }

    const autoplay = userInitiatedRef.current
    userInitiatedRef.current = false
    setCurrent({ series: item, lesson })
    setOpenGroups((groups) => ({ ...groups, [item.id]: true }))
    setOutlineTab('content')
    setNotice('')
    if (autoplay) watchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (lesson.premium && !premium) {
      release()
      setNotice(t('This video is Premium. Choose a plan to watch.'))
      setGate({ open: true, reason: 'video' })
      return
    }
    void play({ lesson, poster: item.poster, title: lesson.title, autoplay}).then((result) => {
      if (result === 'login_required') goToLogin(item.id, lesson.id)
      else if (result === 'premium_required') setGate({ open: true, reason: 'video' })
      else if (result === 'unavailable') setNotice(t('This video is not available yet.'))
      else if (result === 'error') setNotice(t('Could not load this video. Please try again.'))
    })

    if (searchParams.get('tab') === 'assistance') {
      if (assistance) setOutlineTab('assistance')
      else setGate({ open: true, reason: 'assistance' })
    }
  }, [searchParams, series, catalogLoading, sessionLoading, user, premium, assistance, play, release, goToLogin, t])

  /* --- Acções ------------------------------------------------------------ */
  const openLesson = (item: CatalogSeries, lesson?: CatalogLesson, autoplay = true) => {
    userInitiatedRef.current = autoplay
    const next = new URLSearchParams({ list: item.id })
    if (lesson) next.set('video', lesson.id)
    setSearchParams(next)
  }

  /** Pontos de oração escolhidos na lista: abre a aula (sem reproduzir) e desce até eles. */
  const openPrayerPoints = (item: CatalogSeries, lesson: CatalogLesson) => {
    setPrayerTarget(lesson.id)
    if (current?.series.id !== item.id || current.lesson.id !== lesson.id) openLesson(item, lesson, false)
  }

  useEffect(() => {
    if (!prayerTarget || current?.lesson.id !== prayerTarget) return
    const timer = window.setTimeout(() => {
      document.getElementById('prayer-points')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setPrayerTarget('')
    }, 150)
    return () => window.clearTimeout(timer)
  }, [prayerTarget, current])

  const closePlayer = () => {
    setSearchParams({}, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onTab = (tab: OutlineTab) => {
    if (tab === 'assistance' && !assistance) {
      setGate({ open: true, reason: 'assistance' })
      return
    }
    setOutlineTab(tab)
  }

  const closeGate = useCallback(() => setGate((value) => ({ ...value, open: false })), [])

  const choosePlan = (plan: PlanId) => {
    const params = new URLSearchParams({ plan })
    if (current) {
      params.set('list', current.series.id)
      params.set('video', current.lesson.id)
    }
    if (gate.reason === 'assistance') params.set('tab', 'assistance')
    navigate(`${ROUTES.payment}?${params.toString()}`)
  }

  const more = useMemo(
    () => (current ? series.filter((entry) => entry.id !== current.series.id).slice(0, 5) : []),
    [series, current],
  )
  // Filtros: só as categorias configuradas que têm cursos; nenhuns se o campo estiver desligado.
  const filters = categories.length
    ? [ALL_CATEGORIES, ...categories.map((option) => option.id).filter((id) => series.some((item) => item.category === id))]
    : []
  const activeFilter = filters.includes(filter) ? filter : ALL_CATEGORIES
  const visibleSeries = series.filter((item) => activeFilter === ALL_CATEGORIES || item.category === activeFilter)
  const spotlight = series.find((item) => item.featured) ?? series[0]
  const lessonIndex = current ? current.series.lessons.findIndex((lesson) => lesson.id === current.lesson.id) : -1
  const tabs: [OutlineTab, string][] = [
    ['content', t('Contents')],
    ['notes', t('Notes')],
    ['assistance', t('Assistance')],
  ]

  return (
    <PageShell overlayHeader={!current}>
      {!current && spotlight && (
        <section className="billboard billboard--library" aria-labelledby="library-title">
          <img className="billboard__image" src={spotlight.poster} width={1400} height={788} alt="" fetchPriority="high" />
          <div className="wrap billboard__inner">
            <h1 className="display" id="library-title">{t('Devotionals')}</h1>
            <p className="lead">{t('Choose a series to start. Free series are open to everyone with an account; Premium unlocks all the others.')}</p>
            <div className="hero__actions">
              <Button variant="primary" onClick={() => openLesson(spotlight)}><Icon name="play" filled />{spotlight.title}</Button>
              <ButtonLink to={SOCIAL_LINKS.youtubePlaylists} external variant="secondary">{t('See the full channel')}</ButtonLink>
            </div>
          </div>
        </section>
      )}

      <section className="watch" id="watch" ref={watchRef} hidden={!current} aria-label={current?.lesson.title}>
        <div className="wrap watch__wrap">
          <Button variant="ghost" size="sm" className="watch__back" onClick={closePlayer}><Icon name="arrow-left" />{t('Back to devotionals')}</Button>
          <div className="watch__layout">
            <div className="watch__main">
              <Suspense fallback={<div id="player-frame" className="player" />}>
                <LessonPlayer session={playerSession} getToken={getToken} onFailure={handleFailure} />
              </Suspense>
              <p className="form-note watch__notice" aria-live="polite" hidden={!notice}><Icon name="lock" /> {notice}</p>
              {current && (
                <div className="watch__info">
                  <p className="kicker">{current.series.title}{lessonIndex >= 0 && `, ${t('Video {{number}}', { number: lessonIndex + 1 })}`}</p>
                  <h1 className="watch__title">{current.lesson.title}</h1>
                  <p className="watch__badges">
                    {categoryLabel(current.series.category) && <Badge>{categoryLabel(current.series.category)}</Badge>}
                    <Badge tone={current.lesson.premium ? 'gold' : 'success'}>{current.lesson.premium ? t('Premium') : t('Free')}</Badge>
                  </p>
                  <p className="muted">{current.series.description}</p>
                </div>
              )}
              {current && (
                <PrayerPoints lesson={current.lesson} locked={current.lesson.premium && !premium} />
              )}
            </div>
            <aside className="watch__side panel" aria-label={t('Series contents')}>
              <div className="tabs" role="tablist" aria-label={t('Devotional details')}>
                {tabs.map(([tab, label]) => (
                  <button key={tab} className="tab" type="button" role="tab" aria-selected={outlineTab === tab} onClick={() => onTab(tab)}>
                    {label}
                    {tab === 'assistance' && !assistance && <Icon name="lock" />}
                  </button>
                ))}
              </div>
              <div className="watch__panel" role="tabpanel" hidden={outlineTab !== 'content'}>
                <SeriesOutline
                  series={series}
                  currentSeriesId={current?.series.id ?? ''}
                  currentLessonId={current?.lesson.id ?? ''}
                  openGroups={openGroups}
                  premium={premium}
                  onToggleGroup={(id, open) => setOpenGroups((groups) => ({ ...groups, [id]: open }))}
                  onSelect={(item, lesson) => openLesson(item, lesson)}
                  onPrayerPoints={openPrayerPoints}
                />
              </div>
              <div className="watch__panel" role="tabpanel" hidden={outlineTab !== 'notes'}>
                <NotesPanel />
              </div>
              <div className="watch__panel" role="tabpanel" hidden={outlineTab !== 'assistance'}>
                {assistance && <AssistancePanel />}
              </div>
            </aside>
          </div>

          {current && (
            <LessonQuestions
              courseId={current.series.id}
              lessonId={current.lesson.id}
              lessonTitle={current.lesson.title}
              locked={current.lesson.premium && !premium}
              onUnlock={() => setGate({ open: true, reason: 'video' })}
            />
          )}

          {more.length > 0 && (
            <div className="section-gap">
              <Rail id="more-title" title={t('More devotionals')}>
                {more.map((item) => <SeriesPoster key={item.id} series={item} onOpen={(entry) => openLesson(entry)} />)}
              </Rail>
            </div>
          )}

          {current && <TestimonySection courseId={current.series.id} lessonId={current.lesson.id} />}
        </div>
      </section>

      {!current && (
        <section className="wrap library" aria-labelledby="library-grid-title">
          <div className="section-head">
            <h2 id="library-grid-title">{t('Choose a series')}</h2>
            <div className="chips" role="group" aria-label={t('Filter contents')}>
              {filters.length > 2 && filters.map((value) => (
                <button key={value} className="chip" type="button" aria-pressed={activeFilter === value} onClick={() => setFilter(value)}>
                  {categoryLabel(value)}
                </button>
              ))}
            </div>
          </div>
          {catalogError && <p className="form-error">{t('Could not load the video catalogue. Start the server with `npm run dev`.')}</p>}
          {catalogLoading && <Loader />}
          <div className="grid-posters">
            {visibleSeries.map((item) => <SeriesPoster key={item.id} series={item} onOpen={(entry) => openLesson(entry)} />)}
          </div>
        </section>
      )}

      <PremiumGate open={gate.open} reason={gate.reason} onClose={closeGate} onChoose={choosePlan} />
    </PageShell>
  )
}
