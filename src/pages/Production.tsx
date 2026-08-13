import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Download, Info, Plus, TrendingDown } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import {
  Badge, Card, DataTable, Field, Modal, PageHeader, SearchInput,
  Select, StatCard, exportCsv, statusTone,
} from '@/components/ui'
import { analyseBatch, expectedConsumption, monthKey, safeDiv, sum } from '@/lib/calc'
import type { ProductionBatch } from '@/types'

export default function Production() {
  const { t, lang, money, num, percent, date, qty } = useI18n()
  const { db, save } = useData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProductionBatch | null>(null)

  const analyses = useMemo(() => db.batches.map((b) => analyseBatch(b, db)), [db])

  const filtered = analyses.filter((a) => {
    const q = search.toLowerCase()
    const matchQ = !q || a.batch.batchNo.toLowerCase().includes(q) || a.productName.toLowerCase().includes(q)
    return matchQ && (status === 'all' || a.batch.status === status)
  })

  // Memoised: this feeds the chart's `data` prop, and a fresh array on every
  // render makes Recharts restart its animation forever (bars stay at zero).
  const completed = useMemo(
    () => analyses.filter((a) => a.batch.status === 'completed'),
    [analyses]
  )
  const totalProduced = sum(completed.map((a) => a.goodUnits))
  const totalLoss = sum(completed.map((a) => a.totalLossCost))
  const totalBatchCost = sum(completed.map((a) => a.totalBatchCost))
  const avgYield = safeDiv(sum(completed.map((a) => a.yieldPct)), completed.length)
  const lossRate = safeDiv(totalLoss, totalBatchCost) * 100

  // Where the money actually leaks, aggregated across every completed batch.
  const lossByMaterial = useMemo(() => {
    const acc = new Map<string, { name: string; unit: string; qty: number; cost: number }>()
    for (const a of completed) {
      for (const v of a.variances) {
        if (v.varianceCost <= 0) continue
        const cur = acc.get(v.materialId) ?? { name: v.materialName, unit: v.unit, qty: 0, cost: 0 }
        cur.qty += v.varianceQty
        cur.cost += v.varianceCost
        acc.set(v.materialId, cur)
      }
    }
    return [...acc.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.cost - a.cost)
  }, [completed])

  // Monthly output vs loss.
  const monthly = useMemo(() => {
    const acc = new Map<string, { units: number; loss: number; cost: number; yieldSum: number; n: number }>()
    for (const a of completed) {
      const k = monthKey(a.batch.startDate)
      const cur = acc.get(k) ?? { units: 0, loss: 0, cost: 0, yieldSum: 0, n: 0 }
      cur.units += a.goodUnits
      cur.loss += a.totalLossCost
      cur.cost += a.totalBatchCost
      cur.yieldSum += a.yieldPct
      cur.n += 1
      acc.set(k, cur)
    }
    return [...acc.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => ({
        label: k.slice(5) + '/' + k.slice(2, 4),
        units: v.units,
        loss: +v.loss.toFixed(0),
        lossRate: +safeDiv(v.loss, v.cost).toFixed(4) * 100,
        yieldPct: +safeDiv(v.yieldSum, v.n).toFixed(1),
      }))
  }, [completed])

  const detail = detailId ? analyses.find((a) => a.batch.id === detailId) : null

  const newBatch = (): ProductionBatch => {
    const product = db.products[0]
    const formula = db.formulas.find((f) => f.id === product?.formulaId) ?? db.formulas[0]
    return {
      id: `bch-${Date.now()}`,
      batchNo: `B-${new Date().toISOString().slice(2, 4)}${new Date().toISOString().slice(5, 7)}-NEW`,
      productId: product?.id ?? '',
      formulaId: formula?.id ?? '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: null,
      status: 'planned',
      plannedUnits: 100,
      actualUnits: 0,
      rejectedUnits: 0,
      consumption: formula ? expectedConsumption(formula, 100) : [],
      labourCost: 0,
      overheadCost: 0,
    }
  }

  return (
    <>
      <PageHeader
        title={t('prod.title')}
        subtitle={t('prod.subtitle')}
        actions={
          <>
            <button
              className="btn-ghost"
              onClick={() =>
                exportCsv('production-batches.csv', filtered.map((a) => ({
                  batch: a.batch.batchNo, product: a.productName, start: a.batch.startDate,
                  status: a.batch.status, planned: a.batch.plannedUnits, produced: a.batch.actualUnits,
                  rejected: a.batch.rejectedUnits, good: a.goodUnits,
                  yield_pct: +a.yieldPct.toFixed(1), qc_pass_pct: +a.qcPassPct.toFixed(1),
                  material_loss_aed: +a.materialLossCost.toFixed(2),
                  reject_loss_aed: +a.rejectLossCost.toFixed(2),
                  total_loss_aed: +a.totalLossCost.toFixed(2),
                  batch_cost_aed: +a.totalBatchCost.toFixed(2),
                  actual_unit_cost_aed: +a.actualUnitCost.toFixed(2),
                  standard_unit_cost_aed: +a.standardUnitCost.toFixed(2),
                })))
              }
            >
              <Download className="h-4 w-4" />
              {t('common.export')}
            </button>
            <button className="btn-gold" onClick={() => setEditing(newBatch())}>
              <Plus className="h-4 w-4" />
              {t('prod.new')}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('prod.totalProduced')} value={num(totalProduced)} hint={`${num(completed.length)} ${t('prod.batchNo').toLowerCase()}`} />
        <StatCard label={t('prod.avgYield')} value={percent(avgYield)} tone={avgYield >= 95 ? 'good' : 'warn'} />
        <StatCard label={t('prod.totalLossValue')} value={money(totalLoss, 0)} tone="bad" icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard label={t('prod.lossRate')} value={percent(lossRate)} hint={t('prod.batchCost').toLowerCase()} tone={lossRate > 5 ? 'bad' : 'good'} />
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-gold-50 border border-gold-200 px-4 py-3 mb-4 text-sm text-gold-900">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>{t('prod.explainLoss')}</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title={t('prod.lossSummary')} className="lg:col-span-2" bodyClassName="pt-2">
          <div style={{ direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e3e6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7b7f8a' }} tickLine={false} axisLine={false} />
                {/* Units and dirhams are different orders of magnitude — one axis each,
                    otherwise a bad month's loss flattens the output bars to nothing. */}
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#cfa055' }} tickLine={false} axisLine={false} width={46} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#f43f5e' }} tickLine={false} axisLine={false} width={52}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="l" dataKey="units" name={t('prod.good')} fill="#cfa055" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar yAxisId="r" dataKey="loss" name={t('prod.totalLoss') + ' (AED)'} fill="#f43f5e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title={t('prod.lossByMaterial')} subtitle={t('common.allTime')}>
          {lossByMaterial.length === 0 ? (
            <p className="text-sm text-ink-500">{t('common.noResults')}</p>
          ) : (
            <ul className="space-y-2.5">
              {lossByMaterial.slice(0, 9).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-800 truncate">{m.name}</p>
                    <p className="text-xs text-ink-400 tnum">{qty(m.qty, m.unit)}</p>
                  </div>
                  <span className="text-sm font-semibold tnum text-rose-600 shrink-0">{money(m.cost, 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card bodyClassName="pt-0 pb-0">
        <div className="flex flex-wrap gap-2 py-4 no-print">
          <div className="min-w-[200px] flex-1"><SearchInput value={search} onChange={setSearch} /></div>
          <Select
            className="w-full sm:w-auto"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('common.all') + ' — ' + t('common.status') },
              ...(['planned', 'in_progress', 'macerating', 'completed', 'cancelled'] as const).map((s) => ({
                value: s, label: t(`prod.status.${s}` as never),
              })),
            ]}
          />
        </div>

        <DataTable
          rows={filtered.map((a) => ({ ...a, id: a.batch.id }))}
          onRowClick={(a) => setDetailId(a.batch.id)}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            {
              key: 'batch', header: t('prod.batchNo'), sortValue: (a) => a.batch.batchNo,
              render: (a) => (
                <div>
                  <p className="font-medium text-ink-900 tnum">{a.batch.batchNo}</p>
                  <p className="text-xs text-ink-400">{a.batch.operator}</p>
                </div>
              ),
            },
            {
              key: 'product', header: t('common.product'), sortValue: (a) => a.productName,
              render: (a) => {
                const p = db.products.find((x) => x.id === a.batch.productId)
                return <span>{lang === 'ar' && p?.nameAr ? p.nameAr : a.productName}</span>
              },
            },
            { key: 'date', header: t('prod.started'), sortValue: (a) => a.batch.startDate, render: (a) => <span className="text-ink-500">{date(a.batch.startDate)}</span> },
            { key: 'planned', header: t('prod.planned'), align: 'end', sortValue: (a) => a.batch.plannedUnits, render: (a) => <span className="tnum text-ink-500">{num(a.batch.plannedUnits)}</span> },
            { key: 'good', header: t('prod.good'), align: 'end', sortValue: (a) => a.goodUnits, render: (a) => <span className="tnum font-medium">{num(a.goodUnits)}</span> },
            {
              key: 'yield', header: t('prod.yield'), align: 'end', sortValue: (a) => a.yieldPct,
              render: (a) => a.batch.status === 'completed'
                ? <span className={a.yieldPct >= 97 ? 'text-emerald-600 tnum' : a.yieldPct >= 92 ? 'text-amber-600 tnum' : 'text-rose-600 font-medium tnum'}>{percent(a.yieldPct)}</span>
                : <span className="text-ink-300">—</span>,
            },
            {
              key: 'loss', header: t('prod.totalLoss'), align: 'end', sortValue: (a) => a.totalLossCost,
              render: (a) => a.batch.status === 'completed'
                ? <span className={a.totalLossCost > 0 ? 'text-rose-600 font-medium tnum' : 'text-ink-400 tnum'}>{money(a.totalLossCost, 0)}</span>
                : <span className="text-ink-300">—</span>,
            },
            {
              key: 'unitcost', header: t('prod.actualUnitCost'), align: 'end', sortValue: (a) => a.actualUnitCost,
              render: (a) => a.batch.status === 'completed' ? (
                <div>
                  <span className="tnum">{money(a.actualUnitCost)}</span>
                  {Math.abs(a.unitCostVariance) > 0.5 && (
                    <p className={a.unitCostVariance > 0 ? 'text-[11px] text-rose-500 tnum' : 'text-[11px] text-emerald-600 tnum'}>
                      {a.unitCostVariance > 0 ? '+' : ''}{money(a.unitCostVariance)}
                    </p>
                  )}
                </div>
              ) : <span className="text-ink-300">—</span>,
            },
            { key: 'status', header: t('common.status'), render: (a) => <Badge tone={statusTone(a.batch.status)}>{t(`prod.status.${a.batch.status}` as never)}</Badge> },
          ]}
        />
      </Card>

      {/* ---- batch detail: the full material reconciliation ---- */}
      <Modal
        open={!!detail}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.batch.batchNo} — ${detail.productName}` : ''}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDetailId(null)}>{t('common.close')}</button>
            <button className="btn-primary" onClick={() => { if (detail) { setEditing(detail.batch); setDetailId(null) } }}>{t('common.edit')}</button>
          </>
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(detail.batch.status)}>{t(`prod.status.${detail.batch.status}` as never)}</Badge>
              <span className="text-xs text-ink-500">
                {t('prod.started')} {date(detail.batch.startDate)}
                {detail.batch.endDate ? ` · ${t('prod.finished')} ${date(detail.batch.endDate)}` : ''}
                {detail.batch.operator ? ` · ${detail.batch.operator}` : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label={t('prod.planned')} value={num(detail.batch.plannedUnits)} />
              <StatCard label={t('prod.produced')} value={num(detail.batch.actualUnits)} hint={percent(detail.yieldPct) + ' ' + t('prod.yield').toLowerCase()} />
              <StatCard label={t('prod.rejected')} value={num(detail.batch.rejectedUnits)} tone={detail.batch.rejectedUnits ? 'bad' : 'default'} hint={percent(detail.qcPassPct) + ' ' + t('prod.qcPass').toLowerCase()} />
              <StatCard label={t('prod.good')} value={num(detail.goodUnits)} tone="good" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label={t('prod.materialLoss')} value={money(detail.materialLossCost, 0)} tone="bad" />
              <StatCard label={t('prod.rejectLoss')} value={money(detail.rejectLossCost, 0)} tone="bad" />
              <StatCard label={t('prod.totalLoss')} value={money(detail.totalLossCost, 0)} tone="bad" hint={percent(safeDiv(detail.totalLossCost, detail.totalBatchCost) * 100) + ' ' + t('prod.batchCost').toLowerCase()} />
              <StatCard
                label={t('prod.unitCostVariance')}
                value={`${detail.unitCostVariance > 0 ? '+' : ''}${money(detail.unitCostVariance)}`}
                tone={detail.unitCostVariance > 0 ? 'bad' : 'good'}
                hint={`${t('prod.standardUnitCost')} ${money(detail.standardUnitCost)}`}
              />
            </div>

            {detail.batch.notes && (
              <p className="text-sm text-ink-600 italic border-s-2 border-rose-300 ps-3">{detail.batch.notes}</p>
            )}

            <div>
              <h3 className="section-title mb-2">{t('prod.consumption')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="th">{t('common.material')}</th>
                      <th className="th text-end">{t('prod.expectedQty')}</th>
                      <th className="th text-end">{t('prod.actualQty')}</th>
                      <th className="th text-end">{t('prod.varianceQty')}</th>
                      <th className="th text-end">%</th>
                      <th className="th text-end">{t('prod.varianceCost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...detail.variances]
                      .sort((a, b) => b.varianceCost - a.varianceCost)
                      .map((v) => (
                        <tr key={v.materialId}>
                          <td className="td">{v.materialName}</td>
                          <td className="td text-end tnum text-ink-500">{qty(v.expectedQty, v.unit)}</td>
                          <td className="td text-end tnum">{qty(v.actualQty, v.unit)}</td>
                          <td className={`td text-end tnum ${v.varianceQty > 0 ? 'text-rose-600' : v.varianceQty < 0 ? 'text-emerald-600' : 'text-ink-400'}`}>
                            {v.varianceQty > 0 ? '+' : ''}{num(v.varianceQty, v.unit === 'pcs' ? 0 : 2)}
                          </td>
                          <td className={`td text-end tnum ${Math.abs(v.variancePct) > 5 ? 'text-rose-600 font-medium' : 'text-ink-400'}`}>
                            {v.variancePct > 0 ? '+' : ''}{percent(v.variancePct)}
                          </td>
                          <td className={`td text-end tnum font-medium ${v.varianceCost > 0 ? 'text-rose-600' : v.varianceCost < 0 ? 'text-emerald-600' : 'text-ink-400'}`}>
                            {v.varianceCost > 0 ? '+' : ''}{money(v.varianceCost)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-ink-50/70">
                    <tr>
                      <td className="td font-medium" colSpan={5}>{t('prod.overuse')} ({t('common.total')})</td>
                      <td className="td text-end tnum font-semibold text-rose-600">{money(detail.materialLossCost)}</td>
                    </tr>
                    <tr>
                      <td className="td font-medium" colSpan={5}>{t('common.variance')} ({t('common.total')})</td>
                      <td className={`td text-end tnum font-semibold ${detail.netVarianceCost > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {money(detail.netVarianceCost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div>
              <h3 className="section-title mb-2">{t('prod.batchCost')}</h3>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                {([
                  [t('common.material'), money(detail.totalBatchCost - detail.batch.labourCost - detail.batch.overheadCost)],
                  [t('prod.labour'), money(detail.batch.labourCost)],
                  [t('prod.overhead'), money(detail.batch.overheadCost)],
                  [t('prod.batchCost'), money(detail.totalBatchCost)],
                  [t('prod.actualUnitCost'), money(detail.actualUnitCost)],
                  [t('prod.standardUnitCost'), money(detail.standardUnitCost)],
                ] as const).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-1 border-b border-ink-100">
                    <dt className="text-ink-500">{k}</dt>
                    <dd className="tnum font-medium text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- batch edit ---- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && db.batches.some((b) => b.id === editing.id) ? t('common.edit') : t('prod.new')}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            <button className="btn-gold" onClick={async () => { if (editing) { await save('batches', editing); setEditing(null) } }}>
              {t('common.save')}
            </button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label={t('prod.batchNo')}>
                <input className="input" value={editing.batchNo} onChange={(e) => setEditing({ ...editing, batchNo: e.target.value })} />
              </Field>
              <Field label={t('common.product')}>
                <Select
                  value={editing.productId}
                  onChange={(v) => {
                    const p = db.products.find((x) => x.id === v)
                    const f = db.formulas.find((x) => x.id === p?.formulaId)
                    setEditing({
                      ...editing,
                      productId: v,
                      formulaId: f?.id ?? editing.formulaId,
                      consumption: f ? expectedConsumption(f, editing.actualUnits || editing.plannedUnits) : editing.consumption,
                    })
                  }}
                  options={db.products.map((p) => ({ value: p.id, label: lang === 'ar' ? p.nameAr : p.nameEn }))}
                />
              </Field>
              <Field label={t('common.status')}>
                <Select
                  value={editing.status}
                  onChange={(v) => setEditing({ ...editing, status: v as ProductionBatch['status'] })}
                  options={(['planned', 'in_progress', 'macerating', 'completed', 'cancelled'] as const).map((s) => ({
                    value: s, label: t(`prod.status.${s}` as never),
                  }))}
                />
              </Field>
              <Field label={t('prod.started')}>
                <input type="date" className="input" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
              </Field>
              <Field label={t('prod.finished')}>
                <input type="date" className="input" value={editing.endDate ?? ''} onChange={(e) => setEditing({ ...editing, endDate: e.target.value || null })} />
              </Field>
              <Field label={t('prod.operator')}>
                <input className="input" value={editing.operator ?? ''} onChange={(e) => setEditing({ ...editing, operator: e.target.value })} />
              </Field>
              <Field label={t('prod.planned')}>
                <input type="number" className="input" value={editing.plannedUnits} onChange={(e) => setEditing({ ...editing, plannedUnits: +e.target.value })} />
              </Field>
              <Field label={t('prod.produced')} hint={t('prod.expectedQty')}>
                <input
                  type="number"
                  className="input"
                  value={editing.actualUnits}
                  onChange={(e) => {
                    const units = +e.target.value
                    const f = db.formulas.find((x) => x.id === editing.formulaId)
                    // Recompute what the formula says we SHOULD have used for this output,
                    // keeping whatever actuals have already been entered.
                    const next = f
                      ? f.lines.map((l) => {
                          const prev = editing.consumption.find((c) => c.materialId === l.materialId)
                          return {
                            materialId: l.materialId,
                            expectedQty: +(l.qtyPerUnit * units).toFixed(3),
                            actualQty: prev?.actualQty ?? +(l.qtyPerUnit * units).toFixed(3),
                          }
                        })
                      : editing.consumption
                    setEditing({ ...editing, actualUnits: units, consumption: next })
                  }}
                />
              </Field>
              <Field label={t('prod.rejected')}>
                <input type="number" className="input" value={editing.rejectedUnits} onChange={(e) => setEditing({ ...editing, rejectedUnits: +e.target.value })} />
              </Field>
              <Field label={t('prod.labour')}>
                <input type="number" className="input" value={editing.labourCost} onChange={(e) => setEditing({ ...editing, labourCost: +e.target.value })} />
              </Field>
              <Field label={t('prod.overhead')}>
                <input type="number" className="input" value={editing.overheadCost} onChange={(e) => setEditing({ ...editing, overheadCost: +e.target.value })} />
              </Field>
            </div>

            <div>
              <h3 className="section-title mb-2">{t('prod.consumption')}</h3>
              <div className="overflow-x-auto max-h-72 overflow-y-auto border border-ink-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr>
                      <th className="th">{t('common.material')}</th>
                      <th className="th text-end">{t('prod.expectedQty')}</th>
                      <th className="th text-end">{t('prod.actualQty')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editing.consumption.map((c, idx) => {
                      const m = db.materials.find((x) => x.id === c.materialId)
                      return (
                        <tr key={c.materialId}>
                          <td className="td">{m ? (lang === 'ar' ? m.nameAr : m.nameEn) : c.materialId}</td>
                          <td className="td text-end tnum text-ink-500">{num(c.expectedQty, m?.unit === 'pcs' ? 0 : 2)} {m?.unit}</td>
                          <td className="td text-end">
                            <input
                              type="number"
                              step="0.01"
                              className="input !py-1 !px-2 w-28 text-end tnum"
                              value={c.actualQty}
                              onChange={(e) => {
                                const next = [...editing.consumption]
                                next[idx] = { ...c, actualQty: +e.target.value }
                                setEditing({ ...editing, consumption: next })
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Field label={t('common.notes')}>
              <textarea className="input" rows={2} value={editing.notes ?? ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </>
  )
}
