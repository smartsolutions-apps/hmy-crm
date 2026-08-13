import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, ComposedChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Download, Plus } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import {
  Badge, Card, DataTable, Field, Modal, PageHeader, Select, StatCard,
  exportCsv, statusTone,
} from '@/components/ui'
import {
  accountsPayable, accountsReceivable, computePnL, monthlySeries,
  orderTotals, purchaseTotal, sum,
} from '@/lib/calc'
import type { Expense, ExpenseCategory } from '@/types'

const CATEGORIES: ExpenseCategory[] = [
  'rent', 'salaries', 'marketing', 'utilities', 'packaging',
  'shipping', 'licence', 'equipment', 'software', 'other',
]

const PIE_COLORS = ['#cfa055', '#3e4048', '#7b7f8a', '#c5c7cd', '#89552c', '#dcbd7e', '#61646f', '#a0a3ac', '#70452a', '#e2e3e6']

const PERIODS = [
  { value: '3', labelKey: 'common.last3Months' },
  { value: '6', labelKey: 'common.last6Months' },
  { value: '12', labelKey: 'common.last12Months' },
  { value: '0', labelKey: 'common.allTime' },
] as const

export default function Accounting() {
  const { t, money, num, percent, date } = useI18n()
  const { db, save } = useData()

  const [period, setPeriod] = useState('12')
  const [tab, setTab] = useState<'expenses' | 'receivables' | 'payables'>('expenses')
  const [editing, setEditing] = useState<Expense | null>(null)

  const from = useMemo(() => {
    if (period === '0') return undefined
    const d = new Date()
    d.setMonth(d.getMonth() - Number(period))
    return d.toISOString().slice(0, 10)
  }, [period])

  const pnl = useMemo(() => computePnL(db, from), [db, from])
  const series = useMemo(() => monthlySeries(db, period === '0' ? 12 : Number(period)), [db, period])
  const ar = useMemo(() => accountsReceivable(db), [db])
  const ap = useMemo(() => accountsPayable(db), [db])

  const expensePie = useMemo(
    () =>
      Object.entries(pnl.expensesByCategory)
        .map(([category, amount]) => ({ category, label: t(`acc.exp.${category}` as never), amount }))
        .sort((a, b) => b.amount - a.amount),
    [pnl.expensesByCategory, t]
  )

  const expenses = useMemo(
    () => db.expenses.filter((e) => !from || e.date >= from).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [db.expenses, from]
  )

  const custName = (id: string) => db.customers.find((c) => c.id === id)?.name ?? '—'
  const supName = (id: string) => db.suppliers.find((s) => s.id === id)?.name ?? '—'

  const newExpense = (): Expense => ({
    id: `exp-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    category: 'other',
    description: '',
    amount: 0,
    paymentMethod: 'card',
    recurring: false,
  })

  const pnlRows: Array<[string, number, 'plain' | 'sub' | 'total' | 'negative']> = [
    [t('acc.revenue'), pnl.revenue, 'plain'],
    [t('acc.cogs'), -pnl.cogs, 'negative'],
    [t('acc.grossProfit'), pnl.grossProfit, 'sub'],
    [t('acc.productionLoss'), -pnl.productionLoss, 'negative'],
    [t('acc.opex'), -pnl.expenses, 'negative'],
    [t('acc.netProfit'), pnl.netProfit, 'total'],
  ]

  return (
    <>
      <PageHeader
        title={t('acc.title')}
        subtitle={t('acc.subtitle')}
        actions={
          <>
            <Select
              className="w-auto"
              value={period}
              onChange={setPeriod}
              options={PERIODS.map((p) => ({ value: p.value, label: t(p.labelKey) }))}
            />
            <button className="btn-gold" onClick={() => setEditing(newExpense())}>
              <Plus className="h-4 w-4" />
              {t('acc.newExpense')}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('acc.revenue')} value={money(pnl.revenue, 0)} />
        <StatCard label={t('acc.grossProfit')} value={money(pnl.grossProfit, 0)} hint={percent(pnl.grossMarginPct)} tone="good" />
        <StatCard label={t('acc.netProfit')} value={money(pnl.netProfit, 0)} hint={percent(pnl.netMarginPct)} tone={pnl.netProfit >= 0 ? 'good' : 'bad'} />
        <StatCard label={t('acc.vatCollected')} value={money(pnl.vatCollected, 0)} hint="5%" tone="warn" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title={t('acc.pnl')} className="lg:col-span-1">
          <dl className="space-y-0.5 text-sm">
            {pnlRows.map(([label, value, kind]) => (
              <div
                key={label}
                className={
                  kind === 'total'
                    ? 'flex justify-between gap-4 py-2.5 mt-1 border-t-2 border-ink-800'
                    : kind === 'sub'
                      ? 'flex justify-between gap-4 py-2 border-t border-ink-200 font-medium'
                      : 'flex justify-between gap-4 py-1.5'
                }
              >
                <dt className={kind === 'total' ? 'font-semibold text-ink-900' : 'text-ink-600'}>{label}</dt>
                <dd
                  className={`tnum ${
                    kind === 'total'
                      ? `font-semibold text-lg ${value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`
                      : kind === 'negative'
                        ? 'text-rose-600'
                        : 'text-ink-900'
                  }`}
                >
                  {money(value, 0)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title={t('acc.cashflow')} className="lg:col-span-2" bodyClassName="pt-2">
          <div style={{ direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e3e6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7b7f8a' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7b7f8a' }} tickLine={false} axisLine={false} width={52}
                  tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v: number) => money(v, 0)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name={t('common.revenue')} fill="#cfa055" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="expenses" name={t('acc.expenses')} fill="#c5c7cd" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Line type="monotone" dataKey="netProfit" name={t('acc.netProfit')} stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title={t('acc.expensesByCategory')} bodyClassName="pt-2">
          <div style={{ direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expensePie} dataKey="amount" nameKey="label" innerRadius={45} outerRadius={85} paddingAngle={2}>
                  {expensePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => money(v, 0)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {expensePie.map((e, i) => (
              <li key={e.category} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-ink-600 flex-1 truncate">{e.label}</span>
                <span className="tnum text-ink-800 font-medium">{money(e.amount, 0)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={t('acc.receivables')} className="lg:col-span-1">
          <p className="text-2xl font-semibold tnum text-amber-600 mb-3">{money(sum(ar.map((x) => x.balance)), 0)}</p>
          {ar.length === 0 ? (
            <p className="text-sm text-ink-500">{t('acc.noReceivables')}</p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {ar.slice(0, 12).map(({ order, balance }) => (
                <li key={order.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <Link to={`/customers/${order.customerId}`} className="link truncate block">{custName(order.customerId)}</Link>
                    <p className="text-xs text-ink-400 tnum">{order.orderNo} · {date(order.date)}</p>
                  </div>
                  <span className="tnum font-medium text-rose-600 shrink-0">{money(balance, 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t('acc.payables')}>
          <p className="text-2xl font-semibold tnum text-rose-600 mb-3">{money(sum(ap.map((x) => x.balance)), 0)}</p>
          {ap.length === 0 ? (
            <p className="text-sm text-ink-500">{t('acc.noPayables')}</p>
          ) : (
            <ul className="space-y-2 max-h-56 overflow-y-auto">
              {ap.map(({ purchase, balance }) => (
                <li key={purchase.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-ink-800 truncate">{supName(purchase.supplierId)}</p>
                    <p className="text-xs text-ink-400 tnum">{purchase.poNo} · {date(purchase.date)}</p>
                  </div>
                  <span className="tnum font-medium text-rose-600 shrink-0">{money(balance, 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card bodyClassName="pt-0 pb-0">
        <div className="flex flex-wrap items-center gap-2 py-4 no-print">
          <div className="flex rounded-lg border border-ink-200 overflow-hidden">
            {([
              ['expenses', t('acc.expenses')],
              ['receivables', t('acc.receivables')],
              ['payables', t('acc.payables')],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                className={`px-3.5 py-2 text-sm font-medium ${tab === key ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 hover:bg-ink-50'}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1" />
          <button
            className="btn-ghost"
            onClick={() =>
              exportCsv('expenses.csv', expenses.map((e) => ({
                date: e.date, category: e.category, description: e.description,
                amount_aed: e.amount, vendor: e.vendor ?? '', method: e.paymentMethod,
                recurring: e.recurring ? 'yes' : 'no',
              })))
            }
          >
            <Download className="h-4 w-4" />
            {t('common.export')}
          </button>
        </div>

        {tab === 'expenses' && (
          <DataTable
            rows={expenses}
            onRowClick={(e) => setEditing(e)}
            initialSort={{ key: 'date', dir: 'desc' }}
            columns={[
              { key: 'date', header: t('common.date'), sortValue: (e) => e.date, render: (e) => <span className="text-ink-500">{date(e.date)}</span> },
              { key: 'cat', header: t('common.category'), sortValue: (e) => e.category, render: (e) => <Badge>{t(`acc.exp.${e.category}` as never)}</Badge> },
              { key: 'desc', header: t('common.details'), sortValue: (e) => e.description, render: (e) => <span className="text-ink-800">{e.description}</span> },
              { key: 'vendor', header: t('acc.vendor'), render: (e) => <span className="text-xs text-ink-500">{e.vendor ?? '—'}</span> },
              { key: 'method', header: t('acc.method'), render: (e) => <span className="text-xs text-ink-500">{e.paymentMethod}</span> },
              { key: 'rec', header: t('acc.recurring'), align: 'center', render: (e) => e.recurring ? <Badge tone="blue">↻</Badge> : <span className="text-ink-300">—</span> },
              { key: 'amt', header: t('common.total'), align: 'end', sortValue: (e) => e.amount, render: (e) => <span className="tnum font-semibold">{money(e.amount)}</span> },
            ]}
            footer={
              <tr>
                <td className="td font-medium" colSpan={6}>{t('common.total')}</td>
                <td className="td text-end tnum font-semibold">{money(sum(expenses.map((e) => e.amount)))}</td>
              </tr>
            }
          />
        )}

        {tab === 'receivables' && (
          <DataTable
            rows={ar.map(({ order, balance }) => ({ ...order, balance }))}
            initialSort={{ key: 'bal', dir: 'desc' }}
            columns={[
              { key: 'no', header: t('orders.orderNo'), sortValue: (o) => o.orderNo, render: (o) => <span className="tnum font-medium">{o.orderNo}</span> },
              { key: 'cust', header: t('common.customer'), sortValue: (o) => custName(o.customerId), render: (o) => <Link to={`/customers/${o.customerId}`} className="link">{custName(o.customerId)}</Link> },
              { key: 'date', header: t('common.date'), sortValue: (o) => o.date, render: (o) => <span className="text-ink-500">{date(o.date)}</span> },
              { key: 'total', header: t('common.total'), align: 'end', sortValue: (o) => orderTotals(o).total, render: (o) => <span className="tnum">{money(orderTotals(o).total)}</span> },
              { key: 'paid', header: t('common.paid'), align: 'end', sortValue: (o) => o.amountPaid, render: (o) => <span className="tnum text-emerald-600">{money(o.amountPaid)}</span> },
              { key: 'bal', header: t('common.balance'), align: 'end', sortValue: (o) => o.balance, render: (o) => <span className="tnum font-semibold text-rose-600">{money(o.balance)}</span> },
              { key: 'status', header: t('orders.payment'), render: (o) => <Badge tone={statusTone(o.paymentStatus)}>{t(`orders.pay.${o.paymentStatus}` as never)}</Badge> },
            ]}
            footer={
              <tr>
                <td className="td font-medium" colSpan={5}>{t('common.total')}</td>
                <td className="td text-end tnum font-semibold text-rose-600">{money(sum(ar.map((x) => x.balance)))}</td>
                <td className="td" />
              </tr>
            }
          />
        )}

        {tab === 'payables' && (
          <DataTable
            rows={ap.map(({ purchase, balance }) => ({ ...purchase, balance }))}
            initialSort={{ key: 'bal', dir: 'desc' }}
            columns={[
              { key: 'no', header: t('pur.poNo'), sortValue: (p) => p.poNo, render: (p) => <span className="tnum font-medium">{p.poNo}</span> },
              { key: 'sup', header: t('common.supplier'), sortValue: (p) => supName(p.supplierId), render: (p) => <span>{supName(p.supplierId)}</span> },
              { key: 'date', header: t('common.date'), sortValue: (p) => p.date, render: (p) => <span className="text-ink-500">{date(p.date)}</span> },
              { key: 'total', header: t('common.total'), align: 'end', sortValue: (p) => purchaseTotal(p).total, render: (p) => <span className="tnum">{money(purchaseTotal(p).total)}</span> },
              { key: 'paid', header: t('common.paid'), align: 'end', sortValue: (p) => p.amountPaid, render: (p) => <span className="tnum text-emerald-600">{money(p.amountPaid)}</span> },
              { key: 'bal', header: t('common.balance'), align: 'end', sortValue: (p) => p.balance, render: (p) => <span className="tnum font-semibold text-rose-600">{money(p.balance)}</span> },
              { key: 'status', header: t('common.status'), render: (p) => <Badge tone={statusTone(p.status)}>{t(`pur.status.${p.status}` as never)}</Badge> },
            ]}
            footer={
              <tr>
                <td className="td font-medium" colSpan={5}>{t('common.total')}</td>
                <td className="td text-end tnum font-semibold text-rose-600">{money(sum(ap.map((x) => x.balance)))}</td>
                <td className="td" />
              </tr>
            }
          />
        )}
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && db.expenses.some((e) => e.id === editing.id) ? t('common.edit') : t('acc.newExpense')}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            <button className="btn-gold" onClick={async () => { if (editing) { await save('expenses', editing); setEditing(null) } }}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {editing && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('common.date')}>
              <input type="date" className="input" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            </Field>
            <Field label={t('common.category')}>
              <Select
                value={editing.category}
                onChange={(v) => setEditing({ ...editing, category: v as ExpenseCategory })}
                options={CATEGORIES.map((c) => ({ value: c, label: t(`acc.exp.${c}` as never) }))}
              />
            </Field>
            <Field label={t('common.details')} className="sm:col-span-2">
              <input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <Field label={t('common.total')}>
              <input type="number" step="0.01" className="input" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: +e.target.value })} />
            </Field>
            <Field label={t('acc.vendor')}>
              <input className="input" value={editing.vendor ?? ''} onChange={(e) => setEditing({ ...editing, vendor: e.target.value })} />
            </Field>
            <Field label={t('acc.method')}>
              <Select
                value={editing.paymentMethod}
                onChange={(v) => setEditing({ ...editing, paymentMethod: v as Expense['paymentMethod'] })}
                options={(['cash', 'card', 'transfer'] as const).map((m) => ({ value: m, label: m }))}
              />
            </Field>
            <Field label={t('acc.recurring')}>
              <label className="flex items-center gap-2 h-[38px]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-gold-500 focus:ring-gold-200"
                  checked={editing.recurring}
                  onChange={(e) => setEditing({ ...editing, recurring: e.target.checked })}
                />
                <span className="text-sm text-ink-600">{t('acc.recurring')}</span>
              </label>
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}
