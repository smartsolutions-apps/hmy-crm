import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Download, Megaphone, Plus, TrendingUp } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import {
  Badge, Card, DataTable, Field, MiniBar, Modal, PageHeader, SearchInput,
  Select, StatCard, exportCsv, statusTone,
} from '@/components/ui'
import { campaignStats, safeDiv, sum } from '@/lib/calc'
import type { Campaign, Lead } from '@/types'

const LEAD_STATUSES: Lead['status'][] = ['new', 'contacted', 'qualified', 'won', 'lost']

export default function Marketing() {
  const { t, lang, money, num, percent, date } = useI18n()
  const { db, save } = useData()

  const [tab, setTab] = useState<'campaigns' | 'leads'>('campaigns')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<Campaign | null>(null)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

  const rows = useMemo(
    () => db.campaigns.map((c) => ({ ...c, stats: campaignStats(c) })),
    [db.campaigns]
  )

  const totalSpend = sum(rows.map((c) => c.spend))
  const totalRevenue = sum(rows.map((c) => c.revenue))
  const blendedRoas = safeDiv(totalRevenue, totalSpend)
  const openLeads = db.leads.filter((l) => l.status !== 'won' && l.status !== 'lost')

  // Spend vs attributed revenue, grouped by channel.
  const byChannel = useMemo(() => {
    const acc = new Map<string, { spend: number; revenue: number; leads: number; orders: number }>()
    for (const c of db.campaigns) {
      const cur = acc.get(c.channel) ?? { spend: 0, revenue: 0, leads: 0, orders: 0 }
      cur.spend += c.spend
      cur.revenue += c.revenue
      cur.leads += c.leads
      cur.orders += c.orders
      acc.set(c.channel, cur)
    }
    return [...acc.entries()]
      .map(([channel, v]) => ({
        channel,
        label: t(`mkt.ch.${channel}` as never),
        ...v,
        roas: +safeDiv(v.revenue, v.spend).toFixed(2),
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [db.campaigns, t])

  const funnel = useMemo(() => {
    const counts = LEAD_STATUSES.map((s) => ({
      status: s,
      label: t(`mkt.lead.${s}` as never),
      count: db.leads.filter((l) => l.status === s).length,
      value: sum(db.leads.filter((l) => l.status === s).map((l) => l.estimatedValue)),
    }))
    return counts
  }, [db.leads, t])

  const campaignName = (c: Campaign) => (lang === 'ar' && c.nameAr ? c.nameAr : c.name)

  const filteredCampaigns = rows.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.name.toLowerCase().includes(q) || (c.nameAr ?? '').includes(search)
  })

  const filteredLeads = db.leads.filter((l) => {
    const q = search.toLowerCase()
    return !q || l.name.toLowerCase().includes(q) || l.phone.includes(search)
  })

  return (
    <>
      <PageHeader
        title={t('mkt.title')}
        subtitle={t('mkt.subtitle')}
        actions={
          <button
            className="btn-ghost"
            onClick={() =>
              tab === 'campaigns'
                ? exportCsv('campaigns.csv', filteredCampaigns.map((c) => ({
                    name: c.name, channel: c.channel, status: c.status,
                    start: c.startDate, end: c.endDate, budget_aed: c.budget, spend_aed: c.spend,
                    impressions: c.impressions, clicks: c.clicks, ctr_pct: +c.stats.ctr.toFixed(2),
                    leads: c.leads, orders: c.orders, revenue_aed: c.revenue,
                    roas: +c.stats.roas.toFixed(2), cost_per_lead_aed: +c.stats.cpl.toFixed(2),
                    cost_per_order_aed: +c.stats.cpa.toFixed(2), profit_aed: +c.stats.profit.toFixed(2),
                  })))
                : exportCsv('leads.csv', filteredLeads.map((l) => ({
                    name: l.name, phone: l.phone, email: l.email ?? '', source: l.source,
                    status: l.status, estimated_value_aed: l.estimatedValue,
                    created: l.createdAt, owner: l.owner ?? '',
                  })))
            }
          >
            <Download className="h-4 w-4" />
            {t('common.export')}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('mkt.totalSpend')} value={money(totalSpend, 0)} hint={`${num(db.campaigns.length)} ${t('mkt.campaigns').toLowerCase()}`} icon={<Megaphone className="h-4 w-4" />} />
        <StatCard label={t('mkt.totalRevenue')} value={money(totalRevenue, 0)} tone="good" />
        <StatCard label={t('mkt.blendedRoas')} value={`${num(blendedRoas, 2)}×`} tone={blendedRoas >= 2 ? 'good' : 'warn'} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label={t('mkt.newLeads')} value={num(openLeads.length)} hint={money(sum(openLeads.map((l) => l.estimatedValue)), 0)} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title={t('mkt.spendVsRevenue')} className="lg:col-span-2" bodyClassName="pt-2">
          <div style={{ direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byChannel} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e3e6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7b7f8a' }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#7b7f8a' }} tickLine={false} axisLine={false} width={50}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v: number) => money(v, 0)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="spend" name={t('mkt.spend')} fill="#f43f5e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="revenue" name={t('common.revenue')} fill="#cfa055" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('mkt.funnel')}>
          <ul className="space-y-3">
            {funnel.map((f) => (
              <li key={f.status}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-sm text-ink-700">{f.label}</span>
                  <span className="text-sm tnum font-medium text-ink-900">{num(f.count)}</span>
                </div>
                <MiniBar
                  value={f.count}
                  max={Math.max(...funnel.map((x) => x.count), 1)}
                  tone={f.status === 'won' ? 'emerald' : f.status === 'lost' ? 'rose' : 'gold'}
                />
                <p className="text-[11px] text-ink-400 mt-0.5 tnum">{money(f.value, 0)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card bodyClassName="pt-0 pb-0">
        <div className="flex flex-wrap items-center gap-2 py-4 no-print">
          <div className="flex rounded-lg border border-ink-200 overflow-hidden">
            {(['campaigns', 'leads'] as const).map((x) => (
              <button
                key={x}
                className={`px-3.5 py-2 text-sm font-medium ${tab === x ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 hover:bg-ink-50'}`}
                onClick={() => { setTab(x); setSearch('') }}
              >
                {x === 'campaigns' ? t('mkt.campaigns') : t('mkt.leads')}
              </button>
            ))}
          </div>
          <div className="min-w-[200px] flex-1"><SearchInput value={search} onChange={setSearch} /></div>
        </div>

        {tab === 'campaigns' ? (
          <DataTable
            rows={filteredCampaigns}
            onRowClick={(c) => setDetail(c)}
            initialSort={{ key: 'roas', dir: 'desc' }}
            columns={[
              {
                key: 'name', header: t('mkt.campaigns'), sortValue: (c) => c.name,
                render: (c) => (
                  <div>
                    <p className="font-medium text-ink-900">{campaignName(c)}</p>
                    <p className="text-xs text-ink-400">{date(c.startDate)} → {date(c.endDate)}</p>
                  </div>
                ),
              },
              { key: 'ch', header: t('common.channel'), sortValue: (c) => c.channel, render: (c) => <Badge tone="gold">{t(`mkt.ch.${c.channel}` as never)}</Badge> },
              {
                key: 'spend', header: t('mkt.spend'), align: 'end', sortValue: (c) => c.spend,
                render: (c) => (
                  <div className="min-w-[90px]">
                    <p className="tnum">{money(c.spend, 0)}</p>
                    <MiniBar value={c.spend} max={c.budget} tone={c.spend > c.budget ? 'rose' : 'gold'} />
                    <p className="text-[10px] text-ink-400 tnum">{percent(c.stats.budgetUsedPct, 0)} {t('mkt.budgetUsed').toLowerCase()}</p>
                  </div>
                ),
              },
              { key: 'rev', header: t('common.revenue'), align: 'end', sortValue: (c) => c.revenue, render: (c) => <span className="tnum font-medium">{money(c.revenue, 0)}</span> },
              {
                key: 'roas', header: t('mkt.roas'), align: 'end', sortValue: (c) => c.stats.roas,
                render: (c) => (
                  <span className={c.stats.roas >= 2 ? 'text-emerald-600 font-semibold tnum' : c.stats.roas >= 1 ? 'text-amber-600 tnum' : 'text-rose-600 tnum'}>
                    {num(c.stats.roas, 2)}×
                  </span>
                ),
              },
              { key: 'leads', header: t('mkt.leadsCount'), align: 'end', sortValue: (c) => c.leads, render: (c) => <span className="tnum text-ink-600">{num(c.leads)}</span> },
              { key: 'cpl', header: t('mkt.cpl'), align: 'end', sortValue: (c) => c.stats.cpl, render: (c) => <span className="tnum text-ink-500">{money(c.stats.cpl, 0)}</span> },
              { key: 'cpa', header: t('mkt.cpa'), align: 'end', sortValue: (c) => c.stats.cpa, render: (c) => <span className="tnum text-ink-500">{money(c.stats.cpa, 0)}</span> },
              { key: 'status', header: t('common.status'), render: (c) => <Badge tone={statusTone(c.status)}>{t(`mkt.status.${c.status}` as never)}</Badge> },
            ]}
          />
        ) : (
          <DataTable
            rows={filteredLeads}
            onRowClick={(l) => setEditingLead(l)}
            initialSort={{ key: 'created', dir: 'desc' }}
            columns={[
              {
                key: 'name', header: t('common.name'), sortValue: (l) => l.name,
                render: (l) => (
                  <div>
                    <p className="font-medium text-ink-900">{l.name}</p>
                    <p className="text-xs text-ink-400 tnum">{l.phone}</p>
                  </div>
                ),
              },
              { key: 'src', header: t('cust.source'), sortValue: (l) => l.source, render: (l) => <Badge>{t(`mkt.ch.${l.source}` as never)}</Badge> },
              {
                key: 'camp', header: t('mkt.campaigns'), sortValue: (l) => l.campaignId ?? '',
                render: (l) => {
                  const c = db.campaigns.find((x) => x.id === l.campaignId)
                  return c ? <span className="text-xs text-ink-600">{campaignName(c)}</span> : <span className="text-ink-300">—</span>
                },
              },
              { key: 'val', header: t('mkt.estValue'), align: 'end', sortValue: (l) => l.estimatedValue, render: (l) => <span className="tnum">{money(l.estimatedValue, 0)}</span> },
              { key: 'created', header: t('common.date'), sortValue: (l) => l.createdAt, render: (l) => <span className="text-ink-500 text-xs">{date(l.createdAt)}</span> },
              { key: 'owner', header: t('mkt.owner'), render: (l) => <span className="text-xs text-ink-600">{l.owner ?? '—'}</span> },
              { key: 'status', header: t('common.status'), sortValue: (l) => l.status, render: (l) => <Badge tone={statusTone(l.status)}>{t(`mkt.lead.${l.status}` as never)}</Badge> },
            ]}
          />
        )}
      </Card>

      {/* ---- campaign detail ---- */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? campaignName(detail) : ''} wide>
        {detail && (() => {
          const s = campaignStats(detail)
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="gold">{t(`mkt.ch.${detail.channel}` as never)}</Badge>
                <Badge tone={statusTone(detail.status)}>{t(`mkt.status.${detail.status}` as never)}</Badge>
                <span className="text-xs text-ink-500">{date(detail.startDate)} → {date(detail.endDate)}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label={t('mkt.budget')} value={money(detail.budget, 0)} />
                <StatCard label={t('mkt.spend')} value={money(detail.spend, 0)} hint={percent(s.budgetUsedPct, 0)} />
                <StatCard label={t('common.revenue')} value={money(detail.revenue, 0)} tone="good" />
                <StatCard label={t('common.profit')} value={money(s.profit, 0)} tone={s.profit >= 0 ? 'good' : 'bad'} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label={t('mkt.impressions')} value={num(detail.impressions)} />
                <StatCard label={t('mkt.clicks')} value={num(detail.clicks)} hint={`${percent(s.ctr, 2)} ${t('mkt.ctr')}`} />
                <StatCard label={t('mkt.leadsCount')} value={num(detail.leads)} hint={`${money(s.cpl, 0)} ${t('mkt.cpl').toLowerCase()}`} />
                <StatCard label={t('mkt.ordersCount')} value={num(detail.orders)} hint={`${money(s.cpa, 0)} ${t('mkt.cpa').toLowerCase()}`} />
              </div>

              <div className="rounded-lg bg-ink-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-600">{t('mkt.roas')}</span>
                  <span className={`text-2xl font-semibold tnum ${s.roas >= 2 ? 'text-emerald-600' : s.roas >= 1 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {num(s.roas, 2)}×
                  </span>
                </div>
              </div>

              {detail.notes && <p className="text-sm text-ink-600 italic border-s-2 border-gold-300 ps-3">{detail.notes}</p>}
            </div>
          )
        })()}
      </Modal>

      {/* ---- lead editor ---- */}
      <Modal
        open={!!editingLead}
        onClose={() => setEditingLead(null)}
        title={editingLead?.name ?? ''}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditingLead(null)}>{t('common.cancel')}</button>
            <button className="btn-gold" onClick={async () => { if (editingLead) { await save('leads', editingLead); setEditingLead(null) } }}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {editingLead && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('common.name')}>
              <input className="input" value={editingLead.name} onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })} />
            </Field>
            <Field label={t('common.phone')}>
              <input className="input" value={editingLead.phone} onChange={(e) => setEditingLead({ ...editingLead, phone: e.target.value })} />
            </Field>
            <Field label={t('common.status')}>
              <Select
                value={editingLead.status}
                onChange={(v) => setEditingLead({ ...editingLead, status: v as Lead['status'] })}
                options={LEAD_STATUSES.map((s) => ({ value: s, label: t(`mkt.lead.${s}` as never) }))}
              />
            </Field>
            <Field label={t('mkt.estValue')}>
              <input type="number" className="input" value={editingLead.estimatedValue} onChange={(e) => setEditingLead({ ...editingLead, estimatedValue: +e.target.value })} />
            </Field>
            <Field label={t('mkt.owner')}>
              <input className="input" value={editingLead.owner ?? ''} onChange={(e) => setEditingLead({ ...editingLead, owner: e.target.value })} />
            </Field>
            <Field label={t('common.date')}>
              <input type="date" className="input" value={editingLead.createdAt} onChange={(e) => setEditingLead({ ...editingLead, createdAt: e.target.value })} />
            </Field>
            <Field label={t('common.notes')} className="sm:col-span-2">
              <textarea className="input" rows={3} value={editingLead.notes ?? ''} onChange={(e) => setEditingLead({ ...editingLead, notes: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}
