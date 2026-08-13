import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Plus, Users } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import {
  Badge, Card, DataTable, Field, Modal, PageHeader, SearchInput,
  Select, StatCard, exportCsv,
} from '@/components/ui'
import { customerStats, safeDiv, sum } from '@/lib/calc'
import type { Customer } from '@/types'

const blank = (): Customer => ({
  id: `cus-${Date.now()}`,
  code: '',
  name: '',
  nameAr: '',
  phone: '',
  email: '',
  city: 'Dubai',
  country: 'UAE',
  type: 'retail',
  source: 'instagram',
  tags: [],
  createdAt: new Date().toISOString().slice(0, 10),
})

export default function Customers() {
  const { t, lang, money, num, date } = useI18n()
  const { db, save } = useData()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [city, setCity] = useState('all')
  const [editing, setEditing] = useState<Customer | null>(null)

  const rows = useMemo(
    () => db.customers.map((c) => ({ ...c, stats: customerStats(c, db.orders) })),
    [db]
  )

  const cities = useMemo(() => [...new Set(db.customers.map((c) => c.city))].sort(), [db.customers])

  const filtered = rows.filter((c) => {
    const q = search.toLowerCase()
    const matchQ =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.nameAr ?? '').includes(search) ||
      c.phone.includes(search) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q)
    return matchQ && (type === 'all' || c.type === type) && (city === 'all' || c.city === city)
  })

  const totalLtv = sum(rows.map((c) => c.stats.totalSpend))
  const withOrders = rows.filter((c) => c.stats.orderCount > 0)
  const repeat = rows.filter((c) => c.stats.orderCount > 1)

  return (
    <>
      <PageHeader
        title={t('cust.title')}
        subtitle={t('cust.subtitle')}
        actions={
          <>
            <button
              className="btn-ghost"
              onClick={() =>
                exportCsv('customers.csv', filtered.map((c) => ({
                  code: c.code, name: c.name, phone: c.phone, email: c.email ?? '',
                  city: c.city, type: c.type, source: c.source, tags: c.tags.join(' | '),
                  orders: c.stats.orderCount, lifetime_value_aed: +c.stats.totalSpend.toFixed(2),
                  avg_order_aed: +c.stats.avgOrderValue.toFixed(2),
                  outstanding_aed: +c.stats.outstanding.toFixed(2),
                  last_order: c.stats.lastOrderDate ?? '', customer_since: c.createdAt,
                })))
              }
            >
              <Download className="h-4 w-4" />
              {t('common.export')}
            </button>
            <button className="btn-gold" onClick={() => setEditing(blank())}>
              <Plus className="h-4 w-4" />
              {t('cust.new')}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('cust.title')} value={num(db.customers.length)} hint={`${num(withOrders.length)} ${t('cust.orders').toLowerCase()}`} icon={<Users className="h-4 w-4" />} />
        <StatCard label={t('cust.totalSpend')} value={money(totalLtv, 0)} hint={t('common.total')} />
        <StatCard label={t('cust.avgOrder')} value={money(safeDiv(totalLtv, sum(rows.map((c) => c.stats.orderCount))), 0)} />
        <StatCard
          label={t('cust.type.vip')}
          value={num(db.customers.filter((c) => c.type === 'vip').length)}
          hint={`${num(repeat.length)} ${t('common.units')}`}
          tone="good"
        />
      </div>

      <Card bodyClassName="pt-0 pb-0">
        <div className="flex flex-wrap gap-2 py-4 no-print">
          <div className="min-w-[200px] flex-1"><SearchInput value={search} onChange={setSearch} /></div>
          <Select
            className="w-auto"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: t('common.all') + ' — ' + t('common.type') },
              ...(['retail', 'wholesale', 'vip'] as const).map((x) => ({ value: x, label: t(`cust.type.${x}` as never) })),
            ]}
          />
          <Select
            className="w-auto"
            value={city}
            onChange={setCity}
            options={[{ value: 'all', label: t('common.all') + ' — ' + t('common.city') }, ...cities.map((c) => ({ value: c, label: c }))]}
          />
        </div>

        <DataTable
          rows={filtered}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          initialSort={{ key: 'ltv', dir: 'desc' }}
          columns={[
            {
              key: 'name', header: t('common.name'), sortValue: (c) => c.name,
              render: (c) => (
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-gold-100 text-gold-800 grid place-items-center text-xs font-semibold shrink-0">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-ink-900 truncate">{lang === 'ar' && c.nameAr ? c.nameAr : c.name}</p>
                    <p className="text-xs text-ink-400 tnum">{c.code} · {c.phone}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'type', header: t('common.type'), sortValue: (c) => c.type,
              render: (c) => (
                <Badge tone={c.type === 'vip' ? 'gold' : c.type === 'wholesale' ? 'blue' : 'neutral'}>
                  {t(`cust.type.${c.type}` as never)}
                </Badge>
              ),
            },
            { key: 'city', header: t('common.city'), sortValue: (c) => c.city, render: (c) => <span className="text-ink-600">{c.city}</span> },
            { key: 'orders', header: t('cust.orders'), align: 'end', sortValue: (c) => c.stats.orderCount, render: (c) => <span className="tnum">{num(c.stats.orderCount)}</span> },
            { key: 'ltv', header: t('cust.totalSpend'), align: 'end', sortValue: (c) => c.stats.totalSpend, render: (c) => <span className="tnum font-semibold">{money(c.stats.totalSpend, 0)}</span> },
            { key: 'aov', header: t('cust.avgOrder'), align: 'end', sortValue: (c) => c.stats.avgOrderValue, render: (c) => <span className="tnum text-ink-500">{money(c.stats.avgOrderValue, 0)}</span> },
            {
              key: 'out', header: t('cust.outstanding'), align: 'end', sortValue: (c) => c.stats.outstanding,
              render: (c) => c.stats.outstanding > 0.5
                ? <span className="tnum text-rose-600 font-medium">{money(c.stats.outstanding, 0)}</span>
                : <span className="text-ink-300">—</span>,
            },
            { key: 'last', header: t('cust.lastOrder'), sortValue: (c) => c.stats.lastOrderDate ?? '', render: (c) => <span className="text-ink-500 text-xs">{date(c.stats.lastOrderDate)}</span> },
          ]}
        />
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t('cust.new')}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            <button className="btn-gold" onClick={async () => { if (editing) { await save('customers', editing); setEditing(null) } }}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {editing && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('common.code')}>
              <input className="input" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
            </Field>
            <Field label={t('common.type')}>
              <Select
                value={editing.type}
                onChange={(v) => setEditing({ ...editing, type: v as Customer['type'] })}
                options={(['retail', 'wholesale', 'vip'] as const).map((x) => ({ value: x, label: t(`cust.type.${x}` as never) }))}
              />
            </Field>
            <Field label={t('common.name') + ' (EN)'}>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label={t('common.name') + ' (AR)'}>
              <input className="input" dir="rtl" value={editing.nameAr ?? ''} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} />
            </Field>
            <Field label={t('common.phone')}>
              <input className="input" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </Field>
            <Field label={t('common.email')}>
              <input className="input" type="email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label={t('common.city')}>
              <input className="input" value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
            </Field>
            <Field label={t('cust.source')}>
              <input className="input" value={editing.source} onChange={(e) => setEditing({ ...editing, source: e.target.value })} />
            </Field>
            <Field label={t('cust.tags')} className="sm:col-span-2" hint="Comma separated">
              <input
                className="input"
                value={editing.tags.join(', ')}
                onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            </Field>
            <Field label={t('common.notes')} className="sm:col-span-2">
              <textarea className="input" rows={2} value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}
