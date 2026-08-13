import { useMemo, useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import { Badge, Card, DataTable, Modal, PageHeader, SearchInput, StatCard } from '@/components/ui'
import { safeDiv, sum } from '@/lib/calc'
import type { Formula } from '@/types'

export default function Formulas() {
  const { t, lang, money, num, percent } = useI18n()
  const { db } = useData()

  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<Formula | null>(null)

  const matMap = useMemo(() => new Map(db.materials.map((m) => [m.id, m])), [db.materials])
  const packaging = ['bottle', 'cap', 'box', 'label']

  const rows = useMemo(
    () =>
      db.formulas.map((f) => {
        const lines = f.lines.map((l) => {
          const m = matMap.get(l.materialId)
          return {
            ...l,
            material: m,
            lineCost: l.qtyPerUnit * (m?.costPerUnit ?? 0),
            isPackaging: m ? packaging.includes(m.category) : false,
            isLiquid: m ? m.unit !== 'pcs' : false,
          }
        })
        const materialCost = sum(lines.map((l) => l.lineCost))
        const unitCost = materialCost * (1 + f.expectedLossRate)
        const liquidVolume = sum(lines.filter((l) => l.isLiquid).map((l) => l.qtyPerUnit))
        const oilVolume = sum(
          lines.filter((l) => l.material?.category === 'oil').map((l) => l.qtyPerUnit)
        )
        const product = db.products.find((p) => p.id === f.productId)
        return {
          ...f,
          lines,
          materialCost,
          unitCost,
          liquidVolume,
          oilVolume,
          concentrationPct: safeDiv(oilVolume, liquidVolume) * 100,
          product,
          marginPct: product ? safeDiv(product.price - unitCost, product.price) * 100 : 0,
        }
      }),
    [db, matMap]
  )

  const filtered = rows.filter((f) => {
    const q = search.toLowerCase()
    return !q || f.nameEn.toLowerCase().includes(q) || f.nameAr.includes(search) || f.code.toLowerCase().includes(q)
  })

  const name = (f: { nameEn: string; nameAr: string }) => (lang === 'ar' ? f.nameAr : f.nameEn)
  const detailRow = detail ? rows.find((r) => r.id === detail.id) : null

  return (
    <>
      <PageHeader title={t('formulas.title')} subtitle={t('formulas.subtitle')} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('formulas.title')} value={num(db.formulas.length)} icon={<FlaskConical className="h-4 w-4" />} />
        <StatCard label={t('formulas.materialCost')} value={money(safeDiv(sum(rows.map((r) => r.unitCost)), rows.length), 2)} hint={t('common.total').toLowerCase()} />
        <StatCard label={t('formulas.expectedLoss')} value={percent(safeDiv(sum(rows.map((r) => r.expectedLossRate)), rows.length) * 100)} />
        <StatCard label={t('common.margin')} value={percent(safeDiv(sum(rows.filter((r) => r.product).map((r) => r.marginPct)), rows.filter((r) => r.product).length))} tone="good" />
      </div>

      <Card bodyClassName="pt-0 pb-0">
        <div className="py-4 max-w-sm no-print">
          <SearchInput value={search} onChange={setSearch} />
        </div>
        <DataTable
          rows={filtered}
          onRowClick={(f) => setDetail(f)}
          initialSort={{ key: 'code', dir: 'asc' }}
          columns={[
            {
              key: 'code', header: t('common.code'), sortValue: (f) => f.code,
              render: (f) => (
                <div>
                  <p className="font-medium text-ink-900 tnum">{f.code}</p>
                  <p className="text-xs text-ink-400">{name(f)}</p>
                </div>
              ),
            },
            { key: 'ver', header: t('formulas.version'), render: (f) => <Badge>{f.version}</Badge> },
            { key: 'lines', header: t('formulas.lines'), align: 'end', sortValue: (f) => f.lines.length, render: (f) => <span className="tnum">{num(f.lines.length)}</span> },
            {
              key: 'conc', header: t('formulas.concentrationPct'), align: 'end', sortValue: (f) => f.concentrationPct,
              render: (f) => <span className="tnum text-ink-600">{percent(f.concentrationPct)}</span>,
            },
            { key: 'cost', header: t('formulas.materialCost'), align: 'end', sortValue: (f) => f.unitCost, render: (f) => <span className="tnum font-medium">{money(f.unitCost)}</span> },
            {
              key: 'loss', header: t('formulas.expectedLoss'), align: 'end', sortValue: (f) => f.expectedLossRate,
              render: (f) => <span className="tnum text-ink-500">{percent(f.expectedLossRate * 100, 1)}</span>,
            },
            {
              key: 'prod', header: t('formulas.linkedProduct'), sortValue: (f) => f.product?.nameEn ?? '',
              render: (f) => f.product
                ? <span className="text-ink-700">{lang === 'ar' ? f.product.nameAr : f.product.nameEn}</span>
                : <span className="text-ink-300">—</span>,
            },
            {
              key: 'margin', header: t('common.margin'), align: 'end', sortValue: (f) => f.marginPct,
              render: (f) => f.product
                ? <span className={f.marginPct >= 60 ? 'text-emerald-600 font-medium tnum' : 'text-amber-600 tnum'}>{percent(f.marginPct)}</span>
                : <span className="text-ink-300">—</span>,
            },
          ]}
        />
      </Card>

      <Modal open={!!detailRow} onClose={() => setDetail(null)} title={detailRow ? `${detailRow.code} — ${name(detailRow)}` : ''} wide>
        {detailRow && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label={t('formulas.version')} value={detailRow.version} />
              <StatCard label={t('formulas.concentrationPct')} value={percent(detailRow.concentrationPct)} />
              <StatCard label={t('formulas.materialCost')} value={money(detailRow.unitCost)} />
              <StatCard label={t('formulas.expectedLoss')} value={percent(detailRow.expectedLossRate * 100)} tone="warn" />
            </div>

            {detailRow.perfumerNotes && (
              <p className="text-sm text-ink-600 italic border-s-2 border-gold-300 ps-3">{detailRow.perfumerNotes}</p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="th">{t('common.material')}</th>
                    <th className="th">{t('common.category')}</th>
                    <th className="th text-end">{t('formulas.qtyPerUnit')}</th>
                    <th className="th text-end">{t('materials.costPerUnit')}</th>
                    <th className="th text-end">{t('common.cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...detailRow.lines].sort((a, b) => b.lineCost - a.lineCost).map((l) => (
                    <tr key={l.materialId}>
                      <td className="td">{l.material ? (lang === 'ar' ? l.material.nameAr : l.material.nameEn) : l.materialId}</td>
                      <td className="td">
                        {l.material && <Badge tone={l.isPackaging ? 'neutral' : 'gold'}>{t(`materials.cat.${l.material.category}` as never)}</Badge>}
                      </td>
                      <td className="td text-end tnum">{num(l.qtyPerUnit, l.material?.unit === 'pcs' ? 0 : 2)} {l.material?.unit}</td>
                      <td className="td text-end tnum text-ink-500">{money(l.material?.costPerUnit ?? 0, (l.material?.costPerUnit ?? 0) < 1 ? 3 : 2)}</td>
                      <td className="td text-end tnum font-medium">{money(l.lineCost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-ink-50/70">
                  <tr>
                    <td className="td font-medium" colSpan={4}>{t('common.subtotal')}</td>
                    <td className="td text-end tnum font-medium">{money(detailRow.materialCost)}</td>
                  </tr>
                  <tr>
                    <td className="td font-medium" colSpan={4}>{t('products.lossAllowance')} ({percent(detailRow.expectedLossRate * 100, 1)})</td>
                    <td className="td text-end tnum font-medium">{money(detailRow.unitCost - detailRow.materialCost)}</td>
                  </tr>
                  <tr>
                    <td className="td font-semibold text-ink-900" colSpan={4}>{t('products.unitCost')}</td>
                    <td className="td text-end tnum font-semibold text-ink-900">{money(detailRow.unitCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
