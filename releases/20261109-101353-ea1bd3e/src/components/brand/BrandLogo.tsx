import { BRAND } from '../../utils/constants/brand'

type Props = { tone?: 'gold' | 'white' | 'teal'; loading?: 'eager' | 'lazy' }

export default function BrandLogo({ tone = 'gold', loading = 'eager' }: Props) {
  return (
    <img
      className="brand-logo"
      src={`/brand/logo-${tone}.webp`}
      width={205}
      height={47}
      alt={BRAND.name}
      loading={loading}
    />
  )
}
