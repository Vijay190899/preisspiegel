import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@preisspiegel/backend/api'
import { useT } from '~/lib/i18n'
import type { Translate } from '~/lib/i18n'

const healthQuery = convexQuery(api.health.get, {})

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(healthQuery),
  component: Home,
})

function Home() {
  const t = useT()

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-border bg-surface p-6 shadow-card sm:p-8">
        <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">
          {t('home.eyebrow')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {t('home.empty.title')}
        </h1>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
          {t('home.empty.body')}
        </p>
      </section>

      <SystemStatus t={t} />
    </div>
  )
}

const ROLES = ['match', 'escalation', 'investigator'] as const

function SystemStatus({ t }: { t: Translate }) {
  const { data: health } = useSuspenseQuery(healthQuery)

  return (
    <aside className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <h2 className="text-[13px] font-semibold">{t('status.title')}</h2>

      <dl className="mt-4 space-y-3 text-[13px]">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-2">{t('status.backend')}</dt>
          <dd className="flex items-center gap-2 font-medium text-auto">
            <span className="size-2 rounded-full bg-auto" aria-hidden="true" />
            {t('status.connected')}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-2">{t('status.provider')}</dt>
          <dd className="num">{health.provider}</dd>
        </div>
      </dl>

      <h3 className="mt-5 border-t border-border pt-4 text-[13px] font-semibold">
        {t('status.models')}
      </h3>
      <dl className="mt-3 space-y-2 text-[13px]">
        {ROLES.map((role) => {
          const model = health.models[role]
          return (
            <div key={role} className="flex items-center justify-between gap-4">
              <dt className="text-ink-2">{t(`status.role.${role}`)}</dt>
              <dd className={model === null ? 'num text-ink-3' : 'num'}>
                {model ?? t('status.off')}
              </dd>
            </div>
          )
        })}
      </dl>
      <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
        {t('status.modelsHint')}
      </p>
    </aside>
  )
}
