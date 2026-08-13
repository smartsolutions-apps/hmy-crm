import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { CalendarHeart, Download, Eye, Gift, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import {
  Badge, Card, DataTable, Field, Modal, PageHeader, SearchInput,
  Select, StatCard, exportCsv, statusTone,
} from '@/components/ui'
import ProductPicker from '@/components/ProductPicker'
import GiftFinder from '@/components/GiftFinder'
import {
  AGE_BRACKETS, AUDIENCES, audienceId, audienceLabelKey, audienceMatches,
  bracketById, bracketLabelKey, bracketRange, bracketsFor, buildCoverage,
  buildWebsiteFeed, coverageStats, sameAudience, suggestionsFor,
} from '@/lib/segments'
import type {
  AgeBracketId, AudienceKey, EventCategory, GiftEvent, GiftRecommendation,
} from '@/types'

const CATEGORIES: EventCategory[] = ['personal', 'religious', 'national', 'seasonal', 'corporate']

const MONTHS = ['—', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function Events() {
  const { t, lang, num, percent, money } = useI18n()
  const { db, save, remove } = useData()

  const [tab, setTab] = useState<'occasions' | 'rules'>('occasions')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [editingRule, setEditingRule] = useState<GiftRecommendation | null>(null)
  const [editingEvent, setEditingEvent] = useState<GiftEvent | null>(null)
  const [preview, setPreview] = useState<{ event: GiftEvent; audience: AudienceKey } | null>(null)

  const events = db.giftEvents ?? []
  const recs = db.giftRecommendations ?? []
  const sellableProducts = useMemo(
    () => db.products.filter((p) => p.status !== 'discontinued'),
    [db.products]
  )

  const eventName = (e: GiftEvent) => (lang === 'ar' ? e.nameAr : e.nameEn)
  const productName = (id: string) => {
    const p = db.products.find((x) => x.id === id)
    return p ? (lang === 'ar' ? p.nameAr : p.nameEn) : id
  }

  const coverage = useMemo(() => buildCoverage(events, recs), [events, recs])
  const stats = useMemo(() => coverageStats(coverage), [coverage])
  const mappedProducts = useMemo(
    () => new Set(recs.filter((r) => r.active).flatMap((r) => r.productIds)).size,
    [recs]
  )

  const filteredEvents = useMemo(
    () =>
      events.filter((e) => {
        const q = search.trim().toLowerCase()
        const matchQ = !q || e.nameEn.toLowerCase().includes(q) || e.nameAr.includes(search.trim())
        return matchQ && (category === 'all' || e.category === category)
      }),
    [events, search, category]
  )

  const cellFor = (eventId: string, audience: AudienceKey) =>
    coverage.find((c) => c.event.id === eventId && sameAudience(c.audience, audience))

  const blankRule = (eventId: string, audience: AudienceKey): GiftRecommendation => ({
    id: `rec-${Date.now()}`,
    eventId,
    lifeStage: audience.lifeStage,
    gender: audience.gender,
    ageBrackets: [],
    productIds: [],
    priority: 1,
    active: true,
  })

  const blankEvent = (): GiftEvent => ({
    id: `evt-${Date.now()}`,
    code: '',
    nameEn: '',
    nameAr: '',
    category: 'personal',
    month: null,
    day: null,
    movableDate: false,
    suggestedAudiences: [],
    active: true,
  })

  const openCell = (eventId: string, audience: AudienceKey) => {
    const existing = recs.find(
      (r) => r.eventId === eventId && audienceMatches(r, audience) && r.active
    )
    setEditingRule(existing ?? blankRule(eventId, audience))
  }

  const whenLabel = (e: GiftEvent) => {
    if (e.movableDate) return t('ev.movableShort')
    if (e.month === null) return t('ev.noDate')
    return e.day ? `${e.day} ${MONTHS[e.month]}` : MONTHS[e.month]
  }

  const downloadFeed = () => {
    const feed = buildWebsiteFeed(events, recs, db.products)
    const blob = new Blob([JSON.stringify({ currency: 'AED', occasions: feed }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gift-occasions-feed.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <PageHeader
        title={t('ev.title')}
        subtitle={t('ev.subtitle')}
        actions={
          <>
            <button className="btn-ghost" onClick={downloadFeed} title="JSON the website can read">
              <Download className="h-4 w-4" />
              {t('ev.exportFeed')}
            </button>
            <button className="btn-ghost" onClick={() => setEditingEvent(blankEvent())}>
              <Plus className="h-4 w-4" />
              {t('ev.newEvent')}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard
          label={t('ev.activeEvents')}
          value={num(events.filter((e) => e.active).length)}
          icon={<CalendarHeart className="h-4 w-4" />}
        />
        <StatCard label={t('ev.rules')} value={num(recs.filter((r) => r.active).length)} />
        <StatCard
          label={t('ev.mapped')}
          value={`${num(mappedProducts)} / ${num(sellableProducts.length)}`}
          icon={<Gift className="h-4 w-4" />}
        />
        <StatCard
          label={t('ev.coverage')}
          value={percent(stats.pct, 0)}
          hint={`${num(stats.gaps)} ${t('ev.gapsLabel').toLowerCase()}`}
          tone={stats.gaps === 0 ? 'good' : stats.pct >= 70 ? 'warn' : 'bad'}
        />
      </div>

      <GiftFinder events={events} recommendations={recs} products={db.products} />

      {/* ---- the pyramid, as a grid ---- */}
      <Card title={t('ev.matrix')} subtitle={t('ev.matrixHint')} className="mb-4" bodyClassName="pt-0 pb-0">
        {/* phone: one card per occasion, four tappable squares inside */}
        <ul className="sm:hidden space-y-2.5 py-4">
          {filteredEvents.map((e) => (
            <li key={e.id} className="rounded-xl border border-ink-200 bg-white p-3">
              <button className="text-start w-full mb-2.5" onClick={() => setEditingEvent(e)}>
                <span className="font-medium text-ink-900 block">{eventName(e)}</span>
                <span className="text-[11px] text-ink-400">
                  {t(`ev.cat.${e.category}` as never)} · {whenLabel(e)}
                </span>
              </button>
              <div className="grid grid-cols-4 gap-1.5">
                {AUDIENCES.map((a) => {
                  const cell = cellFor(e.id, a)
                  const suggested = e.suggestedAudiences.some((s) => sameAudience(s, a))
                  const count = cell?.productCount ?? 0
                  return (
                    <button
                      key={audienceId(a)}
                      onClick={() => openCell(e.id, a)}
                      className={clsx(
                        'rounded-lg px-1 py-2 text-[11px] font-medium leading-tight',
                        count > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : suggested
                            ? 'bg-amber-50 text-amber-700 border border-dashed border-amber-300'
                            : 'bg-ink-50 text-ink-400'
                      )}
                    >
                      <span className="block truncate">{t(audienceLabelKey(a))}</span>
                      <span className="block tnum text-[13px] font-semibold">
                        {count > 0 ? count : suggested ? '!' : '+'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden sm:block overflow-x-auto -mx-4 sm:-mx-5">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th className="th sticky start-0 bg-ink-50/70">{t('ev.occasion')}</th>
                <th className="th text-center">{t('ev.when')}</th>
                {AUDIENCES.map((a) => (
                  <th key={audienceId(a)} className="th text-center">
                    {t(audienceLabelKey(a))}
                    <span className="block text-[9px] font-normal normal-case text-ink-400">
                      {t(`seg.life.${a.lifeStage}` as never)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((e) => (
                <tr key={e.id} className="hover:bg-gold-50/30">
                  <td className="td sticky start-0 bg-white">
                    <button
                      className="text-start"
                      onClick={() => setEditingEvent(e)}
                    >
                      <span className="font-medium text-ink-900 block">{eventName(e)}</span>
                      <span className="text-[11px] text-ink-400">
                        {t(`ev.cat.${e.category}` as never)}
                      </span>
                    </button>
                  </td>
                  <td className="td text-center text-xs text-ink-500 tnum whitespace-nowrap">
                    {whenLabel(e)}
                  </td>
                  {AUDIENCES.map((a) => {
                    const cell = cellFor(e.id, a)
                    const suggested = e.suggestedAudiences.some((s) => sameAudience(s, a))
                    const count = cell?.productCount ?? 0
                    return (
                      <td key={audienceId(a)} className="td text-center">
                        <button
                          onClick={() => openCell(e.id, a)}
                          title={
                            count
                              ? t('ev.bracketsCovered', {
                                  a: cell?.bracketsCovered ?? 0,
                                  b: cell?.bracketsTotal ?? 0,
                                })
                              : t('ev.noProducts')
                          }
                          className={clsx(
                            'w-full min-w-[68px] rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                            count > 0
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : suggested
                                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-dashed border-amber-300'
                                : 'text-ink-300 hover:bg-ink-50'
                          )}
                        >
                          {count > 0 ? (
                            <>
                              <span className="tnum">{count}</span>
                              <span className="block text-[9px] font-normal opacity-70 tnum">
                                {cell?.bracketsCovered}/{cell?.bracketsTotal}
                              </span>
                            </>
                          ) : suggested ? (
                            <span className="inline-flex items-center gap-1">
                              <TriangleAlert className="h-3 w-3" />
                              {t('ev.gap')}
                            </span>
                          ) : (
                            '+'
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card bodyClassName="pt-0 pb-0">
        <div className="flex flex-wrap items-center gap-2 py-4 no-print">
          <div className="flex rounded-lg border border-ink-200 overflow-hidden">
            {([['occasions', t('ev.occasions')], ['rules', t('ev.rules')]] as const).map(
              ([key, label]) => (
                <button
                  key={key}
                  className={`px-3.5 py-2 text-sm font-medium ${
                    tab === key ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 hover:bg-ink-50'
                  }`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              )
            )}
          </div>
          <div className="min-w-[180px] flex-1">
            <SearchInput value={search} onChange={setSearch} />
          </div>
          <Select
            className="w-full sm:w-auto"
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: t('common.all') + ' — ' + t('common.category') },
              ...CATEGORIES.map((c) => ({ value: c, label: t(`ev.cat.${c}` as never) })),
            ]}
          />
          <button
            className="btn-ghost"
            onClick={() =>
              exportCsv(
                'gift-recommendations.csv',
                recs.map((r) => {
                  const e = events.find((x) => x.id === r.eventId)
                  return {
                    occasion: e?.nameEn ?? r.eventId,
                    category: e?.category ?? '',
                    life_stage: r.lifeStage,
                    gender: r.gender,
                    age_brackets: r.ageBrackets
                      .map((b) => {
                        const br = bracketById(b)
                        return br ? bracketRange(br) : b
                      })
                      .join(' | '),
                    perfumes: r.productIds.map((p) => productName(p)).join(' | '),
                    hero: r.productIds[0] ? productName(r.productIds[0]) : '',
                    priority: r.priority,
                    active: r.active ? 'yes' : 'no',
                    note: r.note ?? '',
                  }
                })
              )
            }
          >
            <Download className="h-4 w-4" />
            {t('common.export')}
          </button>
        </div>

        {tab === 'occasions' ? (
          <DataTable
            rows={filteredEvents}
            onRowClick={(e) => setEditingEvent(e)}
            initialSort={{ key: 'name', dir: 'asc' }}
            emptyMessage={t('common.noResults')}
            columns={[
              {
                key: 'name',
                header: t('ev.occasion'),
                sortValue: (e) => e.nameEn,
                render: (e) => (
                  <div>
                    <p className="font-medium text-ink-900">{eventName(e)}</p>
                    <p className="text-xs text-ink-400 tnum">{e.code}</p>
                  </div>
                ),
              },
              {
                key: 'cat',
                header: t('common.category'),
                sortValue: (e) => e.category,
                render: (e) => <Badge tone="gold">{t(`ev.cat.${e.category}` as never)}</Badge>,
              },
              {
                key: 'when',
                header: t('ev.when'),
                sortValue: (e) => (e.month ?? 99) * 100 + (e.day ?? 0),
                render: (e) => (
                  <span className="text-ink-600 text-xs tnum">
                    {whenLabel(e)}
                    {e.movableDate && (
                      <span className="ms-1 text-ink-400">({t('ev.movable')})</span>
                    )}
                  </span>
                ),
              },
              {
                key: 'aud',
                header: t('ev.suggested'),
                render: (e) => (
                  <div className="flex flex-wrap gap-1">
                    {e.suggestedAudiences.map((a) => (
                      <Badge key={audienceId(a)}>{t(audienceLabelKey(a))}</Badge>
                    ))}
                  </div>
                ),
              },
              {
                key: 'rules',
                header: t('ev.rules'),
                align: 'end',
                sortValue: (e) => recs.filter((r) => r.eventId === e.id && r.active).length,
                render: (e) => {
                  const n = recs.filter((r) => r.eventId === e.id && r.active).length
                  return <span className={n ? 'tnum' : 'text-ink-300'}>{n || '—'}</span>
                },
              },
              {
                key: 'preview',
                header: '',
                align: 'end',
                render: (e) => {
                  const first =
                    e.suggestedAudiences[0] ??
                    AUDIENCES.find((a) =>
                      recs.some((r) => r.eventId === e.id && audienceMatches(r, a))
                    )
                  return first ? (
                    <button
                      className="btn-ghost !px-2 !py-1 text-xs"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        setPreview({ event: e, audience: first })
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {t('ev.preview')}
                    </button>
                  ) : null
                },
              },
              {
                key: 'status',
                header: t('common.status'),
                render: (e) => (
                  <Badge tone={e.active ? 'green' : 'neutral'}>
                    {e.active ? t('common.active') : t('products.status.draft')}
                  </Badge>
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            rows={recs.filter((r) => {
              const e = events.find((x) => x.id === r.eventId)
              if (!e) return false
              const q = search.trim().toLowerCase()
              const matchQ = !q || e.nameEn.toLowerCase().includes(q) || e.nameAr.includes(search.trim())
              return matchQ && (category === 'all' || e.category === category)
            })}
            onRowClick={(r) => setEditingRule(r)}
            emptyMessage={t('ev.noRules')}
            columns={[
              {
                key: 'event',
                header: t('ev.occasion'),
                sortValue: (r) => events.find((e) => e.id === r.eventId)?.nameEn ?? '',
                render: (r) => {
                  const e = events.find((x) => x.id === r.eventId)
                  return <span className="font-medium text-ink-900">{e ? eventName(e) : '—'}</span>
                },
              },
              {
                key: 'aud',
                header: t('ev.forWhom'),
                sortValue: (r) => `${r.lifeStage}-${r.gender}`,
                render: (r) => (
                  <Badge tone={r.lifeStage === 'kid' ? 'purple' : 'blue'}>
                    {t(audienceLabelKey({ lifeStage: r.lifeStage, gender: r.gender }))}
                  </Badge>
                ),
              },
              {
                key: 'ages',
                header: t('ev.ageBrackets'),
                render: (r) => (
                  <div className="flex flex-wrap gap-1">
                    {r.ageBrackets.map((b) => {
                      const br = bracketById(b)
                      return (
                        <span
                          key={b}
                          className="chip bg-ink-100 text-ink-700 tnum"
                          title={t(bracketLabelKey(b))}
                        >
                          {br ? bracketRange(br) : b}
                        </span>
                      )
                    })}
                  </div>
                ),
              },
              {
                key: 'products',
                header: t('ev.perfumes'),
                render: (r) => (
                  <div className="flex flex-wrap gap-1">
                    {r.productIds.map((p, i) => (
                      <span
                        key={p}
                        className={clsx(
                          'chip',
                          i === 0 ? 'bg-gold-100 text-gold-800' : 'bg-ink-100 text-ink-700'
                        )}
                      >
                        {productName(p)}
                      </span>
                    ))}
                  </div>
                ),
              },
              {
                key: 'priority',
                header: t('ev.priority'),
                align: 'end',
                sortValue: (r) => r.priority,
                render: (r) => <span className="tnum text-ink-500">{r.priority}</span>,
              },
              {
                key: 'status',
                header: t('common.status'),
                render: (r) => (
                  <Badge tone={statusTone(r.active ? 'active' : 'draft')}>
                    {r.active ? t('common.active') : t('products.status.draft')}
                  </Badge>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* ---------------- recommendation editor ---------------- */}
      <Modal
        open={!!editingRule}
        onClose={() => setEditingRule(null)}
        title={t('ev.newRule')}
        wide
        footer={
          <>
            {editingRule && recs.some((r) => r.id === editingRule.id) && (
              <button
                className="btn-danger me-auto"
                onClick={async () => {
                  await remove('giftRecommendations', editingRule.id)
                  setEditingRule(null)
                }}
              >
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </button>
            )}
            <button className="btn-ghost" onClick={() => setEditingRule(null)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-gold"
              disabled={!editingRule?.productIds.length || !editingRule?.ageBrackets.length}
              onClick={async () => {
                if (!editingRule) return
                await save('giftRecommendations', editingRule)
                setEditingRule(null)
              }}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        {editingRule && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label={t('ev.occasion')}>
                <Select
                  value={editingRule.eventId}
                  onChange={(v) => setEditingRule({ ...editingRule, eventId: v })}
                  options={events.map((e) => ({ value: e.id, label: eventName(e) }))}
                />
              </Field>
              <Field label={t('ev.forWhom')}>
                <Select
                  value={`${editingRule.lifeStage}-${editingRule.gender}`}
                  onChange={(v) => {
                    const [lifeStage, gender] = v.split('-') as ['adult' | 'kid', 'male' | 'female']
                    // Age brackets belong to one ladder only — drop any that no
                    // longer apply when switching between adults and children.
                    const valid = bracketsFor(lifeStage).map((b) => b.id)
                    setEditingRule({
                      ...editingRule,
                      lifeStage,
                      gender,
                      ageBrackets: editingRule.ageBrackets.filter((b) => valid.includes(b)),
                    })
                  }}
                  options={AUDIENCES.map((a) => ({
                    value: audienceId(a),
                    label: `${t(audienceLabelKey(a))} — ${t(`seg.life.${a.lifeStage}` as never)}`,
                  }))}
                />
              </Field>
              <Field label={t('ev.priority')} hint={t('ev.priorityHint')}>
                <input
                  type="number"
                  min={1}
                  className="input"
                  value={editingRule.priority}
                  onChange={(e) =>
                    setEditingRule({ ...editingRule, priority: +e.target.value })
                  }
                />
              </Field>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label !mb-0">{t('ev.ageBrackets')}</label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="link"
                    onClick={() =>
                      setEditingRule({
                        ...editingRule,
                        ageBrackets: bracketsFor(editingRule.lifeStage).map((b) => b.id),
                      })
                    }
                  >
                    {t('ev.selectAll')}
                  </button>
                  <button
                    type="button"
                    className="link"
                    onClick={() => setEditingRule({ ...editingRule, ageBrackets: [] })}
                  >
                    {t('ev.clear')}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {bracketsFor(editingRule.lifeStage).map((b) => {
                  const on = editingRule.ageBrackets.includes(b.id)
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        setEditingRule({
                          ...editingRule,
                          ageBrackets: on
                            ? editingRule.ageBrackets.filter((x) => x !== b.id)
                            : [...editingRule.ageBrackets, b.id as AgeBracketId],
                        })
                      }
                      className={clsx(
                        'rounded-lg border px-3 py-2 text-start transition-colors',
                        on
                          ? 'border-gold-400 bg-gold-50 text-gold-900'
                          : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                      )}
                    >
                      <span className="block text-xs font-medium">{t(bracketLabelKey(b.id))}</span>
                      <span className="block text-[11px] tnum opacity-70">{bracketRange(b)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Field label={t('ev.perfumes')}>
              <ProductPicker
                products={sellableProducts}
                value={editingRule.productIds}
                onChange={(ids) => setEditingRule({ ...editingRule, productIds: ids })}
              />
            </Field>

            <Field label={t('common.notes')}>
              <textarea
                className="input"
                rows={2}
                value={editingRule.note ?? ''}
                onChange={(e) => setEditingRule({ ...editingRule, note: e.target.value })}
              />
            </Field>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-ink-300 text-gold-500 focus:ring-gold-200"
                checked={editingRule.active}
                onChange={(e) => setEditingRule({ ...editingRule, active: e.target.checked })}
              />
              <span className="text-sm text-ink-600">{t('common.active')}</span>
            </label>
          </div>
        )}
      </Modal>

      {/* ---------------- occasion editor ---------------- */}
      <Modal
        open={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        title={editingEvent && events.some((e) => e.id === editingEvent.id) ? t('common.edit') : t('ev.newEvent')}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditingEvent(null)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn-gold"
              disabled={!editingEvent?.nameEn.trim()}
              onClick={async () => {
                if (!editingEvent) return
                await save('giftEvents', {
                  ...editingEvent,
                  code: editingEvent.code || editingEvent.nameEn.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12),
                })
                setEditingEvent(null)
              }}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        {editingEvent && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t('common.name') + ' (EN)'}>
                <input
                  className="input"
                  value={editingEvent.nameEn}
                  onChange={(e) => setEditingEvent({ ...editingEvent, nameEn: e.target.value })}
                />
              </Field>
              <Field label={t('common.name') + ' (AR)'}>
                <input
                  className="input"
                  dir="rtl"
                  value={editingEvent.nameAr}
                  onChange={(e) => setEditingEvent({ ...editingEvent, nameAr: e.target.value })}
                />
              </Field>
              <Field label={t('common.category')}>
                <Select
                  value={editingEvent.category}
                  onChange={(v) => setEditingEvent({ ...editingEvent, category: v as EventCategory })}
                  options={CATEGORIES.map((c) => ({ value: c, label: t(`ev.cat.${c}` as never) }))}
                />
              </Field>
              <Field label={t('common.code')}>
                <input
                  className="input tnum"
                  value={editingEvent.code}
                  onChange={(e) => setEditingEvent({ ...editingEvent, code: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label={t('ev.when')}>
                <Select
                  value={editingEvent.month === null ? '' : String(editingEvent.month)}
                  onChange={(v) =>
                    setEditingEvent({ ...editingEvent, month: v === '' ? null : +v })
                  }
                  options={[
                    { value: '', label: t('ev.noDate') },
                    ...MONTHS.slice(1).map((m, i) => ({ value: String(i + 1), label: m })),
                  ]}
                />
              </Field>
              <Field label={t('common.date')}>
                <input
                  type="number"
                  min={1}
                  max={31}
                  className="input"
                  disabled={editingEvent.month === null}
                  value={editingEvent.day ?? ''}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, day: e.target.value ? +e.target.value : null })
                  }
                />
              </Field>
            </div>

            <div>
              <label className="label">{t('ev.suggested')}</label>
              <div className="flex flex-wrap gap-2">
                {AUDIENCES.map((a) => {
                  const on = editingEvent.suggestedAudiences.some((s) => sameAudience(s, a))
                  return (
                    <button
                      key={audienceId(a)}
                      type="button"
                      onClick={() =>
                        setEditingEvent({
                          ...editingEvent,
                          suggestedAudiences: on
                            ? editingEvent.suggestedAudiences.filter((s) => !sameAudience(s, a))
                            : [...editingEvent.suggestedAudiences, a],
                        })
                      }
                      className={clsx(
                        'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                        on
                          ? 'border-gold-400 bg-gold-50 text-gold-900'
                          : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                      )}
                    >
                      {t(audienceLabelKey(a))}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-gold-500 focus:ring-gold-200"
                  checked={editingEvent.movableDate}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, movableDate: e.target.checked })
                  }
                />
                <span className="text-sm text-ink-600">{t('ev.movable')}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-gold-500 focus:ring-gold-200"
                  checked={editingEvent.active}
                  onChange={(e) => setEditingEvent({ ...editingEvent, active: e.target.checked })}
                />
                <span className="text-sm text-ink-600">{t('common.active')}</span>
              </label>
            </div>

            <Field label={t('common.notes')}>
              <textarea
                className="input"
                rows={2}
                value={editingEvent.notes ?? ''}
                onChange={(e) => setEditingEvent({ ...editingEvent, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* ---------------- website preview ---------------- */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={t('ev.preview')}
        wide
      >
        {preview && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="w-full sm:w-auto"
                value={audienceId(preview.audience)}
                onChange={(v) => {
                  const a = AUDIENCES.find((x) => audienceId(x) === v)
                  if (a) setPreview({ ...preview, audience: a })
                }}
                options={AUDIENCES.map((a) => ({
                  value: audienceId(a),
                  label: t(audienceLabelKey(a)),
                }))}
              />
              <p className="text-xs text-ink-400">{t('ev.previewHint')}</p>
            </div>

            <div className="rounded-xl border border-ink-200 bg-gradient-to-b from-gold-50/60 to-white p-5">
              <p className="text-xs uppercase tracking-wider text-gold-700 mb-1">
                {t('ev.recommendedFor')}
              </p>
              <h3 className="text-2xl font-semibold text-ink-900 mb-4">
                {eventName(preview.event)} · {t(audienceLabelKey(preview.audience))}
              </h3>

              {bracketsFor(preview.audience.lifeStage).map((b) => {
                const items = suggestionsFor(
                  preview.event.id,
                  preview.audience,
                  recs,
                  db.products,
                  b.id
                )
                if (!items.length) return null
                return (
                  <div key={b.id} className="mb-5 last:mb-0">
                    <p className="text-xs font-semibold text-ink-500 mb-2">
                      {t(bracketLabelKey(b.id))}{' '}
                      <span className="tnum font-normal text-ink-400">({bracketRange(b)})</span>
                    </p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {items.map((s, i) => (
                        <div
                          key={s.product.id}
                          className={clsx(
                            'rounded-lg border bg-white p-3',
                            i === 0 ? 'border-gold-300 shadow-card' : 'border-ink-200'
                          )}
                        >
                          {i === 0 && (
                            <span className="chip bg-gold-100 text-gold-800 mb-1.5">
                              {t('ev.hero')}
                            </span>
                          )}
                          <p className="text-sm font-medium text-ink-900">
                            {lang === 'ar' ? s.product.nameAr : s.product.nameEn}
                          </p>
                          <p className="text-[11px] text-ink-400 tnum">
                            {s.product.concentration} · {s.product.sizeMl} ml
                          </p>
                          <p className="mt-1.5 text-sm font-semibold tnum text-ink-900">
                            {money(s.product.price, 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {suggestionsFor(preview.event.id, preview.audience, recs, db.products).length === 0 && (
                <p className="text-sm text-ink-500">{t('ev.noProducts')}</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
