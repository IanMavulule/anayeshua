import { useTranslation } from 'react-i18next'

/**
 * Mensagem central e pilares de actuação, segundo a apresentação
 * institucional da Profetisa Ana Yeshua.
 */
export default function MessageSection() {
  const { t } = useTranslation()

  const dimensions = [
    {
      title: t('The Holy Spirit'),
      text: t('Knowing, communion with and dependence on the Holy Spirit — His person, His ministry and His work in the life of the Christian.'),
    },
    {
      title: t('The prophetic ministry'),
      text: t('Ministrations, teachings and prophetic messages, always with the Word of God as foundation and reference.'),
    },
    {
      title: t('Women and purpose'),
      text: t('Reaching, teaching and building up women to know their identity in God, recognise their purpose and grow spiritually.'),
    },
  ]

  const pillars = [
    {
      title: t('Ministry of the Holy Spirit'),
      items: [t('The person of the Holy Spirit'), t('Intimacy and communion'), t('Spiritual gifts and manifestations'), t('Sensitivity to His leading')],
    },
    {
      title: t('Prophetic ministry'),
      items: [t('Teaching on the prophetic'), t('Prophetic ministrations'), t('Spiritual discernment'), t('Biblical foundations of the prophetic')],
    },
    {
      title: t('Women and purpose'),
      items: [t('A woman\'s identity in God'), t('Purpose and calling'), t('Women and spiritual leadership'), t('Women of the Bible')],
    },
    {
      title: t('Word of God'),
      items: [t('Bible studies'), t('Ministerial teachings'), t('Kingdom principles'), t('Reflections on the Scriptures')],
    },
    {
      title: t('Prayer, intercession and worship'),
      items: [t('Prayer points'), t('Prayer and fasting campaigns'), t('Intercession'), t('Consecration and spiritual life')],
    },
    {
      title: t('Ministerial activity'),
      items: [t('Conferences'), t('Women\'s gatherings'), t('Ministerial travels'), t('Testimonies')],
    },
  ]

  return (
    <section className="wrap message" id="mensagem" aria-labelledby="mensagem-title">
      <div className="section-head">
        <div>
          <p className="kicker">{t('Central message')}</p>
          <h2 id="mensagem-title">{t('Three dimensions of one calling')}</h2>
          <p>{t('Everything the ministry teaches, prays and lives is rooted in these three dimensions.')}</p>
        </div>
      </div>

      <ol className="message__dimensions">
        {dimensions.map((item, index) => (
          <li key={item.title} className="message__dimension">
            <span className="message__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </li>
        ))}
      </ol>

      <h3 className="message__pillars-title">{t('Areas of ministry')}</h3>
      <div className="message__pillars">
        {pillars.map((pillar) => (
          <article key={pillar.title} className="message__pillar">
            <h4>{pillar.title}</h4>
            <ul>
              {pillar.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}
