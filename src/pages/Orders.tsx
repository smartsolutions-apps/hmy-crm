import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Plus, Trash2 } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import {
  Badge, Card, DataTable, Field, Modal, PageHeader, SearchInput,
  Select, StatCard, exportCsv, statusTone,
} from '@/components/ui'
import { buildCostMap, orderCogs, orderTotals, safeDiv, sum } from '@/lib/calc'
import type { Order } from '@/types'

const STATUSES: Order['status'][] = ['draft', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned']
const PAY: Order['paymentStatus'][] = ['unpaid', 'partial', 'paid', 'refunded']
const CHANNELS: Order['channel'][] = ['instagram', 'whatsapp', 'website', 'store', 'wholesale', 'tiktok', 'referral']

export default function Orders() {
  const { t, lang, money, num, percent, date } = useI18n()
  const { db, save, remove } = useData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [payment, setPayment] = useState('all')
  const [channel, setChannel] = useState('all')
  const [detail, setDetail] = useState<Order | null>(null)
  const [editing, setEditing] = useState<Order | null>(null)

  const costMap = useMemo(() => buildCostMap(db), [db])
  const custName = (id: string) => db.customers.find((c) => c.id === id)?.name ?? '—'
  const prodName = (id: string) => {
    const p = db.products.find((x) => x.id === id)
    return p ? (lang === 'ar' ? p.nameAr : p.nameEn) : id
  }

  const rows = useMemo(
    () =>
      db.orders.map((o) => {
        const totals = orderTotals(o)
        const cogs = orderCogs(o, costMap)
        return { ...o, totals, cogs, profit: totals.net - cogs, customerName: custName(o.customerId) }
      }),
    [db, costMap]
  )

  const filtered = rows.filter((o) => {
    const q = search.toLowerCase()
    const matchQ = !q || o.orderNo.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q)
    return (
      matchQ &&
      (status === 'all' || o.status === status) &&
      (payment === 'all' || o.paymentStatus === payment) &&
      (channel === 'all' || o.channel === channel)
    )
  })

  const revenueRows = rows.filter((o) => o.status !== 'cancelled' && o.status !== 'returned')
  const totalRevenue = sum(revenueRows.map((o) => o.totals.net))
  const totalProfit = sum(revenueRows.map((o) => o.profit))
  const unpaid = sum(revenueRows.filter((o) => o.paymentStatus !== 'paid').map((o) => o.totals.balance))

  const newOrder = (): Order => ({
    id: `ord-${Date.now()}`,
    orderNo: `HMY-${new Date().toISOString().slice(2, 4)}${new Date().toISOString().slice(5, 7)}-${String(db.orders.length + 1).padStart(4, '0')}`,
    customerId: db.customers[0]?.id ?? '',
    date: new Date().toISOString().slice(0, 10),
    channel: 'instagram',
    status: 'confirmed',
    paymentStatus: 'unpaid',
    paymentMethod: 'card',
    items: [],
    shipping: 0,
    orderDiscount: 0,
    vatRate: 0.05,
    amountPaid: 0,
  })

  return (
    <>
      <PageHeader
        title={t('orders.title')}
        subtitle={t('orders.subtitle')}
        actions={
          <>
            <button
              className="btn-ghost"
              onClick={() =>
                exportCsv('orders.csv', filtered.map((o) => ({
                  order_no: o.orderNo, date: o.date, customer: o.customerName, channel: o.channel,
                  status: o.status, payment: o.paymentStatus,
                  items: o.items.map((i) => `${prodName(i.productId)} x${i.qty}`).join(' | '),
                  net_aed: +o.totals.net.toFixed(2), vat_aed: +o.totals.vat.toFixed(2),
                  shipping_aed: o.shipping, total_aed: +o.totals.total.toFixed(2),
                  paid_aed: o.amountPaid, balance_aed: +o.totals.balance.toFixed(2),
                  cogs_aed: +o.cogs.toFixed(2), profit_aed: +o.profit.toFixed(2),
                })))
              }
            >
              <Download className="h-4 w-4" />
              {t('common.export')}
            </button>
            <button className="btn-gold" onClick={() => setEditing(newOrder())}>
              <Plus className="h-4 w-4" />
              {t('orders.new')}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('dash.orders')} value={num(revenueRows.length)} hint={`${num(db.orders.length)} ${t('common.total').toLowerCase()}`} />
        <StatCard label={t('common.revenue')} value={money(totalRevenue, 0)} hint={t('acc.revenue')} />
        <StatCard label={t('common.profit')} value={money(totalProfit, 0)} tone="good" hint={percent(safeDiv(totalProfit, totalRevenue) * 100)} />
        <StatCard label={t('orders.pay.unpaid')} value={money(unpaid, 0)} tone={unpaid > 0 ? 'warn' : 'good'} />
      </div>

      <Card bodyClassName="pt-0 pb-0">
        <div className="flex flex-wrap gap-2 py-4 no-print">
          <div className="min-w-[180px] flex-1"><SearchInput value={search} onChange={setSearch} /></div>
          <Select className="w-full sm:w-auto" value={status} onChange={setStatus}
            options={[{ value: 'all', label: t('common.all') + ' — ' + t('common.status') }, ...STATUSES.map((s) => ({ value: s, label: t(`orders.status.${s}` as never) }))]} />
          <Select className="w-full sm:w-auto" value={payment} onChange={setPayment}
            options={[{ value: 'all', label: t('common.all') + ' — ' + t('orders.payment') }, ...PAY.map((s) => ({ value: s, label: t(`orders.pay.${s}` as never) }))]} />
          <Select className="w-full sm:w-auto" value={channel} onChange={setChannel}
            options={[{ value: 'all', label: t('common.all') + ' — ' + t('common.channel') }, ...CHANNELS.map((s) => ({ value: s, label: t(`orders.ch.${s}` as never) }))]} />
        </div>

        <DataTable
          rows={filtered}
          onRowClick={(o) => setDetail(o)}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'no', header: t('orders.orderNo'), sortValue: (o) => o.orderNo, render: (o) => <span className="font-medium tnum">{o.orderNo}</span> },
            {
              key: 'cust', header: t('common.customer'), sortValue: (o) => o.customerName,
              render: (o) => (
                <Link to={`/customers/${o.customerId}`} className="link" onClick={(e) => e.stopPropagation()}>
                  {o.customerName}
                </Link>
              ),
            },
            { key: 'date', header: t('common.date'), sortValue: (o) => o.date, render: (o) => <span className="text-ink-500">{date(o.date)}</span> },
            { key: 'items', header: t('orders.items'), align: 'end', sortValue: (o) => sum(o.items.map((i) => i.qty)), render: (o) => <span className="tnum text-ink-500">{num(sum(o.items.map((i) => i.qty)))}</span> },
            { key: 'ch', header: t('common.channel'), sortValue: (o) => o.channel, render: (o) => <Badge>{t(`orders.ch.${o.channel}` as never)}</Badge> },
            { key: 'status', header: t('common.status'), sortValue: (o) => o.status, render: (o) => <Badge tone={statusTone(o.status)}>{t(`orders.status.${o.status}` as never)}</Badge> },
            { key: 'pay', header: t('orders.payment'), sortValue: (o) => o.paymentStatus, render: (o) => <Badge tone={statusTone(o.paymentStatus)}>{t(`orders.pay.${o.paymentStatus}` as never)}</Badge> },
            { key: 'total', header: t('common.total'), align: 'end', sortValue: (o) => o.totals.total, render: (o) => <span className="tnum font-semibold">{money(o.totals.total)}</span> },
            {
              key: 'bal', header: t('common.balance'), align: 'end', sortValue: (o) => o.totals.balance,
              render: (o) => o.totals.balance > 0.5
                ? <span className="tnum text-rose-600">{money(o.totals.balance)}</span>
                : <span className="text-ink-300">—</span>,
            },
          ]}
        />
      </Card>

      {/* ---- invoice view ---- */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.orderNo ?? ''}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => window.print()}>{t('common.print')}</button>
            <button className="btn-ghost" onClick={() => setDetail(null)}>{t('common.close')}</button>
            <button className="btn-primary" onClick={() => { setEditing(detail); setDetail(null) }}>{t('common.edit')}</button>
          </>
        }
      >
        {detail && (() => {
          const totals = orderTotals(detail)
          const customer = db.customers.find((c) => c.id === detail.customerId)
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{customer?.name}</p>
                  <p className="text-xs text-ink-500 tnum">{customer?.phone}</p>
                  <p className="text-xs text-ink-500">{customer?.city}, {customer?.country}</p>
                </div>
                <div className="text-end">
                  <p className="text-xs text-ink-500">{date(detail.date)}</p>
                  <div className="flex gap-1.5 mt-1">
                    <Badge tone={statusTone(detail.status)}>{t(`orders.status.${detail.status}` as never)}</Badge>
                    <Badge tone={statusTone(detail.paymentStatus)}>{t(`orders.pay.${detail.paymentStatus}` as never)}</Badge>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="th">{t('common.product')}</th>
                      <th className="th text-end">{t('common.qty')}</th>
                      <th className="th text-end">{t('common.price')}</th>
                      <th className="th text-end">{t('common.discount')}</th>
                      <th className="th text-end">{t('orders.lineTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((i, idx) => (
                      <tr key={idx}>
                        <td className="td">{prodName(i.productId)}</td>
                        <td className="td text-end tnum">{num(i.qty)}</td>
                        <td className="td text-end tnum">{money(i.unitPrice, 0)}</td>
                        <td className="td text-end tnum text-ink-500">{i.discount ? `−${money(i.discount)}` : '—'}</td>
                        <td className="td text-end tnum font-medium">{money(i.qty * i.unitPrice - i.discount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <dl className="ms-auto max-w-xs space-y-1.5 text-sm">
                {([
                  [t('common.subtotal'), money(totals.subtotal)],
                  [t('common.discount'), totals.lineDiscounts + totals.orderDiscount ? `−${money(totals.lineDiscounts + totals.orderDiscount)}` : money(0)],
                  [`${t('common.vat')} (${percent(detail.vatRate * 100, 0)})`, money(totals.vat)],
                  [t('common.shipping'), money(totals.shipping)],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-ink-500">{k}</dt>
                    <dd className="tnum text-ink-800">{v}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 pt-2 border-t border-ink-200">
                  <dt className="font-semibold text-ink-900">{t('common.total')}</dt>
                  <dd className="tnum font-semibold text-ink-900">{money(totals.total)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">{t('common.paid')}</dt>
                  <dd className="tnum text-emerald-600">{money(detail.amountPaid)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-500">{t('common.balance')}</dt>
                  <dd className={`tnum font-medium ${totals.balance > 0.5 ? 'text-rose-600' : 'text-ink-800'}`}>{money(totals.balance)}</dd>
                </div>
              </dl>

              {detail.notes && <p className="text-sm text-ink-600 italic border-s-2 border-ink-200 ps-3">{detail.notes}</p>}
            </div>
          )
        })()}
      </Modal>

      {/* ---- editor ---- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && db.orders.some((o) => o.id === editing.id) ? t('common.edit') : t('orders.new')}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            <button
              className="btn-gold"
              disabled={!editing?.items.length}
              onClick={async () => { if (editing) { await save('orders', editing); setEditing(null) } }}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        {editing && (() => {
          const totals = orderTotals(editing)
          return (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label={t('orders.orderNo')}>
                  <input className="input" value={editing.orderNo} onChange={(e) => setEditing({ ...editing, orderNo: e.target.value })} />
                </Field>
                <Field label={t('common.customer')}>
                  <Select
                    value={editing.customerId}
                    onChange={(v) => {
                      const c = db.customers.find((x) => x.id === v)
                      // Wholesale accounts get wholesale pricing automatically.
                      const items = c?.type === 'wholesale'
                        ? editing.items.map((i) => ({
                            ...i,
                            unitPrice: db.products.find((p) => p.id === i.productId)?.wholesalePrice ?? i.unitPrice,
                          }))
                        : editing.items
                      setEditing({ ...editing, customerId: v, items, channel: c?.type === 'wholesale' ? 'wholesale' : editing.channel })
                    }}
                    options={db.customers.map((c) => ({ value: c.id, label: `${c.name} (${t(`cust.type.${c.type}` as never)})` }))}
                  />
                </Field>
                <Field label={t('common.date')}>
                  <input type="date" className="input" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
                </Field>
                <Field label={t('common.channel')}>
                  <Select value={editing.channel} onChange={(v) => setEditing({ ...editing, channel: v as Order['channel'] })}
                    options={CHANNELS.map((c) => ({ value: c, label: t(`orders.ch.${c}` as never) }))} />
                </Field>
                <Field label={t('common.status')}>
                  <Select value={editing.status} onChange={(v) => setEditing({ ...editing, status: v as Order['status'] })}
                    options={STATUSES.map((s) => ({ value: s, label: t(`orders.status.${s}` as never) }))} />
                </Field>
                <Field label={t('orders.payment')}>
                  <Select value={editing.paymentStatus} onChange={(v) => setEditing({ ...editing, paymentStatus: v as Order['paymentStatus'] })}
                    options={PAY.map((s) => ({ value: s, label: t(`orders.pay.${s}` as never) }))} />
                </Field>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="section-title">{t('orders.items')}</h3>
                  <button
                    className="btn-ghost !py-1 !px-2 text-xs"
                    onClick={() => {
                      const p = db.products.find((x) => x.status === 'active')
                      if (!p) return
                      const c = db.customers.find((x) => x.id === editing.customerId)
                      setEditing({
                        ...editing,
                        items: [...editing.items, {
                          productId: p.id, qty: 1,
                          unitPrice: c?.type === 'wholesale' ? p.wholesalePrice : p.price,
                          discount: 0,
                        }],
                      })
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('common.add')}
                  </button>
                </div>

                <div className="space-y-2">
                  {editing.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Select
                          value={item.productId}
                          onChange={(v) => {
                            const p = db.products.find((x) => x.id === v)
                            const c = db.customers.find((x) => x.id === editing.customerId)
                            const next = [...editing.items]
                            next[idx] = { ...item, productId: v, unitPrice: p ? (c?.type === 'wholesale' ? p.wholesalePrice : p.price) : item.unitPrice }
                            setEditing({ ...editing, items: next })
                          }}
                          options={db.products.map((p) => ({ value: p.id, label: lang === 'ar' ? p.nameAr : p.nameEn }))}
                        />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min={1} className="input text-end tnum" value={item.qty}
                          onChange={(e) => {
                            const next = [...editing.items]
                            next[idx] = { ...item, qty: +e.target.value }
                            setEditing({ ...editing, items: next })
                          }} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" className="input text-end tnum" value={item.unitPrice}
                          onChange={(e) => {
                            const next = [...editing.items]
                            next[idx] = { ...item, unitPrice: +e.target.value }
                            setEditing({ ...editing, items: next })
                          }} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" className="input text-end tnum" value={item.discount}
                          onChange={(e) => {
                            const next = [...editing.items]
                            next[idx] = { ...item, discount: +e.target.value }
                            setEditing({ ...editing, items: next })
                          }} />
                      </div>
                      <div className="col-span-1">
                        <button
                          className="btn-ghost !px-2 !py-2 text-rose-600"
                          onClick={() => setEditing({ ...editing, items: editing.items.filter((_, i) => i !== idx) })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                <Field label={t('common.shipping')}>
                  <input type="number" className="input" value={editing.shipping} onChange={(e) => setEditing({ ...editing, shipping: +e.target.value })} />
                </Field>
                <Field label={t('common.discount')}>
                  <input type="number" className="input" value={editing.orderDiscount} onChange={(e) => setEditing({ ...editing, orderDiscount: +e.target.value })} />
                </Field>
                <Field label={t('common.paid')}>
                  <input type="number" className="input" value={editing.amountPaid} onChange={(e) => setEditing({ ...editing, amountPaid: +e.target.value })} />
                </Field>
              </div>

              <div className="rounded-lg bg-ink-50 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-ink-500">{t('common.subtotal')}</span><span className="tnum">{money(totals.net)}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">{t('common.vat')}</span><span className="tnum">{money(totals.vat)}</span></div>
                <div className="flex justify-between font-semibold"><span>{t('common.total')}</span><span className="tnum">{money(totals.total)}</span></div>
                <div className="flex justify-between"><span className="text-ink-500">{t('common.balance')}</span><span className="tnum">{money(totals.balance)}</span></div>
              </div>

              {db.orders.some((o) => o.id === editing.id) && (
                <button
                  className="btn-danger w-full"
                  onClick={async () => { await remove('orders', editing.id); setEditing(null) }}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('common.delete')}
                </button>
              )}
            </div>
          )
        })()}
      </Modal>
    </>
  )
}
