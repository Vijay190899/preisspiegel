import { createFileRoute } from '@tanstack/react-router'
import { useT } from '~/lib/i18n'

export const Route = createFileRoute('/positionen/')({
  component: PickPosition,
})

function PickPosition() {
  const t = useT()
  return (
    <div className="hidden h-full place-items-center p-8 text-center lg:grid">
      <div className="max-w-[34ch]">
        <h1 className="text-[1.2rem] font-semibold">{t('list.pick.title')}</h1>
        <p className="mt-2 text-[0.93rem] leading-relaxed text-ink-3">
          {t('list.pick.body')}
        </p>
      </div>
    </div>
  )
}
