import { Moon, Sun } from 'lucide-react'
import { setLocale, useLocale, useT } from '~/lib/i18n'
import { setTheme, useTheme } from '~/lib/theme'

const control =
  'flex h-8 items-center justify-center rounded-sm text-ink-2 transition-colors duration-150 hover:bg-surface-sunken hover:text-ink'

/** Paper or blueprint. */
export function ThemeToggle() {
  const theme = useTheme()
  const t = useT()
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = t(next === 'light' ? 'theme.toLight' : 'theme.toDark')

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={`${control} w-8`}
    >
      {/* Both icons render; CSS shows the one for the active theme, so the
          server-rendered markup is right before React hydrates. */}
      <Moon size={16} strokeWidth={1.75} className="dark:hidden" aria-hidden />
      <Sun
        size={16}
        strokeWidth={1.75}
        className="hidden dark:block"
        aria-hidden
      />
    </button>
  )
}

export function LocaleToggle() {
  const locale = useLocale()
  const t = useT()
  const next = locale === 'de' ? 'en' : 'de'

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      aria-label={t('locale.switch')}
      title={t('locale.switch')}
      className={`${control} label gap-1 px-1.5 !text-[0.8rem] sm:px-2`}
    >
      <span className={locale === 'de' ? 'text-ink' : undefined}>DE</span>
      <span aria-hidden="true" className="text-line-strong">
        /
      </span>
      <span className={locale === 'en' ? 'text-ink' : undefined}>EN</span>
    </button>
  )
}
