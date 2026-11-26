import { useT } from '~/lib/i18n'

/**
 * The opening (`lib/intro.ts`). Three bars rise, as three suppliers' prices
 * come in; the middle one, the price the bid is made with, takes the light;
 * a waterline draws under them and the bars find their reflection in it, the
 * mirror in the name. Then the name settles and the whole lifts away.
 * Decoration only: hidden from assistive technology and never in the way of
 * a click.
 */
export function Intro() {
  const t = useT()
  return (
    <div className="intro" aria-hidden="true">
      <div className="intro-stage">
        <svg
          className="intro-mark"
          viewBox="0 0 44 72"
          width="116"
          height="190"
        >
          <defs>
            <linearGradient id="intro-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id="intro-reflect">
              <rect
                x="0"
                y="38"
                width="44"
                height="34"
                fill="url(#intro-fade)"
              />
            </mask>
          </defs>
          <g className="intro-bars">
            <rect
              className="intro-bar intro-bar-1"
              x="4"
              y="14"
              width="9"
              height="22"
              rx="2.5"
            />
            <rect
              className="intro-bar intro-bar-2 intro-bar-chosen"
              x="17.5"
              y="21"
              width="9"
              height="15"
              rx="2.5"
            />
            <rect
              className="intro-bar intro-bar-3"
              x="31"
              y="4"
              width="9"
              height="32"
              rx="2.5"
            />
          </g>
          <line className="intro-water" x1="0" y1="37" x2="44" y2="37" />
          <g mask="url(#intro-reflect)">
            <g className="intro-reflection" transform="matrix(1 0 0 -1 0 74)">
              <rect
                className="intro-bar"
                x="4"
                y="14"
                width="9"
                height="22"
                rx="2.5"
              />
              <rect
                className="intro-bar intro-bar-chosen"
                x="17.5"
                y="21"
                width="9"
                height="15"
                rx="2.5"
              />
              <rect
                className="intro-bar"
                x="31"
                y="4"
                width="9"
                height="32"
                rx="2.5"
              />
            </g>
          </g>
        </svg>
        <p className="intro-word">Preisspiegel</p>
        <p className="intro-line">{t('intro.line')}</p>
      </div>
    </div>
  )
}
