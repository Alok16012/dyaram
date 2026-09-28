// Brand-coloured illustrated tiles (inline SVG data URIs) used as demo
// photos for destinations, hotels and packages. They always load — no
// network needed — and can be replaced by real photos from the Photos page.

const PALETTES = {
  navy:   ['#12348F', '#061B5C'],
  night:  ['#1B2B5E', '#0A1233'],
  dusk:   ['#3A2F6B', '#0D2A7D'],
  sand:   ['#C8A96B', '#8A6A35'],
  red:    ['#D90A0A', '#7A0505'],
  grey:   ['#8A9A9A', '#4A5656'],
  teal:   ['#11636B', '#0A3A40'],
}

// Simple skyline silhouettes (viewBox 800×600).
const SCENES = {
  // Domed mosque with two minarets
  mosque: `
    <rect x="170" y="210" width="26" height="250" rx="4"/><path d="M165 215h36l-18-42z"/><circle cx="183" cy="168" r="6"/>
    <rect x="604" y="210" width="26" height="250" rx="4"/><path d="M599 215h36l-18-42z"/><circle cx="617" cy="168" r="6"/>
    <path d="M280 330c0-72 54-126 120-126s120 54 120 126z"/><rect x="396" y="170" width="8" height="40"/><path d="M400 150a14 14 0 1 0 10 24 11 11 0 1 1-10-24z"/>
    <rect x="250" y="330" width="300" height="130"/><rect x="210" y="380" width="380" height="80"/>`,
  // Cube-shaped structure with a clock tower behind (Makkah skyline feel)
  kaaba: `
    <rect x="515" y="120" width="70" height="340"/><rect x="530" y="80" width="40" height="44"/><path d="M550 30l14 50h-28z"/>
    <circle cx="550" cy="170" r="22" fill-opacity=".5"/>
    <rect x="290" y="300" width="180" height="160"/><rect x="290" y="330" width="180" height="16" fill-opacity=".45"/>
    <path d="M120 460c60-40 140-60 280-60s220 20 280 60z" fill-opacity=".6"/>`,
  // Green-dome style mosque with arches (Madinah feel)
  madinah: `
    <path d="M300 300c0-60 45-104 100-104s100 44 100 104z"/><rect x="396" y="160" width="8" height="40"/>
    <rect x="130" y="300" width="540" height="160"/>
    <path d="M160 460v-80a30 30 0 0 1 60 0v80zM250 460v-80a30 30 0 0 1 60 0v80zM340 460v-80a30 30 0 0 1 60 0v80zM430 460v-80a30 30 0 0 1 60 0v80zM520 460v-80a30 30 0 0 1 60 0v80z" fill-opacity=".45"/>
    <rect x="120" y="180" width="22" height="280"/><path d="M116 184h30l-15-36z"/>
    <rect x="658" y="180" width="22" height="280"/><path d="M654 184h30l-15-36z"/>`,
  // Hotel tower
  hotel: `
    <rect x="300" y="110" width="200" height="350"/><rect x="250" y="260" width="300" height="200"/>
    <g fill-opacity=".35">${Array.from({ length: 6 }, (_, r) => Array.from({ length: 4 }, (_, c) => `<rect x="${322 + c * 44}" y="${135 + r * 40}" width="22" height="22"/>`).join('')).join('')}</g>`,
  // Aircraft over clouds
  plane: `
    <path d="M150 360l420-150c30-11 56 2 56 20s-22 30-50 40L260 400l-50 60-36-8 30-62-54-20z"/>
    <path d="M350 310l-80-100 40-8 120 70z"/>
    <path d="M120 470c20-30 60-40 90-24 20-30 80-30 100 6 40-10 70 10 70 18z" fill-opacity=".45"/>`,
  // Desert dunes with palms (Taif / Ziyarat)
  desert: `
    <path d="M0 440c120-60 260-70 400-30s280 30 400-10v200H0z" fill-opacity=".55"/>
    <rect x="590" y="250" width="12" height="200" transform="rotate(6 596 350)"/>
    <path d="M598 250c-50-20-90-5-110 20 40-10 70-5 110-20zm0 0c40-30 90-30 120-5-40-5-80 0-120 5zm0 0c-20-40-60-55-95-50 35 10 65 25 95 50zm0 0c25-35 70-45 100-35-35 5-70 15-100 35z"/>
    <circle cx="200" cy="170" r="50" fill-opacity=".5"/>`,
}

function svg({ label, sub, palette = 'navy', scene = 'mosque' }) {
  const [a, b] = PALETTES[palette] || PALETTES.navy
  const esc = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
  <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient></defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <circle cx="660" cy="110" r="140" fill="#fff" fill-opacity=".06"/><circle cx="90" cy="520" r="180" fill="#fff" fill-opacity=".05"/>
  <g fill="#fff" fill-opacity=".22">${SCENES[scene] || SCENES.mosque}</g>
  <rect y="460" width="800" height="140" fill="#fff" fill-opacity=".08"/>
  <rect width="800" height="600" fill="url(#f)"/>
  ${label ? `<text x="40" y="${sub ? 530 : 555}" font-family="Poppins,Arial,sans-serif" font-size="46" font-weight="600" fill="#fff">${esc(label)}</text>` : ''}
  ${sub ? `<text x="40" y="568" font-family="Poppins,Arial,sans-serif" font-size="24" fill="#fff" fill-opacity=".8">${esc(sub)}</text>` : ''}
</svg>`
}

export function artTile(opts) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg(opts))}`
}

// Pick a fitting scene/palette from a destination or package name.
export function destinationTile(name = '', withLabel = false) {
  const n = name.toLowerCase()
  const pick =
    n.includes('hajj') ? { scene: 'kaaba', palette: 'night' } :
    n.includes('madinah') || n.includes('medina') ? { scene: 'madinah', palette: 'teal' } :
    n.includes('ramadan') ? { scene: 'mosque', palette: 'dusk' } :
    n.includes('taif') || n.includes('ziyarat') ? { scene: 'desert', palette: 'sand' } :
    n.includes('dubai') ? { scene: 'hotel', palette: 'grey' } :
    n.includes('aqsa') || n.includes('jerusalem') ? { scene: 'mosque', palette: 'sand' } :
    n.includes('turkey') || n.includes('istanbul') ? { scene: 'mosque', palette: 'red' } :
    n.includes('premium') ? { scene: 'kaaba', palette: 'dusk' } :
    { scene: 'kaaba', palette: 'navy' }
  return artTile({ ...pick, label: withLabel ? name : '' })
}
