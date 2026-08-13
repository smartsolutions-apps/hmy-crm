import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Info, Sparkles } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Badge, Card, Field, Select } from '@/components/ui'
import {
  AUDIENCES, audienceId, audienceLabelKey, bracketLabelKey, bracketRange,
  bracketsFor, findGifts, seasonLabelKey, sillageLabelKey, wearLabelKey,
} from '@/lib/segments'
import type {
  AgeBracketId, GiftEvent, GiftRecommendation, Product, WearOccasion,
} from '@/types'

/**
 * The demo piece: three questions in, a rich grouped answer out. Designed to be
 * shown on a screen to a room, so the result is deliberately never a single
 * bottle.
 */
export default function GiftFinder({
  events,
  recommendations,
  products,
}: {
  events: GiftEvent[]
  recommendations: GiftRecommendation[]
  products: Product[]
}) {
  const { t, lang, money, num } = useI18n()

  const activeEvents = useMemo(() => events.filter((e) => e.active), [events])
  const [eventId, setEventId] = useState(
    () => activeEvents.find((e) => e.code === 'ANNIVERSARY')?.id ?? activeEvents[0]?.id ?? ''
  )
  const [audId, setAudId] = useState('adult-female')
  const [bracket, setBracket] = useState<AgeBracketId>('a30_39')
  const [wearFilter, setWearFilter] = useState<WearOccasion | 'all'>('all')

  const audience = AUDIENCES.find((a) => audienceId(a) === audId) ?? AUDIENCES[0]
  const event = activeEvents.find((e) => e.id === eventId)
  const brackets = bracketsFor(audience.lifeStage)

  // Switching between adults and children invalidates the chosen age.
  const effectiveBracket = brackets.some((b) => b.id === bracket) ? bracket : brackets[0]?.id

  const result = useMemo(
    () =>
      event
        ? findGifts(event.id, audience, effectiveBracket, recommendations, products, 4)
        : { items: [], groups: [], toppedUp: false },
    [event, audience, effectiveBracket, recommendations, products]
  )

  const visibleGroups =
    wearFilter === 'all' ? result.groups : result.groups.filter((g) => g.wear === wearFilter)

  const name = (p: Product) => (lang === 'ar' ? p.nameAr : p.nameEn)
  const eventName = (e: GiftEvent) => (lang === 'ar' ? e.nameAr : e.nameEn)

  return (
    <Card
      title={t('find.title')}
      subtitle={t('find.subtitle')}
      className="mb-4"
    >
      {/* ---- the three questions ---- */}
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <Field label={t('find.occasion')}>
          <Select
            value={eventId}
            onChange={setEventId}
            options={activeEvents.map((e) => ({ value: e.id, label: eventName(e) }))}
          />
        </Field>
        <Field label={t('find.who')}>
          <Select
            value={audId}
            onChange={(v) => {
              setAudId(v)
              const a = AUDIENCES.find((x) => audienceId(x) === v)
              if (a) {
                const list = bracketsFor(a.lifeStage)
                if (!list.some((b) => b.id === bracket)) setBracket(list[0].id)
              }
            }}
            options={AUDIENCES.map((a) => ({
              value: audienceId(a),
              label: `${t(audienceLabelKey(a))} — ${t(`seg.life.${a.lifeStage}` as never)}`,
            }))}
          />
        </Field>
        <Field label={t('find.age')}>
          <Select
            value={effectiveBracket ?? ''}
            onChange={(v) => setBracket(v as AgeBracketId)}
            options={brackets.map((b) => ({
              value: b.id,
              label: `${t(bracketLabelKey(b.id))} (${bracketRange(b)})`,
            }))}
          />
        </Field>
      </div>

      {/* ---- headline ---- */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-gold-500" />
        <p className="text-sm font-medium text-ink-900">
          {t('find.results', { n: result.items.length })}
        </p>
        {result.items.length > 0 && (
          <span className="text-xs text-ink-400">· {t('find.groupedBy')}</span>
        )}
      </div>

      {result.toppedUp && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mb-3 text-xs text-amber-800">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>{t('find.toppedUp')}</p>
        </div>
      )}

      {/* ---- wear-context filter ---- */}
      {result.groups.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setWearFilter('all')}
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
              wearFilter === 'all'
                ? 'bg-ink-900 text-white border-ink-900'
                : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'
            )}
          >
            {t('find.allWear')}
          </button>
          {result.groups.map((g) => (
            <button
              key={g.wear}
              onClick={() => setWearFilter(g.wear)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                wearFilter === g.wear
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'
              )}
            >
              {t(wearLabelKey(g.wear))}
              <span className="ms-1.5 opacity-60 tnum">{g.items.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* ---- results ---- */}
      {result.items.length === 0 ? (
        <p className="text-sm text-ink-500 py-6 text-center">{t('find.empty')}</p>
      ) : (
        <div className="space-y-5">
          {visibleGroups.map((g) => (
            <div key={g.wear}>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-sm font-semibold text-ink-900">{t(wearLabelKey(g.wear))}</h4>
                <span className="text-xs text-ink-400 tnum">{num(g.items.length)}</span>
                <div className="flex-1 h-px bg-ink-100" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.items.map((item) => (
                  <article
                    key={item.product.id}
                    className={clsx(
                      'rounded-xl border p-3.5 bg-white transition-shadow hover:shadow-card',
                      item.isHero ? 'border-gold-300 ring-1 ring-gold-100' : 'border-ink-200'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex flex-wrap gap-1">
                        {item.isHero && <Badge tone="gold">{t('ev.hero')}</Badge>}
                        <Badge tone={item.source === 'recommended' ? 'green' : 'neutral'}>
                          {item.source === 'recommended'
                            ? t('find.recommended')
                            : t('find.suggested')}
                        </Badge>
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-ink-900">{name(item.product)}</p>
                    <p className="text-[11px] text-ink-400 tnum mb-2">
                      {item.product.sku} · {item.product.concentration} {item.product.sizeMl} ml
                    </p>

                    <div className="flex flex-wrap gap-1 mb-2">
                      <Badge tone="blue">
                        {t(`products.family.${item.product.family}` as never)}
                      </Badge>
                      <Badge>{t(seasonLabelKey(item.product.season))}</Badge>
                      <Badge tone={item.product.sillage === 'strong' ? 'purple' : 'neutral'}>
                        {t(sillageLabelKey(item.product.sillage))}
                      </Badge>
                    </div>

                    <p className="text-base font-semibold tnum text-ink-900">
                      {money(item.product.price, 0)}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
