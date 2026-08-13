import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import { Badge, Card, DataTable, PageHeader, Select, StatCard } from '@/components/ui'
import {
  analyseBatch, buildCostMap, campaignStats, customerStats, inventoryValue,
  isRevenueOrder, orderTotals, pct, safeDiv, sum,
} from '@/lib/calc'

const REPORTS = [
  { value: 'sales', labelKey: 'rep.salesReport' },
  { value: 'products', labelKey: 'rep.productProfit' },
  { value: 'production', labelKey: 'rep.productionEfficiency' },
  { value: 'customers', labelKey: 'rep.customerValue' },
  { value: 'inventory', labelKey: 'rep.inventory' },
  { value: 'marketing', labelKey: 'rep.marketingRoi' },
] as const

export default function Reports() {
  const { t, lang, money, num, percent, date, qty } = useI18n()
  const { db } = useData()

  const [report, setReport] = useState<(typeof REPORTS)[number]['value']>('sales')
  const [period, setPeriod] = useState('12')

  const from = useMemo(() => {
    if (period === '0') return undefined
    const d = new Date()
    d.setMonth(d.getMonth() - Number(period))
    return d.toISOString().slice(0, 10)
  }, [period])

  const inRange = (d: string) => !from || d >= from
  const costMap = useMemo(() => buildCostMap(db), [db])

  const orders = db.orders.filter((o) => isRevenueOrder(o) && inRange(o.date))

  // ---- sales by month -----------------------------------------------------
  const salesRows = useMemo(() => {
    const acc = new Map<string, { orders: number; units: number; revenue: number; vat: number; cogs: number }>()
    for (const o of orders) {
      const k = o.date.slice(0, 7)
      const cur = acc.get(k) ?? { orders: 0, units: 0, revenue: 0, vat: 0, cogs: 0 }
      const totals = orderTotals(o)
      cur.orders += 1
      cur.units += sum(o.items.map((i) => i.qty))
      cur.revenue += totals.net
      cur.vat += totals.vat
      cur.cogs += sum(o.items.map((i) => i.qty * (costMap.get(i.productId) ?? 0)))
      acc.set(k, cur)
    }
    return [...acc.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([month, v]) => ({
        id: month,
        month,
        ...v,
        profit: v.revenue - v.cogs,
        marginPct: pct(v.revenue - v.cogs, v.revenue || 1),
        aov: safeDiv(v.revenue, v.orders),
      }))
  }, [orders, costMap])

  // ---- product profitability ---------------------------------------------
  const productRows = useMemo(() => {
    const acc = new Map<string, { units: number; revenue: number; cogs: number; orders: number }>()
    for (const o of orders) {
      for (const i of o.items) {
        const cur = acc.get(i.productId) ?? { units: 0, revenue: 0, cogs: 0, orders: 0 }
        cur.units += i.qty
        cur.revenue += i.qty * i.unitPrice - i.discount
        cur.cogs += i.qty * (costMap.get(i.productId) ?? 0)
        cur.orders += 1
        acc.set(i.productId, cur)
      }
    }
    return [...acc.entries()].map(([id, v]) => {
      const p = db.products.find((x) => x.id === id)
      return {
        id,
        name: p ? (lang === 'ar' ? p.nameAr : p.nameEn) : id,
        sku: p?.sku ?? '',
        stock: p?.stockQty ?? 0,
        ...v,
        profit: v.revenue - v.cogs,
        marginPct: pct(v.revenue - v.cogs, v.revenue || 1),
      }
    })
  }, [orders, costMap, db.products, lang])

  // ---- production efficiency ---------------------------------------------
  const productionRows = useMemo(() => {
    const acc = new Map<string, { batches: number; planned: number; produced: number; rejected: number; loss: number; cost: number }>()
    for (const b of db.batches.filter((x) => x.status === 'completed' && inRange(x.startDate))) {
      const a = analyseBatch(b, db)
      const cur = acc.get(b.productId) ?? { batches: 0, planned: 0, produced: 0, rejected: 0, loss: 0, cost: 0 }
      cur.batches += 1
      cur.planned += b.plannedUnits
      cur.produced += a.goodUnits
      cur.rejected += b.rejectedUnits
      cur.loss += a.totalLossCost
      cur.cost += a.totalBatchCost
      acc.set(b.productId, cur)
    }
    return [...acc.entries()].map(([id, v]) => {
      const p = db.products.find((x) => x.id === id)
      return {
        id,
        name: p ? (lang === 'ar' ? p.nameAr : p.nameEn) : id,
        ...v,
        yieldPct: pct(v.produced, v.planned || 1),
        lossPct: pct(v.loss, v.cost || 1),
        unitCost: safeDiv(v.cost, v.produced || 1),
      }
    })
  }, [db, from, lang])

  // ---- customer value ----------------------------------------------------
  const customerRows = useMemo(
    () =>
      db.customers
        .map((c) => {
          const stats = customerStats(c, db.orders)
          return {
            id: c.id,
            name: lang === 'ar' && c.nameAr ? c.nameAr : c.name,
            city: c.city,
            type: c.type,
            ...stats,
          }
        })
        .filter((c) => c.orderCount > 0),
    [db, lang]
  )

  // ---- inventory ---------------------------------------------------------
  const inv = inventoryValue(db)
  const inventoryRows = useMemo(
    () =>
      db.materials.map((m) => ({
        id: m.id,
        name: lang === 'ar' ? m.nameAr : m.nameEn,
        code: m.code,
        category: m.category,
        unit: m.unit,
        stockQty: m.stockQty,
        reorderLevel: m.reorderLevel,
        costPerUnit: m.costPerUnit,
        value: m.stockQty * m.costPerUnit,
        low: m.stockQty <= m.reorderLevel,
      })),
    [db.materials, lang]
  )

  // ---- marketing ---------------------------------------------------------
  const marketingRows = useMemo(
    () =>
      db.campaigns
        .filter((c) => inRange(c.startDate))
        .map((c) => ({ ...c, name: lang === 'ar' && c.nameAr ? c.nameAr : c.name, stats: campaignStats(c) })),
    [db.campaigns, from, lang]
  )

  const periodOptions = [
    { value: '3', label: t('common.last3Months') },
    { value: '6', label: t('common.last6Months') },
    { value: '12', label: t('common.last12Months') },
    { value: '0', label: t('common.allTime') },
  ]

  return (
    <>
      <PageHeader
        title={t('rep.title')}
        subtitle={t('rep.subtitle')}
        actions={
          <>
            <Select className="w-auto" value={report} onChange={(v) => setReport(v as typeof report)}
              options={REPORTS.map((r) => ({ value: r.value, label: t(r.labelKey) }))} />
            <Select className="w-auto" value={period} onChange={setPeriod} options={periodOptions} />
            <button className="btn-ghost" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              {t('common.print')}
            </button>
          </>
        }
      />

      {report === 'sales' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <StatCard label={t('common.revenue')} value={money(sum(salesRows.map((r) => r.revenue)), 0)} />
            <StatCard label={t('common.profit')} value={money(sum(salesRows.map((r) => r.profit)), 0)} tone="good" />
            <StatCard label={t('dash.orders')} value={num(sum(salesRows.map((r) => r.orders)))} />
            <StatCard label={t('dash.avgOrder')} value={money(safeDiv(sum(salesRows.map((r) => r.revenue)), sum(salesRows.map((r) => r.orders))), 0)} />
          </div>
          <Card title={t('rep.salesReport')} bodyClassName="pt-0 pb-0">
            <DataTable
              rows={salesRows}
              columns={[
                { key: 'month', header: t('common.date'), sortValue: (r) => r.month, render: (r) => <span className="font-medium tnum">{r.month}</span> },
                { key: 'orders', header: t('dash.orders'), align: 'end', sortValue: (r) => r.orders, render: (r) => <span className="tnum">{num(r.orders)}</span> },
                { key: 'units', header: t('common.units'), align: 'end', sortValue: (r) => r.units, render: (r) => <span className="tnum">{num(r.units)}</span> },
                { key: 'rev', header: t('common.revenue'), align: 'end', sortValue: (r) => r.revenue, render: (r) => <span className="tnum font-medium">{money(r.revenue, 0)}</span> },
                { key: 'cogs', header: t('acc.cogs'), align: 'end', sortValue: (r) => r.cogs, render: (r) => <span className="tnum text-ink-500">{money(r.cogs, 0)}</span> },
                { key: 'profit', header: t('common.profit'), align: 'end', sortValue: (r) => r.profit, render: (r) => <span className="tnum text-emerald-600 font-medium">{money(r.profit, 0)}</span> },
                { key: 'margin', header: t('common.margin'), align: 'end', sortValue: (r) => r.marginPct, render: (r) => <span className="tnum">{percent(r.marginPct)}</span> },
                { key: 'aov', header: t('dash.avgOrder'), align: 'end', sortValue: (r) => r.aov, render: (r) => <span className="tnum text-ink-500">{money(r.aov, 0)}</span> },
                { key: 'vat', header: t('common.vat'), align: 'end', sortValue: (r) => r.vat, render: (r) => <span className="tnum text-ink-500">{money(r.vat, 0)}</span> },
              ]}
              footer={
                <tr>
                  <td className="td font-medium">{t('common.total')}</td>
                  <td className="td text-end tnum">{num(sum(salesRows.map((r) => r.orders)))}</td>
                  <td className="td text-end tnum">{num(sum(salesRows.map((r) => r.units)))}</td>
                  <td className="td text-end tnum font-semibold">{money(sum(salesRows.map((r) => r.revenue)), 0)}</td>
                  <td className="td text-end tnum">{money(sum(salesRows.map((r) => r.cogs)), 0)}</td>
                  <td className="td text-end tnum font-semibold text-emerald-600">{money(sum(salesRows.map((r) => r.profit)), 0)}</td>
                  <td className="td" colSpan={3} />
                </tr>
              }
            />
          </Card>
        </>
      )}

      {report === 'products' && (
        <Card title={t('rep.productProfit')} bodyClassName="pt-0 pb-0">
          <DataTable
            rows={productRows}
            initialSort={{ key: 'profit', dir: 'desc' }}
            columns={[
              { key: 'name', header: t('common.product'), sortValue: (r) => r.name, render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-ink-400 tnum">{r.sku}</p></div> },
              { key: 'units', header: t('common.units'), align: 'end', sortValue: (r) => r.units, render: (r) => <span className="tnum">{num(r.units)}</span> },
              { key: 'rev', header: t('common.revenue'), align: 'end', sortValue: (r) => r.revenue, render: (r) => <span className="tnum font-medium">{money(r.revenue, 0)}</span> },
              { key: 'cogs', header: t('acc.cogs'), align: 'end', sortValue: (r) => r.cogs, render: (r) => <span className="tnum text-ink-500">{money(r.cogs, 0)}</span> },
              { key: 'profit', header: t('common.profit'), align: 'end', sortValue: (r) => r.profit, render: (r) => <span className="tnum text-emerald-600 font-medium">{money(r.profit, 0)}</span> },
              { key: 'margin', header: t('common.margin'), align: 'end', sortValue: (r) => r.marginPct, render: (r) => <span className={r.marginPct >= 60 ? 'tnum text-emerald-600' : 'tnum text-amber-600'}>{percent(r.marginPct)}</span> },
              { key: 'stock', header: t('common.stock'), align: 'end', sortValue: (r) => r.stock, render: (r) => <span className="tnum text-ink-500">{num(r.stock)}</span> },
            ]}
            footer={
              <tr>
                <td className="td font-medium">{t('common.total')}</td>
                <td className="td text-end tnum">{num(sum(productRows.map((r) => r.units)))}</td>
                <td className="td text-end tnum font-semibold">{money(sum(productRows.map((r) => r.revenue)), 0)}</td>
                <td className="td text-end tnum">{money(sum(productRows.map((r) => r.cogs)), 0)}</td>
                <td className="td text-end tnum font-semibold text-emerald-600">{money(sum(productRows.map((r) => r.profit)), 0)}</td>
                <td className="td" colSpan={2} />
              </tr>
            }
          />
        </Card>
      )}

      {report === 'production' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <StatCard label={t('prod.totalProduced')} value={num(sum(productionRows.map((r) => r.produced)))} />
            <StatCard label={t('prod.avgYield')} value={percent(safeDiv(sum(productionRows.map((r) => r.produced)), sum(productionRows.map((r) => r.planned))) * 100)} tone="good" />
            <StatCard label={t('prod.totalLossValue')} value={money(sum(productionRows.map((r) => r.loss)), 0)} tone="bad" />
            <StatCard label={t('prod.rejected')} value={num(sum(productionRows.map((r) => r.rejected)))} tone="warn" />
          </div>
          <Card title={t('rep.productionEfficiency')} bodyClassName="pt-0 pb-0">
            <DataTable
              rows={productionRows}
              initialSort={{ key: 'loss', dir: 'desc' }}
              columns={[
                { key: 'name', header: t('common.product'), sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
                { key: 'batches', header: t('prod.batchNo'), align: 'end', sortValue: (r) => r.batches, render: (r) => <span className="tnum">{num(r.batches)}</span> },
                { key: 'planned', header: t('prod.planned'), align: 'end', sortValue: (r) => r.planned, render: (r) => <span className="tnum text-ink-500">{num(r.planned)}</span> },
                { key: 'produced', header: t('prod.good'), align: 'end', sortValue: (r) => r.produced, render: (r) => <span className="tnum font-medium">{num(r.produced)}</span> },
                { key: 'yield', header: t('prod.yield'), align: 'end', sortValue: (r) => r.yieldPct, render: (r) => <span className={r.yieldPct >= 95 ? 'tnum text-emerald-600' : 'tnum text-amber-600'}>{percent(r.yieldPct)}</span> },
                { key: 'rejected', header: t('prod.rejected'), align: 'end', sortValue: (r) => r.rejected, render: (r) => <span className="tnum text-rose-600">{num(r.rejected)}</span> },
                { key: 'loss', header: t('prod.totalLoss'), align: 'end', sortValue: (r) => r.loss, render: (r) => <span className="tnum font-semibold text-rose-600">{money(r.loss, 0)}</span> },
                { key: 'lossPct', header: t('prod.lossRate'), align: 'end', sortValue: (r) => r.lossPct, render: (r) => <span className={r.lossPct > 5 ? 'tnum text-rose-600 font-medium' : 'tnum text-ink-500'}>{percent(r.lossPct)}</span> },
                { key: 'unitCost', header: t('prod.actualUnitCost'), align: 'end', sortValue: (r) => r.unitCost, render: (r) => <span className="tnum">{money(r.unitCost)}</span> },
              ]}
            />
          </Card>
        </>
      )}

      {report === 'customers' && (
        <Card title={t('rep.customerValue')} bodyClassName="pt-0 pb-0">
          <DataTable
            rows={customerRows}
            initialSort={{ key: 'ltv', dir: 'desc' }}
            columns={[
              { key: 'name', header: t('common.name'), sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'type', header: t('common.type'), sortValue: (r) => r.type, render: (r) => <Badge tone={r.type === 'vip' ? 'gold' : r.type === 'wholesale' ? 'blue' : 'neutral'}>{t(`cust.type.${r.type}` as never)}</Badge> },
              { key: 'city', header: t('common.city'), sortValue: (r) => r.city, render: (r) => <span className="text-ink-600">{r.city}</span> },
              { key: 'orders', header: t('cust.orders'), align: 'end', sortValue: (r) => r.orderCount, render: (r) => <span className="tnum">{num(r.orderCount)}</span> },
              { key: 'ltv', header: t('cust.totalSpend'), align: 'end', sortValue: (r) => r.totalSpend, render: (r) => <span className="tnum font-semibold">{money(r.totalSpend, 0)}</span> },
              { key: 'aov', header: t('cust.avgOrder'), align: 'end', sortValue: (r) => r.avgOrderValue, render: (r) => <span className="tnum text-ink-500">{money(r.avgOrderValue, 0)}</span> },
              { key: 'out', header: t('cust.outstanding'), align: 'end', sortValue: (r) => r.outstanding, render: (r) => r.outstanding > 0.5 ? <span className="tnum text-rose-600">{money(r.outstanding, 0)}</span> : <span className="text-ink-300">—</span> },
              { key: 'last', header: t('cust.lastOrder'), sortValue: (r) => r.lastOrderDate ?? '', render: (r) => <span className="text-xs text-ink-500">{date(r.lastOrderDate)}</span> },
            ]}
          />
        </Card>
      )}

      {report === 'inventory' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
            <StatCard label={t('materials.totalValue')} value={money(inv.rawValue, 0)} />
            <StatCard label={t('nav.products')} value={money(inv.finishedValue, 0)} />
            <StatCard label={t('dash.inventoryValue')} value={money(inv.total, 0)} tone="good" />
            <StatCard label={t('dash.lowStock')} value={num(inventoryRows.filter((r) => r.low).length)} tone="warn" />
          </div>
          <Card title={t('rep.inventory')} bodyClassName="pt-0 pb-0">
            <DataTable
              rows={inventoryRows}
              initialSort={{ key: 'value', dir: 'desc' }}
              columns={[
                { key: 'name', header: t('common.material'), sortValue: (r) => r.name, render: (r) => <div><p className="font-medium">{r.name}</p><p className="text-xs text-ink-400 tnum">{r.code}</p></div> },
                { key: 'cat', header: t('common.category'), sortValue: (r) => r.category, render: (r) => <Badge>{t(`materials.cat.${r.category}` as never)}</Badge> },
                { key: 'stock', header: t('common.stock'), align: 'end', sortValue: (r) => r.stockQty, render: (r) => <span className={r.low ? 'tnum text-rose-600 font-medium' : 'tnum'}>{qty(r.stockQty, r.unit)}</span> },
                { key: 'reorder', header: t('materials.reorder'), align: 'end', sortValue: (r) => r.reorderLevel, render: (r) => <span className="tnum text-ink-400">{num(r.reorderLevel)}</span> },
                { key: 'cost', header: t('materials.costPerUnit'), align: 'end', sortValue: (r) => r.costPerUnit, render: (r) => <span className="tnum text-ink-500">{money(r.costPerUnit, r.costPerUnit < 1 ? 3 : 2)}</span> },
                { key: 'value', header: t('materials.stockValue'), align: 'end', sortValue: (r) => r.value, render: (r) => <span className="tnum font-semibold">{money(r.value, 0)}</span> },
              ]}
              footer={
                <tr>
                  <td className="td font-medium" colSpan={5}>{t('common.total')}</td>
                  <td className="td text-end tnum font-semibold">{money(sum(inventoryRows.map((r) => r.value)), 0)}</td>
                </tr>
              }
            />
          </Card>
        </>
      )}

      {report === 'marketing' && (
        <Card title={t('rep.marketingRoi')} bodyClassName="pt-0 pb-0">
          <DataTable
            rows={marketingRows}
            initialSort={{ key: 'roas', dir: 'desc' }}
            columns={[
              { key: 'name', header: t('mkt.campaigns'), sortValue: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
              { key: 'ch', header: t('common.channel'), sortValue: (r) => r.channel, render: (r) => <Badge tone="gold">{t(`mkt.ch.${r.channel}` as never)}</Badge> },
              { key: 'spend', header: t('mkt.spend'), align: 'end', sortValue: (r) => r.spend, render: (r) => <span className="tnum">{money(r.spend, 0)}</span> },
              { key: 'rev', header: t('common.revenue'), align: 'end', sortValue: (r) => r.revenue, render: (r) => <span className="tnum font-medium">{money(r.revenue, 0)}</span> },
              { key: 'profit', header: t('common.profit'), align: 'end', sortValue: (r) => r.stats.profit, render: (r) => <span className={r.stats.profit >= 0 ? 'tnum text-emerald-600' : 'tnum text-rose-600'}>{money(r.stats.profit, 0)}</span> },
              { key: 'roas', header: t('mkt.roas'), align: 'end', sortValue: (r) => r.stats.roas, render: (r) => <span className={r.stats.roas >= 2 ? 'tnum font-semibold text-emerald-600' : 'tnum text-amber-600'}>{num(r.stats.roas, 2)}×</span> },
              { key: 'leads', header: t('mkt.leadsCount'), align: 'end', sortValue: (r) => r.leads, render: (r) => <span className="tnum">{num(r.leads)}</span> },
              { key: 'cpl', header: t('mkt.cpl'), align: 'end', sortValue: (r) => r.stats.cpl, render: (r) => <span className="tnum text-ink-500">{money(r.stats.cpl, 0)}</span> },
              { key: 'cpa', header: t('mkt.cpa'), align: 'end', sortValue: (r) => r.stats.cpa, render: (r) => <span className="tnum text-ink-500">{money(r.stats.cpa, 0)}</span> },
            ]}
            footer={
              <tr>
                <td className="td font-medium" colSpan={2}>{t('common.total')}</td>
                <td className="td text-end tnum font-semibold">{money(sum(marketingRows.map((r) => r.spend)), 0)}</td>
                <td className="td text-end tnum font-semibold">{money(sum(marketingRows.map((r) => r.revenue)), 0)}</td>
                <td className="td text-end tnum font-semibold text-emerald-600">{money(sum(marketingRows.map((r) => r.stats.profit)), 0)}</td>
                <td className="td text-end tnum font-semibold">{num(safeDiv(sum(marketingRows.map((r) => r.revenue)), sum(marketingRows.map((r) => r.spend))), 2)}×</td>
                <td className="td" colSpan={3} />
              </tr>
            }
          />
        </Card>
      )}
    </>
  )
}
