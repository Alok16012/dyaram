import { BRAND } from '../lib/brand'

// Dayare Haram logo. `variant="mark"` is the round globe icon (collapsed
// sidebar, favicon-sized spots); `variant="full"` is the complete wordmark.
export default function BrandMark({ className, size = 38, variant = 'mark' }) {
  if (variant === 'full') {
    return <img className={className} src={BRAND.logo} alt={BRAND.legalName} style={{ height: size, width: 'auto' }} />
  }
  return <img className={className} src={BRAND.mark} alt={BRAND.name} width={size} height={size} style={{ objectFit: 'contain' }} />
}
