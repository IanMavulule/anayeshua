import { useTranslation } from 'react-i18next'

/** Visão, missão e propósito do ministério. */
export default function MissionSection() {
  const { t } = useTranslation()
  const items = [
    {
      title: t('Vision'),
      text: t('To be a ministerial reference for women in Mozambique and around the world, through a message grounded in the Word of God, the prophetic ministry and the work of the Holy Spirit.'),
    },
    {
      title: t('Mission'),
      text: t('To pass on the Word of God, minister through the prophetic gift, teach about the person and ministry of the Holy Spirit and contribute to the spiritual growth of women and of all who receive the message.'),
    },
    {
      title: t('Purpose'),
      text: t('To help women develop their spiritual identity, discover their purpose in God and deepen their relationship with the Holy Spirit.'),
    },
  ]
  return (
    <section className="wrap mission" aria-labelledby="missao-title">
      <h2 className="visually-hidden" id="missao-title">{t('Vision, mission and purpose')}</h2>
      <div className="mission__grid">
        {items.map((item) => (
          <article key={item.title} className="mission__item">
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
