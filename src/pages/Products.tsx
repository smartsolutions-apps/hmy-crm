import { useMemo, useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import {
  Badge, Card, DataTable, Field, MiniBar, Modal, PageHeader, SearchInput,
  Select, StatCard, exportCsv, statusTone,
} from '@/components/ui'
import { computeProductCost, productMargin, safeDiv, sum } from '@/lib/calc'
import { WEAR_OCCASIONS, seasonLabelKey, sillageLabelKey, wearLabelKey } from '@/lib/segments'
import type { Product } from '@/types'

const blankProduct = (): Product => ({
  id: `prd-${Date.now()}`,
  sku: '',
  nameEn: '',
  nameAr: '',
  family: 'oriental',
  concentration: 'EDP',
  sizeMl: 50,
  formulaId: null,
  price: 0,
  wholesalePrice: 0,
  stockQty: 0,
  reorderLevel: 20,
  status: 'draft',
  launchDate: new Date().toISOString().slice(0, 10),
  wearOccasions: [],
  season: 'all',
  sillage: 'moderate',
})

export default function Products() {
  const { t, lang, money, num, percent, date } = useI18n()
  const { db, save } = useData()

  const [search, setSearch] = useState('')
  const [family, setFamily] = useState('all')
  const [status, setStatus] = useState('all')
  const [detail, setDetail] = useState<Product | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)

  const enriched = useMemo(
    () =>
      db.products.map((p) => {
        const cost = computeProductCost(p, db.formulas, db.materials)
        const m = productMargin(p, cost.totalUnitCost)
        const soldUnits = sum(
          db.orders
            .filter((o) => o.status !== 'cancelled' && o.status !== 'returned')
            .flatMap((o) => o.items.filter((i) => i.productId === p.id).map((i) => i.qty))
        )
        return { ...p, cost, margin: m, soldUnits }
      }),
    [db]
  )

  const filtered = enriched.filter((p) => {
    const q = search.toLowerCase()
    const matchQ = !q || p.nameEn.toLowerCase().includes(q) || p.nameAr.includes(search) || p.sku.toLowerCase().includes(q)
    return matchQ && (family === 'all' || p.family === family) && (status === 'all' || p.status === status)
  })

  const activeProducts = enriched.filter((p) => p.status === 'active')
  const avgMargin = safeDiv(sum(activeProducts.map((p) => p.margin.marginPct)), activeProducts.length)
  const stockValue = sum(enriched.map((p) => p.stockQty * p.cost.totalUnitCost))
  const retailValue = sum(enriched.map((p) => p.stockQty * p.price))

  const name = (p: { nameEn: string; nameAr: string }) => (lang === 'ar' ? p.nameAr : p.nameEn)

  return (
    <>
      <PageHeader
        title={t('products.title')}
        subtitle={t('products.subtitle')}
        actions={
          <>
            <button
              className="btn-ghost"
              onClick={() =>
                exportCsv('products.csv', filtered.map((p) => ({
                  sku: p.sku, name: p.nameEn, family: p.family, concentration: p.concentration,
                  size_ml: p.sizeMl, retail_aed: p.price, wholesale_aed: p.wholesalePrice,
                  unit_cost_aed: +p.cost.totalUnitCost.toFixed(2), margin_pct: +p.margin.marginPct.toFixed(1),
                  stock: p.stockQty, units_sold: p.soldUnits, status: p.status,
                })))
              }
            >
              <Download className="h-4 w-4" />
              {t('common.export')}
            </button>
            <button className="btn-gold" onClick={() => setEditing(blankProduct())}>
              <Plus className="h-4 w-4" />
              {t('products.new')}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('products.title')} value={num(db.products.length)} hint={`${num(activeProducts.length)} ${t('common.active').toLowerCase()}`} />
        <StatCard label={t('common.margin')} value={percent(avgMargin)} hint={t('common.active')} tone="good" />
        <StatCard label={t('common.stock')} value={money(stockValue, 0)} hint={t('common.cost').toLowerCase()} />
        <StatCard label={t('common.value')} value={money(retailValue, 0)} hint={t('products.retail').toLowerCase()} tone="good" />
      </div>

      <Card bodyClassName="pt-0 pb-0">
        <div className="flex flex-wrap gap-2 py-4 no-print">
          <div className="min-w-[200px] flex-1"><SearchInput value={search} onChange={setSearch} /></div>
          <Select
            className="w-full sm:w-auto"
            value={family}
            onChange={setFamily}
            options={[
              { value: 'all', label: t('common.all') + ' — ' + t('products.family') },
              ...(['oriental', 'floral', 'woody', 'fresh', 'musk'] as const).map((f) => ({
                value: f, label: t(`products.family.${f}` as never),
              })),
            ]}
          />
          <Select
            className="w-full sm:w-auto"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('common.all') + ' — ' + t('common.status') },
              ...(['active', 'draft', 'discontinued'] as const).map((s) => ({
                value: s, label: t(`products.status.${s}` as never),
              })),
            ]}
          />
        </div>

        <DataTable
          rows={filtered}
          onRowClick={(p) => setDetail(p)}
          initialSort={{ key: 'revenue', dir: 'desc' }}
          columns={[
            {
              key: 'name',
              header: t('common.product'),
              sortValue: (p) => p.nameEn,
              render: (p) => (
                <div>
                  <p className="font-medium text-ink-900">{name(p)}</p>
                  <p className="text-xs text-ink-400 tnum">{p.sku} · {p.concentration} {p.sizeMl}ml</p>
                </div>
              ),
            },
            {
              key: 'family',
              header: t('products.family'),
              sortValue: (p) => p.family,
              render: (p) => <Badge tone="gold">{t(`products.family.${p.family}` as never)}</Badge>,
            },
            { key: 'price', header: t('products.retail'), align: 'end', sortValue: (p) => p.price, render: (p) => <span className="tnum">{money(p.price, 0)}</span> },
            {
              key: 'cost', header: t('products.unitCost'), align: 'end', sortValue: (p) => p.cost.totalUnitCost,
              render: (p) => <span className="tnum text-ink-500">{p.formulaId ? money(p.cost.totalUnitCost) : '—'}</span>,
            },
            {
              key: 'margin', header: t('common.margin'), align: 'end', sortValue: (p) => p.margin.marginPct,
              render: (p) =>
                p.formulaId ? (
                  <span className={p.margin.marginPct >= 60 ? 'text-emerald-600 font-medium tnum' : p.margin.marginPct >= 40 ? 'text-amber-600 tnum' : 'text-rose-600 tnum'}>
                    {percent(p.margin.marginPct)}
                  </span>
                ) : <span className="text-ink-300">—</span>,
            },
            {
              key: 'stock', header: t('products.stock'), align: 'end', sortValue: (p) => p.stockQty,
              render: (p) => (
                <div className="min-w-[90px]">
                  <p className={p.stockQty <= p.reorderLevel ? 'text-rose-600 font-medium tnum' : 'tnum'}>
                    {num(p.stockQty)}
                  </p>
                  <MiniBar value={p.stockQty} max={Math.max(p.reorderLevel * 3, p.stockQty)} tone={p.stockQty <= p.reorderLevel ? 'rose' : 'gold'} />
                </div>
              ),
            },
            { key: 'revenue', header: t('common.units'), align: 'end', sortValue: (p) => p.soldUnits, render: (p) => <span className="tnum text-ink-600">{num(p.soldUnits)}</span> },
            { key: 'status', header: t('common.status'), render: (p) => <Badge tone={statusTone(p.status)}>{t(`products.status.${p.status}` as never)}</Badge> },
          ]}
        />
      </Card>

      {/* ---- detail ---- */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? name(detail) : ''}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDetail(null)}>{t('common.close')}</button>
            <button className="btn-primary" onClick={() => { setEditing(detail); setDetail(null) }}>{t('common.edit')}</button>
          </>
        }
      >
        {detail && <ProductDetail product={detail} />}
      </Modal>

      {/* ---- edit ---- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && db.products.some((p) => p.id === editing.id) ? t('common.edit') : t('products.new')}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            <button
              className="btn-gold"
              onClick={async () => {
                if (!editing) return
                await save('products', editing)
                setEditing(null)
              }}
            >
              {t('common.save')}
            </button>
          </>
        }
      >
        {editing && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('products.sku')}>
              <input className="input" value={editing.sku} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} />
            </Field>
            <Field label={t('common.name') + ' (EN)'}>
              <input className="input" value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
            </Field>
            <Field label={t('common.name') + ' (AR)'}>
              <input className="input" dir="rtl" value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} />
            </Field>
            <Field label={t('products.family')}>
              <Select
                value={editing.family}
                onChange={(v) => setEditing({ ...editing, family: v as Product['family'] })}
                options={(['oriental', 'floral', 'woody', 'fresh', 'musk'] as const).map((f) => ({ value: f, label: t(`products.family.${f}` as never) }))}
              />
            </Field>
            <Field label={t('products.concentration')}>
              <Select
                value={editing.concentration}
                onChange={(v) => setEditing({ ...editing, concentration: v as Product['concentration'] })}
                options={(['Parfum', 'EDP', 'EDT', 'Oil', 'Mist'] as const).map((c) => ({ value: c, label: c }))}
              />
            </Field>
            <Field label={t('products.size') + ' (ml)'}>
              <input type="number" className="input" value={editing.sizeMl} onChange={(e) => setEditing({ ...editing, sizeMl: +e.target.value })} />
            </Field>
            <Field label={t('products.retail')}>
              <input type="number" className="input" value={editing.price} onChange={(e) => setEditing({ ...editing, price: +e.target.value })} />
            </Field>
            <Field label={t('products.wholesale')}>
              <input type="number" className="input" value={editing.wholesalePrice} onChange={(e) => setEditing({ ...editing, wholesalePrice: +e.target.value })} />
            </Field>
            <Field label={t('products.stock')}>
              <input type="number" className="input" value={editing.stockQty} onChange={(e) => setEditing({ ...editing, stockQty: +e.target.value })} />
            </Field>
            <Field label={t('materials.reorder')}>
              <input type="number" className="input" value={editing.reorderLevel} onChange={(e) => setEditing({ ...editing, reorderLevel: +e.target.value })} />
            </Field>
            <Field label={t('nav.formulas')}>
              <Select
                value={editing.formulaId ?? ''}
                onChange={(v) => setEditing({ ...editing, formulaId: v || null })}
                options={[{ value: '', label: t('common.none') }, ...db.formulas.map((f) => ({ value: f.id, label: f.code }))]}
              />
            </Field>
            <Field label={t('common.status')}>
              <Select
                value={editing.status}
                onChange={(v) => setEditing({ ...editing, status: v as Product['status'] })}
                options={(['active', 'draft', 'discontinued'] as const).map((s) => ({ value: s, label: t(`products.status.${s}` as never) }))}
              />
            </Field>
            <Field label={t('products.launch')}>
              <input type="date" className="input" value={editing.launchDate} onChange={(e) => setEditing({ ...editing, launchDate: e.target.value })} />
            </Field>
            <Field label={t('season.title')}>
              <Select
                value={editing.season}
                onChange={(v) => setEditing({ ...editing, season: v as Product['season'] })}
                options={(['all', 'summer', 'winter'] as const).map((s) => ({ value: s, label: t(seasonLabelKey(s)) }))}
              />
            </Field>
            <Field label={t('sillage.title')}>
              <Select
                value={editing.sillage}
                onChange={(v) => setEditing({ ...editing, sillage: v as Product['sillage'] })}
                options={(['subtle', 'moderate', 'strong'] as const).map((s) => ({ value: s, label: t(sillageLabelKey(s)) }))}
              />
            </Field>
            <Field label={t('wear.title')} hint={t('wear.hint')} className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {WEAR_OCCASIONS.map((w) => {
                  const on = editing.wearOccasions.includes(w)
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          wearOccasions: on
                            ? editing.wearOccasions.filter((x) => x !== w)
                            : [...editing.wearOccasions, w],
                        })
                      }
                      className={
                        on
                          ? 'rounded-lg border border-gold-400 bg-gold-50 text-gold-900 px-3 py-1.5 text-xs font-medium'
                          : 'rounded-lg border border-ink-200 bg-white text-ink-600 hover:bg-ink-50 px-3 py-1.5 text-xs font-medium'
                      }
                    >
                      {t(wearLabelKey(w))}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>
        )}
      </Modal>
    </>
  )

  function ProductDetail({ product }: { product: Product }) {
    const cost = computeProductCost(product, db.formulas, db.materials)
    const m = productMargin(product, cost.totalUnitCost)
    const formula = db.formulas.find((f) => f.id === product.formulaId)
    const orders = db.orders.filter((o) => o.items.some((i) => i.productId === product.id))
    const unitsSold = sum(orders.flatMap((o) => o.items.filter((i) => i.productId === product.id).map((i) => i.qty)))
    const revenue = sum(orders.flatMap((o) => o.items.filter((i) => i.productId === product.id).map((i) => i.qty * i.unitPrice - i.discount)))

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">{t(`products.family.${product.family}` as never)}</Badge>
          <Badge tone={statusTone(product.status)}>{t(`products.status.${product.status}` as never)}</Badge>
          <span className="text-xs text-ink-500 tnum">{product.sku} · {product.concentration} · {product.sizeMl} ml</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-ink-500 me-1">{t('wear.title')}:</span>
          {product.wearOccasions.length ? (
            product.wearOccasions.map((w) => <Badge key={w} tone="blue">{t(wearLabelKey(w))}</Badge>)
          ) : (
            <span className="text-xs text-ink-300">—</span>
          )}
          <Badge>{t(seasonLabelKey(product.season))}</Badge>
          <Badge tone={product.sillage === 'strong' ? 'purple' : 'neutral'}>
            {t(sillageLabelKey(product.sillage))}
          </Badge>
        </div>

        {(lang === 'ar' ? product.descriptionAr : product.descriptionEn) && (
          <p className="text-sm text-ink-600 leading-relaxed">
            {lang === 'ar' ? product.descriptionAr : product.descriptionEn}
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t('products.retail')} value={money(product.price, 0)} />
          <StatCard label={t('products.unitCost')} value={product.formulaId ? money(cost.totalUnitCost) : '—'} />
          <StatCard label={t('common.profit')} value={product.formulaId ? money(m.profit) : '—'} tone="good" />
          <StatCard label={t('common.margin')} value={product.formulaId ? percent(m.marginPct) : '—'} tone={m.marginPct >= 50 ? 'good' : 'warn'} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t('products.stock')} value={num(product.stockQty)} hint={`${t('materials.reorder')} ${num(product.reorderLevel)}`} />
          <StatCard label={t('common.units')} value={num(unitsSold)} hint={t('orders.title')} />
          <StatCard label={t('common.revenue')} value={money(revenue, 0)} />
          <StatCard label={t('products.launch')} value={date(product.launchDate)} />
        </div>

        {(product.topNotes || product.heartNotes || product.baseNotes) && (
          <div>
            <h3 className="section-title mb-2">{t('products.notes')}</h3>
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              {([['products.topNotes', product.topNotes], ['products.heartNotes', product.heartNotes], ['products.baseNotes', product.baseNotes]] as const).map(
                ([key, notes]) =>
                  notes?.length ? (
                    <div key={key} className="rounded-lg bg-ink-50 p-3">
                      <p className="text-xs font-medium text-ink-500 mb-1">{t(key as never)}</p>
                      <p className="text-ink-800">{notes.join(' · ')}</p>
                    </div>
                  ) : null
              )}
            </div>
          </div>
        )}

        <div>
          <h3 className="section-title mb-2">
            {t('products.costBreakdown')}
            {formula && <span className="ms-2 text-xs font-normal text-ink-400 tnum">{formula.code} {formula.version}</span>}
          </h3>
          {!product.formulaId ? (
            <p className="text-sm text-ink-500">{t('products.noFormula')}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="th">{t('common.material')}</th>
                      <th className="th text-end">{t('formulas.qtyPerUnit')}</th>
                      <th className="th text-end">{t('materials.costPerUnit')}</th>
                      <th className="th text-end">{t('common.cost')}</th>
                      <th className="th text-end">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...cost.lines].sort((a, b) => b.lineCost - a.lineCost).map((l) => (
                      <tr key={l.materialId}>
                        <td className="td">{l.materialName}</td>
                        <td className="td text-end tnum text-ink-500">{num(l.qtyPerUnit, l.unit === 'pcs' ? 0 : 2)} {l.unit}</td>
                        <td className="td text-end tnum text-ink-500">{money(l.costPerUnit, l.costPerUnit < 1 ? 3 : 2)}</td>
                        <td className="td text-end tnum font-medium">{money(l.lineCost)}</td>
                        <td className="td text-end tnum text-ink-400">{percent(safeDiv(l.lineCost, cost.materialCost) * 100, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-ink-50/70">
                    <tr>
                      <td className="td font-medium">{t('products.juice')}</td>
                      <td className="td" colSpan={2} />
                      <td className="td text-end tnum font-medium">{money(cost.juiceCost)}</td>
                      <td className="td text-end tnum text-ink-400">{percent(safeDiv(cost.juiceCost, cost.materialCost) * 100, 0)}</td>
                    </tr>
                    <tr>
                      <td className="td font-medium">{t('products.packaging')}</td>
                      <td className="td" colSpan={2} />
                      <td className="td text-end tnum font-medium">{money(cost.packagingCost)}</td>
                      <td className="td text-end tnum text-ink-400">{percent(safeDiv(cost.packagingCost, cost.materialCost) * 100, 0)}</td>
                    </tr>
                    <tr>
                      <td className="td font-medium">{t('products.lossAllowance')}</td>
                      <td className="td" colSpan={2} />
                      <td className="td text-end tnum font-medium">{money(cost.totalUnitCost - cost.materialCost)}</td>
                      <td className="td text-end tnum text-ink-400">{percent((formula?.expectedLossRate ?? 0) * 100, 0)}</td>
                    </tr>
                    <tr>
                      <td className="td font-semibold text-ink-900">{t('products.unitCost')}</td>
                      <td className="td" colSpan={2} />
                      <td className="td text-end tnum font-semibold text-ink-900">{money(cost.totalUnitCost)}</td>
                      <td className="td" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {formula?.perfumerNotes && (
                <p className="mt-3 text-xs text-ink-500 italic border-s-2 border-gold-300 ps-3">
                  {formula.perfumerNotes}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    )
  }
}
