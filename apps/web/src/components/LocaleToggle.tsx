import { setLocale, useLocale, useT } from '~/lib/i18n'

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
      className="flex h-9 items-center gap-1 rounded-md px-2 text-[13px] font-medium text-ink-3 transition-colors hover:bg-surface-sunken"
    >
      <span className={locale === 'de' ? 'text-ink' : undefined}>DE</span>
      <span aria-hidden="true">/</span>
      <span className={locale === 'en' ? 'text-ink' : undefined}>EN</span>
    </button>
  )
}
