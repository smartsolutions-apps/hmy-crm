import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { AlertTriangle, ArrowUpRight, Beaker, Package, ShoppingCart, Users } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import { Badge, Card, DataTable, MiniBar, PageHeader, StatCard, statusTone } from '@/components/ui'
import {
  accountsReceivable, analyseBatch, channelBreakdown, computePnL, inventoryValue,
  lowStockMaterials, lowStockProducts, monthlySeries, orderTotals, safeDiv, sum,
  topCustomers, topProducts,
} from '@/lib/calc'
import type { Order } from '@/types'

const PIE_COLORS = ['#cfa055', '#3e4048', '#7b7f8a', '#c5c7cd', '#89552c', '#a0a3ac', '#dcbd7e']

export default function Dashboard() {
  const { t, lang, money, moneyShort, num, percent, date } = useI18n()
  const { db } = useData()

  const series = useMemo(() => monthlySeries(db, 12), [db])
  const pnl = useMemo(() => computePnL(db), [db])
  const inv = useMemo(() => inventoryValue(db), [db])
  const ar = useMemo(() => accountsReceivable(db), [db])
  const channels = useMemo(() => channelBreakdown(db), [db])
  const best = useMemo(() => topProducts(db, 5), [db])
  const bestChartData = useMemo(
    () => best.map((b) => ({ name: b.product?.nameEn ?? '', revenue: b.revenue, profit: b.profit })),
    [best]
  )
  const bestCustomers = useMemo(() => topCustomers(db, 5), [db])

  const lowMats = lowStockMaterials(db.materials)
  const lowProds = lowStockProducts(db.products)

  const completedBatches = useMemo(
    () => db.batches.filter((b) => b.status === 'completed').map((b) => analyseBatch(b, db)),
    [db]
  )
  const activeBatches = useMemo(
    () => db.batches.filter((b) => b.status !== 'completed' && b.status !== 'cancelled'),
    [db]
  )
  const heavyLossBatches = completedBatches.filter(
    (a) => safeDiv(a.totalLossCost, a.totalBatchCost) > 0.05
  )

  const revenueOrders = db.orders.filter((o) => o.status !== 'cancelled' && o.status !== 'returned')
  const avgOrder = safeDiv(sum(revenueOrders.map((o) => orderTotals(o).total)), revenueOrders.length)

  const recent = [...db.orders].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8)
  const custName = (id: string) => db.customers.find((c) => c.id === id)?.name ?? '—'

  const chartMargin = { top: 8, right: 8, left: 0, bottom: 0 }

  return (
    <>
      <PageHeader title={t('dash.title')} subtitle={t('dash.subtitle')} />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('dash.revenue')} value={moneyShort(pnl.revenue)} hint={t('common.last12Months')} icon={<ArrowUpRight className="h-4 w-4" />} />
        <StatCard
          label={t('dash.grossProfit')}
          value={moneyShort(pnl.grossProfit)}
          hint={percent(pnl.grossMarginPct) + ' ' + t('common.margin').toLowerCase()}
          tone="good"
        />
        <StatCard
          label={t('dash.netProfit')}
          value={moneyShort(pnl.netProfit)}
          hint={percent(pnl.netMarginPct)}
          tone={pnl.netProfit >= 0 ? 'good' : 'bad'}
        />
        <StatCard label={t('dash.avgOrder')} value={money(avgOrder, 0)} hint={`${num(revenueOrders.length)} ${t('dash.orders').toLowerCase()}`} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label={t('dash.customers')} value={num(db.customers.length)} hint={`${num(db.customers.filter((c) => c.type === 'vip').length)} VIP`} icon={<Users className="h-4 w-4" />} />
        <StatCard label={t('dash.inventoryValue')} value={moneyShort(inv.total)} hint={`${moneyShort(inv.rawValue)} ${t('nav.materials').toLowerCase()}`} icon={<Beaker className="h-4 w-4" />} />
        <StatCard
          label={t('dash.productionLoss')}
          value={moneyShort(pnl.productionLoss)}
          hint={percent(safeDiv(pnl.productionLoss, sum(completedBatches.map((b) => b.totalBatchCost))) * 100) + ' ' + t('prod.lossRate').toLowerCase()}
          tone="bad"
        />
        <StatCard
          label={t('acc.receivables')}
          value={moneyShort(sum(ar.map((x) => x.balance)))}
          hint={`${num(ar.length)} ${t('orders.title').toLowerCase()}`}
          tone={ar.length ? 'warn' : 'default'}
          icon={<Package className="h-4 w-4" />}
        />
      </div>

      {/* alerts */}
      <Card title={t('dash.alerts')} className="mb-4">
        {lowMats.length + lowProds.length + heavyLossBatches.length === 0 && ar.length === 0 ? (
          <p className="text-sm text-ink-500">{t('dash.noAlerts')}</p>
        ) : (
          <ul className="space-y-2">
            {lowMats.length > 0 && (
              <li className="flex items-center gap-2.5 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-ink-700">{t('dash.alertLowMaterial', { n: lowMats.length })}</span>
                <Link to="/materials" className="link text-xs">{t('common.viewAll')}</Link>
              </li>
            )}
            {lowProds.length > 0 && (
              <li className="flex items-center gap-2.5 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-ink-700">{t('dash.alertLowProduct', { n: lowProds.length })}</span>
                <Link to="/products" className="link text-xs">{t('common.viewAll')}</Link>
              </li>
            )}
            {heavyLossBatches.length > 0 && (
              <li className="flex items-center gap-2.5 text-sm">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                <span className="text-ink-700">{t('dash.alertHighLoss', { n: heavyLossBatches.length })}</span>
                <Link to="/production" className="link text-xs">{t('common.viewAll')}</Link>
              </li>
            )}
            {ar.length > 0 && (
              <li className="flex items-center gap-2.5 text-sm">
                <AlertTriangle className="h-4 w-4 text-sky-500 shrink-0" />
                <span className="text-ink-700">
                  {t('dash.alertUnpaid', { n: ar.length, v: money(sum(ar.map((x) => x.balance)), 0) })}
                </span>
                <Link to="/accounting" className="link text-xs">{t('common.viewAll')}</Link>
              </li>
            )}
          </ul>
        )}
      </Card>

      {/* charts */}
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title={t('dash.revenueVsCost')} className="lg:col-span-2" bodyClassName="pt-2">
          <div style={{ direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={series} margin={chartMargin}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#cfa055" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#cfa055" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e3e6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7b7f8a' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#7b7f8a' }} tickLine={false} axisLine={false} width={54}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v: number) => money(v, 0)} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e3e6' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" name={t('common.revenue')} stroke="#cfa055" strokeWidth={2} fill="url(#gRev)" isAnimationActive={false} />
                <Area type="monotone" dataKey="grossProfit" name={t('dash.grossProfit')} stroke="#10b981" strokeWidth={2} fill="url(#gProfit)" isAnimationActive={false} />
                <Area type="monotone" dataKey="cogs" name={t('acc.cogs')} stroke="#7b7f8a" strokeWidth={1.5} fill="transparent" strokeDasharray="4 3" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('dash.salesByChannel')} bodyClassName="pt-2">
          <div style={{ direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={channels}
                  dataKey="revenue"
                  nameKey="channel"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {channels.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, n: string) => [money(v, 0), t(`orders.ch.${n}` as never)]}
                  contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e3e6' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1.5">
            {channels.map((c, i) => (
              <li key={c.channel} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-ink-600 flex-1 truncate">{t(`orders.ch.${c.channel}` as never)}</span>
                <span className="tnum text-ink-800 font-medium">{money(c.revenue, 0)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title={t('dash.topProducts')} actions={<Link to="/products" className="link text-xs">{t('common.viewAll')}</Link>}>
          <div style={{ direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bestChartData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e3e6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#7b7f8a' }} tickLine={false} axisLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#7b7f8a' }} tickLine={false} axisLine={false} width={50}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v: number) => money(v, 0)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name={t('common.revenue')} fill="#cfa055" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="profit" name={t('common.profit')} fill="#3e4048" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('dash.topCustomers')} actions={<Link to="/customers" className="link text-xs">{t('common.viewAll')}</Link>}>
          <ul className="space-y-3">
            {bestCustomers.map(({ customer, stats }) => (
              <li key={customer.id} className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gold-100 text-gold-800 grid place-items-center text-xs font-semibold shrink-0">
                  {customer.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={`/customers/${customer.id}`} className="text-sm font-medium text-ink-900 hover:text-gold-700 truncate block">
                    {lang === 'ar' && customer.nameAr ? customer.nameAr : customer.name}
                  </Link>
                  <p className="text-xs text-ink-400">
                    {customer.city} · {num(stats.orderCount)} {t('cust.orders').toLowerCase()}
                  </p>
                </div>
                <div className="text-end shrink-0">
                  <p className="text-sm font-semibold tnum text-ink-900">{money(stats.totalSpend, 0)}</p>
                  <p className="text-xs text-ink-400">{date(stats.lastOrderDate)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title={t('dash.recentOrders')} actions={<Link to="/orders" className="link text-xs">{t('common.viewAll')}</Link>} bodyClassName="pt-0 pb-0">
          <DataTable<Order>
            rows={recent}
            columns={[
              { key: 'no', header: t('orders.orderNo'), render: (o) => <span className="font-medium tnum">{o.orderNo}</span> },
              { key: 'cust', header: t('common.customer'), render: (o) => <span className="truncate block max-w-[140px]">{custName(o.customerId)}</span> },
              { key: 'date', header: t('common.date'), render: (o) => <span className="text-ink-500">{date(o.date)}</span> },
              { key: 'status', header: t('common.status'), render: (o) => <Badge tone={statusTone(o.status)}>{t(`orders.status.${o.status}` as never)}</Badge> },
              { key: 'total', header: t('common.total'), align: 'end', render: (o) => <span className="font-semibold tnum">{money(orderTotals(o).total, 0)}</span> },
            ]}
          />
        </Card>

        <Card title={t('dash.activeBatches')} actions={<Link to="/production" className="link text-xs">{t('common.viewAll')}</Link>}>
          {activeBatches.length === 0 ? (
            <p className="text-sm text-ink-500">{t('common.noResults')}</p>
          ) : (
            <ul className="space-y-3">
              {activeBatches.map((b) => {
                const p = db.products.find((x) => x.id === b.productId)
                return (
                  <li key={b.id}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900 truncate">
                          {lang === 'ar' && p?.nameAr ? p.nameAr : p?.nameEn}
                        </p>
                        <p className="text-xs text-ink-400 tnum">{b.batchNo} · {date(b.startDate)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge tone={statusTone(b.status)}>{t(`prod.status.${b.status}` as never)}</Badge>
                        <span className="text-sm tnum text-ink-700">{num(b.plannedUnits)}</span>
                      </div>
                    </div>
                    <MiniBar value={b.actualUnits} max={b.plannedUnits} />
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
