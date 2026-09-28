// Shera Travels logo mark — green globe with a swoosh and a plane.
export default function BrandMark({ className, size = 38 }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="bm-g" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1DBF6E" />
          <stop offset="1" stopColor="#0C8A4B" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="18" fill="url(#bm-g)" />
      <path d="M6.5 25.5C12 30 23 30.5 31.5 20" stroke="#fff" strokeOpacity=".55" strokeWidth="2.2" strokeLinecap="round" />
      <g transform="translate(9.2 7.8) scale(0.92)">
        <path
          d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
          fill="#fff"
        />
      </g>
    </svg>
  )
}
