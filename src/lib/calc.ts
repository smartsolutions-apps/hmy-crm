import type {
  Campaign,
  ConsumptionLine,
  Customer,
  Database,
  Expense,
  Formula,
  Material,
  Order,
  Product,
  ProductionBatch,
  Purchase,
} from '@/types'

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export const byId = <T extends { id: string }>(xs: T[]) => {
  const m = new Map<string, T>()
  for (const x of xs) m.set(x.id, x)
  return m
}

export const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b)

export const pct = (a: number, b: number) => safeDiv(a, b) * 100

export const monthKey = (iso: string) => iso.slice(0, 7) // "2026-08"

// ---------------------------------------------------------------------------
// Product costing — roll the formula up into a unit cost
// ---------------------------------------------------------------------------

export interface CostBreakdownLine {
  materialId: string
  materialName: string
  category: Material['category']
  unit: Material['unit']
  qtyPerUnit: number
  costPerUnit: number
  lineCost: number
}

export interface ProductCost {
  lines: CostBreakdownLine[]
  /** Cost of the juice only (oils, alcohol, fixatives). */
  juiceCost: number
  /** Bottle, cap, box, label. */
  packagingCost: number
  /** juice + packaging, before the formula's expected loss allowance. */
  materialCost: number
  /** materialCost inflated by the formula's expected loss rate. */
  totalUnitCost: number
}

export function computeProductCost(
  product: Product,
  formulas: Formula[],
  materials: Material[]
): ProductCost {
  const empty: ProductCost = {
    lines: [],
    juiceCost: 0,
    packagingCost: 0,
    materialCost: 0,
    totalUnitCost: 0,
  }
  if (!product.formulaId) return empty

  const formula = formulas.find((f) => f.id === product.formulaId)
  if (!formula) return empty

  const mMap = byId(materials)
  const packaging: Material['category'][] = ['bottle', 'cap', 'box', 'label']

  const lines: CostBreakdownLine[] = []
  for (const fl of formula.lines) {
    const m = mMap.get(fl.materialId)
    if (!m) continue
    lines.push({
      materialId: m.id,
      materialName: m.nameEn,
      category: m.category,
      unit: m.unit,
      qtyPerUnit: fl.qtyPerUnit,
      costPerUnit: m.costPerUnit,
      lineCost: fl.qtyPerUnit * m.costPerUnit,
    })
  }

  const juiceCost = sum(lines.filter((l) => !packaging.includes(l.category)).map((l) => l.lineCost))
  const packagingCost = sum(lines.filter((l) => packaging.includes(l.category)).map((l) => l.lineCost))
  const materialCost = juiceCost + packagingCost

  return {
    lines,
    juiceCost,
    packagingCost,
    materialCost,
    totalUnitCost: materialCost * (1 + formula.expectedLossRate),
  }
}

export function productMargin(product: Product, unitCost: number) {
  const profit = product.price - unitCost
  return { profit, marginPct: pct(profit, product.price || 1) }
}

// ---------------------------------------------------------------------------
// Production analysis — the "what did we lose?" engine
// ---------------------------------------------------------------------------

export interface MaterialVariance {
  materialId: string
  materialName: string
  unit: Material['unit']
  expectedQty: number
  actualQty: number
  /** Positive = we burned more than the formula allows. */
  varianceQty: number
  variancePct: number
  costPerUnit: number
  /** Positive = money lost. */
  varianceCost: number
}

export interface BatchAnalysis {
  batch: ProductionBatch
  productName: string
  /** Good units that passed QC. */
  goodUnits: number
  /** actualUnits vs plannedUnits. */
  yieldPct: number
  /** goodUnits vs actualUnits — how much QC threw away. */
  qcPassPct: number
  variances: MaterialVariance[]
  /** Sum of positive material variance cost only (true overspend). */
  materialLossCost: number
  /** Net material variance including favourable savings. */
  netVarianceCost: number
  /** Cost of units produced then rejected by QC. */
  rejectLossCost: number
  /** materialLossCost + rejectLossCost */
  totalLossCost: number
  /** Everything the batch consumed: materials actually issued + labour + overhead. */
  totalBatchCost: number
  /** totalBatchCost spread over good units. */
  actualUnitCost: number
  /** What the formula said a unit should cost. */
  standardUnitCost: number
  unitCostVariance: number
}

export function analyseBatch(
  batch: ProductionBatch,
  db: Pick<Database, 'products' | 'formulas' | 'materials'>
): BatchAnalysis {
  const mMap = byId(db.materials)
  const product = db.products.find((p) => p.id === batch.productId)
  const formula = db.formulas.find((f) => f.id === batch.formulaId)

  const goodUnits = Math.max(0, batch.actualUnits - batch.rejectedUnits)

  const variances: MaterialVariance[] = batch.consumption.map((c: ConsumptionLine) => {
    const m = mMap.get(c.materialId)
    const varianceQty = c.actualQty - c.expectedQty
    return {
      materialId: c.materialId,
      materialName: m?.nameEn ?? c.materialId,
      unit: m?.unit ?? 'pcs',
      expectedQty: c.expectedQty,
      actualQty: c.actualQty,
      varianceQty,
      variancePct: pct(varianceQty, c.expectedQty || 1),
      costPerUnit: m?.costPerUnit ?? 0,
      varianceCost: varianceQty * (m?.costPerUnit ?? 0),
    }
  })

  const materialLossCost = sum(variances.filter((v) => v.varianceCost > 0).map((v) => v.varianceCost))
  const netVarianceCost = sum(variances.map((v) => v.varianceCost))

  const actualMaterialCost = sum(
    batch.consumption.map((c) => c.actualQty * (mMap.get(c.materialId)?.costPerUnit ?? 0))
  )
  const totalBatchCost = actualMaterialCost + batch.labourCost + batch.overheadCost

  const standardUnitCost = product
    ? computeProductCost(product, formula ? [formula] : db.formulas, db.materials).totalUnitCost
    : 0

  const rejectLossCost = batch.rejectedUnits * safeDiv(totalBatchCost, batch.actualUnits || 1)
  const actualUnitCost = safeDiv(totalBatchCost, goodUnits || 1)

  return {
    batch,
    productName: product?.nameEn ?? '—',
    goodUnits,
    yieldPct: pct(batch.actualUnits, batch.plannedUnits || 1),
    qcPassPct: pct(goodUnits, batch.actualUnits || 1),
    variances,
    materialLossCost,
    netVarianceCost,
    rejectLossCost,
    totalLossCost: materialLossCost + rejectLossCost,
    totalBatchCost,
    actualUnitCost,
    standardUnitCost,
    unitCostVariance: actualUnitCost - standardUnitCost,
  }
}

/** Build the expected consumption lines for a batch straight from its formula. */
export function expectedConsumption(formula: Formula, units: number): ConsumptionLine[] {
  return formula.lines.map((l) => ({
    materialId: l.materialId,
    expectedQty: +(l.qtyPerUnit * units).toFixed(3),
    actualQty: +(l.qtyPerUnit * units).toFixed(3),
  }))
}

// ---------------------------------------------------------------------------
// Orders & revenue
// ---------------------------------------------------------------------------

export interface OrderTotals {
  subtotal: number
  lineDiscounts: number
  orderDiscount: number
  net: number
  vat: number
  shipping: number
  total: number
  balance: number
}

export function orderTotals(order: Order): OrderTotals {
  const subtotal = sum(order.items.map((i) => i.qty * i.unitPrice))
  const lineDiscounts = sum(order.items.map((i) => i.discount))
  const net = Math.max(0, subtotal - lineDiscounts - order.orderDiscount)
  const vat = net * order.vatRate
  const total = net + vat + order.shipping
  return {
    subtotal,
    lineDiscounts,
    orderDiscount: order.orderDiscount,
    net,
    vat,
    shipping: order.shipping,
    total,
    balance: total - order.amountPaid,
  }
}

/** Orders that represent real, recognised revenue. */
export const isRevenueOrder = (o: Order) => o.status !== 'cancelled' && o.status !== 'returned'

export function orderCogs(order: Order, costMap: Map<string, number>) {
  return sum(order.items.map((i) => i.qty * (costMap.get(i.productId) ?? 0)))
}

export function buildCostMap(db: Pick<Database, 'products' | 'formulas' | 'materials'>) {
  const m = new Map<string, number>()
  for (const p of db.products) {
    m.set(p.id, computeProductCost(p, db.formulas, db.materials).totalUnitCost)
  }
  return m
}

// ---------------------------------------------------------------------------
// Purchases
// ---------------------------------------------------------------------------

export function purchaseTotal(p: Purchase) {
  const goods = sum(p.items.map((i) => i.qty * i.unitCost))
  const total = goods + p.shipping + p.customsDuty
  return { goods, total, balance: total - p.amountPaid }
}

// ---------------------------------------------------------------------------
// Accounting
// ---------------------------------------------------------------------------

export interface PnL {
  revenue: number
  vatCollected: number
  shippingIncome: number
  cogs: number
  grossProfit: number
  grossMarginPct: number
  productionLoss: number
  expenses: number
  expensesByCategory: Record<string, number>
  netProfit: number
  netMarginPct: number
}

export function computePnL(db: Database, from?: string, to?: string): PnL {
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to)

  const costMap = buildCostMap(db)
  const orders = db.orders.filter((o) => isRevenueOrder(o) && inRange(o.date))

  let revenue = 0
  let vatCollected = 0
  let shippingIncome = 0
  let cogs = 0
  for (const o of orders) {
    const t = orderTotals(o)
    revenue += t.net
    vatCollected += t.vat
    shippingIncome += t.shipping
    cogs += orderCogs(o, costMap)
  }

  const productionLoss = sum(
    db.batches
      .filter((b) => b.status === 'completed' && inRange(b.startDate))
      .map((b) => analyseBatch(b, db).totalLossCost)
  )

  const expensesByCategory: Record<string, number> = {}
  let expenses = 0
  for (const e of db.expenses.filter((e) => inRange(e.date))) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + e.amount
    expenses += e.amount
  }

  const grossProfit = revenue - cogs
  const netProfit = grossProfit - expenses - productionLoss

  return {
    revenue,
    vatCollected,
    shippingIncome,
    cogs,
    grossProfit,
    grossMarginPct: pct(grossProfit, revenue || 1),
    productionLoss,
    expenses,
    expensesByCategory,
    netProfit,
    netMarginPct: pct(netProfit, revenue || 1),
  }
}

export function accountsReceivable(db: Database) {
  return db.orders
    .filter((o) => isRevenueOrder(o) && o.paymentStatus !== 'paid')
    .map((o) => ({ order: o, balance: orderTotals(o).balance }))
    .filter((x) => x.balance > 0.01)
}

export function accountsPayable(db: Database) {
  return db.purchases
    .filter((p) => p.status !== 'cancelled' && p.paymentStatus !== 'paid')
    .map((p) => ({ purchase: p, balance: purchaseTotal(p).balance }))
    .filter((x) => x.balance > 0.01)
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface CustomerStats {
  orderCount: number
  totalSpend: number
  avgOrderValue: number
  lastOrderDate: string | null
  outstanding: number
}

export function customerStats(customer: Customer, orders: Order[]): CustomerStats {
  const mine = orders.filter((o) => o.customerId === customer.id && isRevenueOrder(o))
  const totals = mine.map(orderTotals)
  const totalSpend = sum(totals.map((t) => t.total))
  const dates = mine.map((o) => o.date).sort()
  return {
    orderCount: mine.length,
    totalSpend,
    avgOrderValue: safeDiv(totalSpend, mine.length),
    lastOrderDate: dates.length ? dates[dates.length - 1] : null,
    outstanding: sum(totals.map((t) => Math.max(0, t.balance))),
  }
}

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

export interface CampaignStats {
  roas: number
  cpl: number
  cpa: number
  ctr: number
  conversionRate: number
  profit: number
  budgetUsedPct: number
}

export function campaignStats(c: Campaign): CampaignStats {
  return {
    roas: safeDiv(c.revenue, c.spend),
    cpl: safeDiv(c.spend, c.leads),
    cpa: safeDiv(c.spend, c.orders),
    ctr: pct(c.clicks, c.impressions || 1),
    conversionRate: pct(c.orders, c.clicks || 1),
    profit: c.revenue - c.spend,
    budgetUsedPct: pct(c.spend, c.budget || 1),
  }
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export const lowStockMaterials = (materials: Material[]) =>
  materials.filter((m) => m.stockQty <= m.reorderLevel)

export const lowStockProducts = (products: Product[]) =>
  products.filter((p) => p.status === 'active' && p.stockQty <= p.reorderLevel)

export function inventoryValue(db: Pick<Database, 'materials' | 'products' | 'formulas'>) {
  const rawValue = sum(db.materials.map((m) => m.stockQty * m.costPerUnit))
  const costMap = buildCostMap(db as Database)
  const finishedValue = sum(db.products.map((p) => p.stockQty * (costMap.get(p.id) ?? 0)))
  return { rawValue, finishedValue, total: rawValue + finishedValue }
}

// ---------------------------------------------------------------------------
// Time series
// ---------------------------------------------------------------------------

export function monthlySeries(db: Database, months: number) {
  const costMap = buildCostMap(db)
  const keys: string[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return keys.map((k) => {
    const orders = db.orders.filter((o) => isRevenueOrder(o) && monthKey(o.date) === k)
    const revenue = sum(orders.map((o) => orderTotals(o).net))
    const cogs = sum(orders.map((o) => orderCogs(o, costMap)))
    const expenses = sum(db.expenses.filter((e) => monthKey(e.date) === k).map((e) => e.amount))
    const marketing = sum(
      db.campaigns
        .filter((c) => monthKey(c.startDate) === k)
        .map((c) => c.spend)
    )
    const units = sum(orders.flatMap((o) => o.items.map((i) => i.qty)))
    return {
      month: k,
      label: k.slice(5) + '/' + k.slice(2, 4),
      revenue: +revenue.toFixed(2),
      cogs: +cogs.toFixed(2),
      grossProfit: +(revenue - cogs).toFixed(2),
      netProfit: +(revenue - cogs - expenses).toFixed(2),
      expenses: +expenses.toFixed(2),
      marketing: +marketing.toFixed(2),
      orders: orders.length,
      units,
    }
  })
}

export function topProducts(db: Database, limit = 5) {
  const costMap = buildCostMap(db)
  const acc = new Map<string, { units: number; revenue: number; profit: number }>()
  for (const o of db.orders.filter(isRevenueOrder)) {
    for (const i of o.items) {
      const cur = acc.get(i.productId) ?? { units: 0, revenue: 0, profit: 0 }
      const rev = i.qty * i.unitPrice - i.discount
      cur.units += i.qty
      cur.revenue += rev
      cur.profit += rev - i.qty * (costMap.get(i.productId) ?? 0)
      acc.set(i.productId, cur)
    }
  }
  return [...acc.entries()]
    .map(([productId, v]) => ({
      productId,
      product: db.products.find((p) => p.id === productId),
      ...v,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

export function topCustomers(db: Database, limit = 5) {
  return db.customers
    .map((c) => ({ customer: c, stats: customerStats(c, db.orders) }))
    .sort((a, b) => b.stats.totalSpend - a.stats.totalSpend)
    .slice(0, limit)
}

export function channelBreakdown(db: Database) {
  const acc = new Map<string, { orders: number; revenue: number }>()
  for (const o of db.orders.filter(isRevenueOrder)) {
    const cur = acc.get(o.channel) ?? { orders: 0, revenue: 0 }
    cur.orders += 1
    cur.revenue += orderTotals(o).net
    acc.set(o.channel, cur)
  }
  return [...acc.entries()]
    .map(([channel, v]) => ({ channel, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
}
