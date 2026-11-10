import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import TodayMessageCard from '../../components/daily/TodayMessageCard'
import SeriesPoster from '../../components/devotionals/SeriesPoster'
import Hero from '../../components/landing/Hero'
import MessageSection from '../../components/landing/MessageSection'
import MissionSection from '../../components/landing/MissionSection'
import NextEvent from '../../components/landing/NextEvent'
import PlansSection from '../../components/landing/PlansSection'
import PageShell from '../../components/layout/PageShell'
import { ButtonLink } from '../../components/ui/Button'
import Rail from '../../components/ui/Rail'
import { useCatalog } from '../../hooks/catalog/useCatalog'
import { usePageMeta } from '../../hooks/common/usePageMeta'
import { BRAND, SOCIAL_LINKS } from '../../utils/constants/brand'
import { ROUTES } from '../../utils/constants/routes'

const PHOTOS = [
  { src: '/brand/img/carousel-1.webp', alt: 'Ana Yeshua com veste branca bordada a dourado' },
  { src: '/brand/img/carousel-2.webp', alt: 'Ana Yeshua com vestido verde-água' },
  { src: '/brand/img/carousel-3.webp', alt: 'Ana Yeshua de braços abertos, com blusa floral' },
  { src: '/brand/img/carousel-4.webp', alt: 'Ana Yeshua com blusa floral e saia verde' },
]

export default function LandingPage() {
  const { t } = useTranslation()
  usePageMeta(undefined)
  const navigate = useNavigate()
  const { series } = useCatalog()
  const ordered = [...series.filter((item) => item.featured), ...series.filter((item) => !item.featured)]

  const channels = [
    { title: t('Follow'), text: t('Official photos, reels, reflections and content for women.'), href: SOCIAL_LINKS.instagram, label: 'Instagram' },
    { title: t('Ministrations'), text: t('Teachings, messages, ministration videos and ministry activities.'), href: SOCIAL_LINKS.facebook, label: 'Facebook' },
    { title: t('Watch'), text: t('Playlists, services and video messages.'), href: SOCIAL_LINKS.youtubePlaylists, label: 'YouTube' },
    { title: t('Stay informed'), text: t('Messages, prayer points, teachings and ministry announcements.'), href: SOCIAL_LINKS.whatsapp, label: t('WhatsApp channel') },
  ]

  return (
    <PageShell overlayHeader>
      <Hero />

      <div className="band band--white">
      <section className="wrap ministry" id="ministerio" aria-labelledby="ministerio-title">
        <figure className="ministry__figure">
          <img src="/brand/img/ana-mint.webp" width={1050} height={1500} alt={t('Ana Yeshua in a studio portrait')} loading="lazy" />
        </figure>
        <div className="ministry__copy">
          <p className="kicker">{t('Who is Prophetess Ana Yeshua?')}</p>
          <h2 className="display" id="ministerio-title">{t('Prophetic, biblical and centred on the Holy Spirit')}</h2>
          <p className="lead">
            {t('Prophetess Ana Yeshua ministers through the prophetic ministry, the teaching of the Word of God, the ministry of the Holy Spirit, prayer and worship.')}
          </p>
          <p className="muted">
            {t('Her message is especially directed to women — to know their identity in God, understand their purpose and live in intimacy with the Holy Spirit — while reaching everyone who seeks the Word and a deeper spiritual life.')}
          </p>
          <p className="ministry__signature">
            <strong>{BRAND.publicName}</strong>
            <span>{t('Founder')}, {BRAND.ministry}</span>
          </p>
          <ButtonLink to={SOCIAL_LINKS.facebook} external variant="secondary">{t('Get to know the ministry')}</ButtonLink>
        </div>
      </section>
      </div>

      <div className="band band--mist">
        <MessageSection />
      </div>

      <div className="band band--white">
        <MissionSection />
      </div>

      <div className="band band--linen">
      <section className="wrap" aria-label={t('Word of the day')}>
        <TodayMessageCard compact />
      </section>

      {ordered.length > 0 && (
        <div className="wrap section-gap" id="devocionais">
          <Rail
            id="devocionais-title"
            title={t('Devotionals')}
            action={<ButtonLink to={ROUTES.devotionals} variant="ghost" size="sm">{t('See all devotionals')}</ButtonLink>}
          >
            {ordered.map((item) => (
              <SeriesPoster key={item.id} series={item} onOpen={(entry) => navigate(`${ROUTES.devotionals}?list=${entry.id}`)} />
            ))}
          </Rail>
        </div>
      )}
      </div>

      <NextEvent />
      <div className="band band--gold">
        <PlansSection />
      </div>

      <div className="band band--white">
      <section className="wrap connect" id="conectar" aria-labelledby="conectar-title">
        <div className="section-head">
          <div>
            <h2 id="conectar-title">{t('Stay close to the ministry')}</h2>
            <p>{t('Follow the messages, watch the videos and stay close to the ministry — wherever you are.')}</p>
          </div>
        </div>
        <div className="connect__grid">
          {channels.map((channel) => (
            <a key={channel.label} className="connect__item" href={channel.href} target="_blank" rel="noreferrer">
              <h3>{channel.title}</h3>
              <p>{channel.text}</p>
              <span className="text-link">{channel.label}</span>
            </a>
          ))}
        </div>
        <div className="connect__photos">
          {PHOTOS.map((photo) => (
            <a key={photo.src} href={SOCIAL_LINKS.instagram} target="_blank" rel="noreferrer">
              <img src={photo.src} width={1200} height={900} alt={photo.alt} loading="lazy" decoding="async" />
            </a>
          ))}
        </div>
      </section>
      </div>
    </PageShell>
  )
}
