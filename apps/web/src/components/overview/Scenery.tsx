import type { CSSProperties } from 'react'

/** A number between 0 and 1 that is the same for the same input, every time. */
function spread(index: number, salt: number): number {
  let mixed = (index + 1) * 2654435761 + salt * 40503
  mixed = Math.imul(mixed ^ (mixed >>> 15), 2246822519)
  mixed = Math.imul(mixed ^ (mixed >>> 13), 3266489917)
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967296
}

// The stars stand in the strip of sky above what is written, and down the
// two edges of the page beside it. None is behind a word.
const STARS = Array.from({ length: 120 }, (_, index) => {
  const edge = index % 4 === 0
  const side = spread(index, 6) < 0.5 ? 0 : 1
  return {
    x: edge ? side * 1548 + spread(index, 1) * 52 : spread(index, 1) * 1600,
    y: edge ? 60 + spread(index, 2) * 430 : 3 + spread(index, 2) ** 2 * 40,
    r: 0.45 + spread(index, 3) * 0.75,
    twinkle: index % 7 === 0,
    period: 3.5 + spread(index, 4) * 4,
    at: spread(index, 5) * 5,
  }
})

const CLOUDS: ReadonlyArray<{
  x: number
  y: number
  scale: number
  period: number
}> = [
  { x: 96, y: 26, scale: 0.75, period: 150 },
  { x: 800, y: 22, scale: 0.6, period: 110 },
  { x: 1560, y: 420, scale: 0.9, period: 180 },
]

/**
 * What is in the sky behind the overview: stars and a moon by night, clouds
 * and a sun by day. Which of them show is decided by the theme's colours, so
 * the markup is the same for both and nothing waits for a script.
 */
export function Scenery() {
  return (
    <div className="scene-back" aria-hidden="true">
      <svg
        viewBox="0 0 1600 600"
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-x-0 top-0 h-[600px] w-full"
      >
        {STARS.map((star, index) => (
          <circle
            key={index}
            cx={Math.round(star.x * 10) / 10}
            cy={Math.round(star.y * 10) / 10}
            r={Math.round(star.r * 100) / 100}
            className="star"
            data-twinkle={star.twinkle ? '' : undefined}
            style={
              star.twinkle
                ? ({
                    '--period': `${star.period.toFixed(1)}s`,
                    '--at': `${star.at.toFixed(1)}s`,
                  } as CSSProperties)
                : undefined
            }
          />
        ))}
        {CLOUDS.map((cloud) => (
          <g
            key={cloud.x}
            className="cloud"
            style={{ '--period': `${cloud.period}s` } as CSSProperties}
          >
            <g
              transform={`translate(${cloud.x} ${cloud.y}) scale(${cloud.scale})`}
            >
              <ellipse cx="0" cy="0" rx="92" ry="13" />
              <ellipse cx="-34" cy="-9" rx="44" ry="13" />
              <ellipse cx="26" cy="-13" rx="54" ry="17" />
              <ellipse cx="78" cy="-5" rx="36" ry="10" />
            </g>
          </g>
        ))}
      </svg>
      <span className="orb" />
    </div>
  )
}
