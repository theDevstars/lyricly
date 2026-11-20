import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="58%" cy="44%" r="62%">
      <stop offset="0" stop-color="#FF5C8A" stop-opacity=".38"/>
      <stop offset="55%" stop-color="#FF5C8A" stop-opacity=".1"/>
      <stop offset="100%" stop-color="#FF5C8A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="teal" cx="97%" cy="88%" r="42%">
      <stop offset="0" stop-color="#3FD6C8" stop-opacity=".3"/>
      <stop offset="100%" stop-color="#3FD6C8" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#FF5C8A"/>
      <stop offset="1" stop-color="#FFB38A"/>
    </linearGradient>
    <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#141416"/>
      <stop offset="1" stop-color="#08080A"/>
    </linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#FF5C8A"/>
      <stop offset=".55" stop-color="#FF9A6A"/>
      <stop offset="1" stop-color="#3FD6C8"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="26"/></filter>
  </defs>
  <rect width="1200" height="630" fill="#050506"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect width="1200" height="630" fill="url(#teal)"/>
  <g fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="1.2">
    <path d="M-40 620C220 560 360 430 620 430s360 90 640 30"/>
    <path d="M-40 660C230 596 380 462 634 462s366 94 660 30"/>
    <path d="M-40 700C240 630 400 494 648 494s372 98 676 30"/>
    <path d="M-40 740C250 664 420 526 662 526s378 102 692 30"/>
    <path d="M-40 780C260 698 440 558 676 558s384 106 708 30"/>
  </g>

  <g transform="translate(72 64)">
    <rect width="42" height="42" rx="11" fill="#0B0B0C" stroke="#ffffff" stroke-opacity=".16"/>
    <rect x="10.5" y="19" width="4.2" height="10" rx="2.1" fill="url(#mark)"/>
    <rect x="18.9" y="12" width="4.2" height="17" rx="2.1" fill="url(#mark)"/>
    <rect x="27.3" y="16" width="4.2" height="13" rx="2.1" fill="url(#mark)"/>
    <text x="58" y="30" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="-1.2" fill="#ffffff">Lyrica</text>
  </g>

  <text x="72" y="242" font-family="Segoe UI, Arial, sans-serif" font-size="72" font-weight="800" letter-spacing="-3.4" fill="#ffffff">Watch every style</text>
  <text x="72" y="318" font-family="Segoe UI, Arial, sans-serif" font-size="72" font-weight="800" letter-spacing="-3.4" fill="#ffffff">before you pick.</text>
  <text x="72" y="376" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#8A8A93">Time-synced lyrics for Windows. Spotify, Apple Music, Cider.</text>

  <g transform="translate(72 438)">
    <rect width="238" height="40" rx="20" fill="#FF5C8A" fill-opacity=".12" stroke="#FF5C8A" stroke-opacity=".32"/>
    <circle cx="26" cy="20" r="4" fill="#FF5C8A"/>
    <text x="41" y="26" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="600" fill="#FF8AA9">New in 2.0 — Rim Light</text>
  </g>

  <g transform="translate(742 148) rotate(-3)">
    <rect x="-18" y="-18" width="428" height="300" rx="40" fill="#FF5C8A" opacity=".2" filter="url(#blur)"/>
    <rect width="392" height="264" rx="26" fill="#000" stroke="#ffffff" stroke-opacity=".12"/>
    <rect x="10" y="10" width="372" height="244" rx="18" fill="url(#screen)"/>
    <circle cx="28" cy="26" r="4" fill="#3A3A40"/>
    <circle cx="42" cy="26" r="4" fill="#3A3A40"/>
    <text x="60" y="31" font-family="Segoe UI, Arial, sans-serif" font-size="11" fill="#8A8A93">Paper Satellites — Nova Vale</text>

    <text x="42" y="106" font-family="Segoe UI, Arial, sans-serif" font-size="29" font-weight="700" letter-spacing="-1.2" fill="#ffffff">We drove past the</text>
    <text x="42" y="144" font-family="Segoe UI, Arial, sans-serif" font-size="29" font-weight="700" letter-spacing="-1.2" fill="#FF5C8A">harbour</text>
    <text x="42" y="196" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" letter-spacing="-.6" fill="#ffffff" opacity=".4">with the windows down</text>
    <text x="42" y="232" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" letter-spacing="-.6" fill="#ffffff" opacity=".16">every light a promise</text>
    <rect x="32" y="10" width="4" height="244" rx="2" fill="url(#edge)" opacity=".7"/>
    <rect x="356" y="10" width="4" height="244" rx="2" fill="url(#edge)" opacity=".4"/>
  </g>

  <text x="72" y="566" font-family="Segoe UI, Arial, sans-serif" font-size="14" letter-spacing="1.6" fill="#8A8A93">LYRICA.APP</text>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile("public/og.png");
console.log("wrote public/og.png");
