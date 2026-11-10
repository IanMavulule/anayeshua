/** Identidade da marca e ligações oficiais. */
export const BRAND = {
  name: 'Ana Yeshua - Holy Ghost Ministering',
  shortName: 'Ana Yeshua',
  ministry: 'Holy Ghost Ministering',
  /** Nome público da marca pessoal, conforme a apresentação institucional. */
  publicName: 'Profetisa Ana Yeshua',
} as const

export const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/anayeshua_hgm/',
  youtube: 'https://www.youtube.com/@siloebetelmissions',
  youtubePlaylists: 'https://www.youtube.com/@siloebetelmissions/playlists',
  whatsapp: 'https://whatsapp.com/channel/0029VawknazLtOjCafF5pC1v',
  facebook: 'https://www.facebook.com/p/Ana-Yeshua-Holy-Ghost-Ministering-61566049350231/',
  assistanceBooking: 'https://calendar.app.google/BiiZMR5k6chtopZp8',
} as const

/** Título do documento: "<página> · Ana Yeshua - Holy Ghost Ministering". */
export function pageTitle(page?: string): string {
  return page ? `${page} · ${BRAND.name}` : BRAND.name
}
