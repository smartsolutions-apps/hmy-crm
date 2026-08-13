import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, MessageCircle, Phone, Plus, Store, StickyNote } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import {
  Badge, Card, DataTable, Field, Modal, PageHeader, Select, StatCard, statusTone,
} from '@/components/ui'
import { customerStats, orderTotals, sum } from '@/lib/calc'
import type { Interaction, Order } from '@/types'

const ICONS = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  visit: Store,
  note: StickyNote,
} as const

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, lang, money, num, date } = useI18n()
  const { db, save } = useData()

  const [logging, setLogging] = useState<Interaction | null>(null)

  const customer = db.customers.find((c) => c.id === id)
  const orders = useMemo(
    () => db.orders.filter((o) => o.customerId === id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [db.orders, id]
  )
  const interactions = useMemo(
    () => db.interactions.filter((i) => i.customerId === id).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [db.interactions, id]
  )

  // What this customer actually buys, so you know what to offer next.
  const favourites = useMemo(() => {
    const acc = new Map<string, number>()
    for (const o of orders) {
      if (o.status === 'cancelled' || o.status === 'returned') continue
      for (const i of o.items) acc.set(i.productId, (acc.get(i.productId) ?? 0) + i.qty)
    }
    return [...acc.entries()]
      .map(([pid, qty]) => ({ product: db.products.find((p) => p.id === pid), qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4)
  }, [orders, db.products])

  if (!customer) {
    return (
      <Card>
        <p className="text-sm text-ink-500">{t('common.noResults')}</p>
        <Link to="/customers" className="link text-sm mt-2 inline-block">{t('common.back')}</Link>
      </Card>
    )
  }

  const stats = customerStats(customer, db.orders)

  const newInteraction = (): Interaction => ({
    id: `int-${Date.now()}`,
    customerId: customer.id,
    date: new Date().toISOString().slice(0, 10),
    type: 'whatsapp',
    summary: '',
    by: 'Amr',
  })

  return (
    <>
      <button className="btn-ghost mb-4 no-print" onClick={() => navigate('/customers')}>
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t('common.back')}
      </button>

      <PageHeader
        title={lang === 'ar' && customer.nameAr ? customer.nameAr : customer.name}
        subtitle={`${customer.code} · ${customer.city}, ${customer.country}`}
        actions={
          <button className="btn-gold" onClick={() => setLogging(newInteraction())}>
            <Plus className="h-4 w-4" />
            {t('cust.addInteraction')}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('cust.totalSpend')} value={money(stats.totalSpend, 0)} tone="good" />
        <StatCard label={t('cust.orders')} value={num(stats.orderCount)} hint={`${t('cust.lastOrder')} ${date(stats.lastOrderDate)}`} />
        <StatCard label={t('cust.avgOrder')} value={money(stats.avgOrderValue, 0)} />
        <StatCard
          label={t('cust.outstanding')}
          value={money(stats.outstanding, 0)}
          tone={stats.outstanding > 0.5 ? 'bad' : 'good'}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title={t('common.details')}>
          <dl className="space-y-2.5 text-sm">
            {([
              [t('common.type'), <Badge key="t" tone={customer.type === 'vip' ? 'gold' : customer.type === 'wholesale' ? 'blue' : 'neutral'}>{t(`cust.type.${customer.type}` as never)}</Badge>],
              [t('common.phone'), <a key="p" href={`tel:${customer.phone}`} className="link tnum">{customer.phone}</a>],
              [t('common.email'), customer.email ? <a key="e" href={`mailto:${customer.email}`} className="link break-all">{customer.email}</a> : '—'],
              [t('cust.source'), customer.source],
              [t('cust.since'), date(customer.createdAt)],
              [t('cust.preferred'), customer.preferredFamily ? t(`products.family.${customer.preferredFamily}` as never) : '—'],
              [t('cust.birthday'), date(customer.birthday)],
            ] as const).map(([k, v], i) => (
              <div key={i} className="flex items-center justify-between gap-3 pb-2 border-b border-ink-100 last:border-0">
                <dt className="text-ink-500 shrink-0">{k}</dt>
                <dd className="text-ink-900 text-end">{v}</dd>
              </div>
            ))}
          </dl>

          {customer.tags.length > 0 && (
            <div className="mt-4">
              <p className="label">{t('cust.tags')}</p>
              <div className="flex flex-wrap gap-1.5">
                {customer.tags.map((tag) => <Badge key={tag} tone="gold">{tag}</Badge>)}
              </div>
            </div>
          )}

          {customer.notes && (
            <p className="mt-4 text-sm text-ink-600 italic border-s-2 border-gold-300 ps-3">{customer.notes}</p>
          )}
        </Card>

        <Card title={t('dash.topProducts')}>
          {favourites.length === 0 ? (
            <p className="text-sm text-ink-500">{t('common.noResults')}</p>
          ) : (
            <ul className="space-y-3">
              {favourites.map(({ product, qty }) => (
                <li key={product?.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 truncate">
                      {product ? (lang === 'ar' ? product.nameAr : product.nameEn) : '—'}
                    </p>
                    <p className="text-xs text-ink-400">{product?.concentration} {product?.sizeMl}ml</p>
                  </div>
                  <span className="text-sm tnum font-semibold text-ink-700 shrink-0">×{num(qty)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('cust.interactions')}>
          {interactions.length === 0 ? (
            <p className="text-sm text-ink-500">{t('cust.noInteractions')}</p>
          ) : (
            <ul className="space-y-3 max-h-80 overflow-y-auto">
              {interactions.map((i) => {
                const Icon = ICONS[i.type]
                return (
                  <li key={i.id} className="flex gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-ink-100 grid place-items-center shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-ink-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-ink-800 leading-snug">{i.summary}</p>
                      <p className="text-xs text-ink-400 mt-0.5">
                        {t(`cust.int.${i.type}` as never)} · {date(i.date)}{i.by ? ` · ${i.by}` : ''}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title={t('cust.orderHistory')} bodyClassName="pt-0 pb-0">
        <DataTable<Order>
          rows={orders}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'no', header: t('orders.orderNo'), sortValue: (o) => o.orderNo, render: (o) => <span className="font-medium tnum">{o.orderNo}</span> },
            { key: 'date', header: t('common.date'), sortValue: (o) => o.date, render: (o) => <span className="text-ink-500">{date(o.date)}</span> },
            {
              key: 'items', header: t('orders.items'),
              render: (o) => (
                <span className="text-ink-600 text-xs">
                  {o.items.map((i) => {
                    const p = db.products.find((x) => x.id === i.productId)
                    return `${lang === 'ar' && p?.nameAr ? p.nameAr : p?.nameEn ?? '—'} ×${i.qty}`
                  }).join(' · ')}
                </span>
              ),
            },
            { key: 'channel', header: t('common.channel'), sortValue: (o) => o.channel, render: (o) => <Badge>{t(`orders.ch.${o.channel}` as never)}</Badge> },
            { key: 'status', header: t('common.status'), render: (o) => <Badge tone={statusTone(o.status)}>{t(`orders.status.${o.status}` as never)}</Badge> },
            { key: 'pay', header: t('orders.payment'), render: (o) => <Badge tone={statusTone(o.paymentStatus)}>{t(`orders.pay.${o.paymentStatus}` as never)}</Badge> },
            { key: 'total', header: t('common.total'), align: 'end', sortValue: (o) => orderTotals(o).total, render: (o) => <span className="tnum font-semibold">{money(orderTotals(o).total)}</span> },
          ]}
          footer={
            <tr>
              <td className="td font-medium" colSpan={6}>{t('common.total')}</td>
              <td className="td text-end tnum font-semibold">
                {money(sum(orders.filter((o) => o.status !== 'cancelled' && o.status !== 'returned').map((o) => orderTotals(o).total)))}
              </td>
            </tr>
          }
        />
      </Card>

      <Modal
        open={!!logging}
        onClose={() => setLogging(null)}
        title={t('cust.addInteraction')}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setLogging(null)}>{t('common.cancel')}</button>
            <button
              className="btn-gold"
              disabled={!logging?.summary.trim()}
              onClick={async () => { if (logging) { await save('interactions', logging); setLogging(null) } }}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        {logging && (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label={t('common.type')}>
                <Select
                  value={logging.type}
                  onChange={(v) => setLogging({ ...logging, type: v as Interaction['type'] })}
                  options={(['call', 'whatsapp', 'email', 'visit', 'note'] as const).map((x) => ({
                    value: x, label: t(`cust.int.${x}` as never),
                  }))}
                />
              </Field>
              <Field label={t('common.date')}>
                <input type="date" className="input" value={logging.date} onChange={(e) => setLogging({ ...logging, date: e.target.value })} />
              </Field>
            </div>
            <Field label={t('common.summary')}>
              <textarea className="input" rows={4} value={logging.summary} onChange={(e) => setLogging({ ...logging, summary: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}
