import { useMemo, useState } from 'react'
import { Download, Plus, AlertTriangle } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import {
  Badge, Card, DataTable, Field, MiniBar, Modal, PageHeader, SearchInput,
  Select, StatCard, exportCsv,
} from '@/components/ui'
import { sum } from '@/lib/calc'
import type { Material } from '@/types'

const CATEGORIES: Material['category'][] = ['oil', 'alcohol', 'fixative', 'bottle', 'cap', 'box', 'label', 'other']

const blank = (): Material => ({
  id: `mat-${Date.now()}`,
  code: '',
  nameEn: '',
  nameAr: '',
  category: 'oil',
  unit: 'ml',
  costPerUnit: 0,
  stockQty: 0,
  reorderLevel: 0,
  supplierId: null,
})

export default function Materials() {
  const { t, lang, money, num, qty } = useI18n()
  const { db, save } = useData()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [onlyLow, setOnlyLow] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)

  const rows = useMemo(
    () =>
      db.materials.map((m) => {
        const supplier = db.suppliers.find((s) => s.id === m.supplierId)
        // How much of this material every completed batch actually burned.
        const used = sum(
          db.batches
            .filter((b) => b.status === 'completed')
            .flatMap((b) => b.consumption.filter((c) => c.materialId === m.id).map((c) => c.actualQty))
        )
        const wasted = sum(
          db.batches
            .filter((b) => b.status === 'completed')
            .flatMap((b) =>
              b.consumption.filter((c) => c.materialId === m.id).map((c) => Math.max(0, c.actualQty - c.expectedQty))
            )
        )
        return {
          ...m,
          supplierName: supplier?.name ?? '—',
          stockValue: m.stockQty * m.costPerUnit,
          used,
          wasted,
          wastedCost: wasted * m.costPerUnit,
          low: m.stockQty <= m.reorderLevel,
        }
      }),
    [db]
  )

  const filtered = rows.filter((m) => {
    const q = search.toLowerCase()
    const matchQ = !q || m.nameEn.toLowerCase().includes(q) || m.nameAr.includes(search) || m.code.toLowerCase().includes(q)
    return matchQ && (category === 'all' || m.category === category) && (!onlyLow || m.low)
  })

  const totalValue = sum(rows.map((m) => m.stockValue))
  const lowCount = rows.filter((m) => m.low).length
  const totalWasted = sum(rows.map((m) => m.wastedCost))

  const name = (m: { nameEn: string; nameAr: string }) => (lang === 'ar' ? m.nameAr : m.nameEn)

  return (
    <>
      <PageHeader
        title={t('materials.title')}
        subtitle={t('materials.subtitle')}
        actions={
          <>
            <button
              className="btn-ghost"
              onClick={() =>
                exportCsv('materials.csv', filtered.map((m) => ({
                  code: m.code, name: m.nameEn, category: m.category, unit: m.unit,
                  cost_per_unit_aed: m.costPerUnit, stock: m.stockQty, reorder_level: m.reorderLevel,
                  stock_value_aed: +m.stockValue.toFixed(2), supplier: m.supplierName,
                  consumed: +m.used.toFixed(2), over_consumed: +m.wasted.toFixed(2),
                  over_consumed_cost_aed: +m.wastedCost.toFixed(2),
                })))
              }
            >
              <Download className="h-4 w-4" />
              {t('common.export')}
            </button>
            <button className="btn-gold" onClick={() => setEditing(blank())}>
              <Plus className="h-4 w-4" />
              {t('materials.new')}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('materials.title')} value={num(db.materials.length)} />
        <StatCard label={t('materials.totalValue')} value={money(totalValue, 0)} />
        <StatCard
          label={t('dash.lowStock')}
          value={num(lowCount)}
          tone={lowCount ? 'bad' : 'good'}
          icon={lowCount ? <AlertTriangle className="h-4 w-4" /> : undefined}
        />
        <StatCard label={t('prod.materialLoss')} value={money(totalWasted, 0)} hint={t('common.allTime')} tone="bad" />
      </div>

      <Card bodyClassName="pt-0 pb-0">
        <div className="flex flex-wrap gap-2 py-4 no-print">
          <div className="min-w-[200px] flex-1"><SearchInput value={search} onChange={setSearch} /></div>
          <Select
            className="w-full sm:w-auto"
            value={category}
            onChange={setCategory}
            options={[
              { value: 'all', label: t('common.all') + ' — ' + t('common.category') },
              ...CATEGORIES.map((c) => ({ value: c, label: t(`materials.cat.${c}` as never) })),
            ]}
          />
          <button
            className={onlyLow ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setOnlyLow((v) => !v)}
          >
            <AlertTriangle className="h-4 w-4" />
            {t('dash.lowStock')}
          </button>
        </div>

        <DataTable
          rows={filtered}
          initialSort={{ key: 'value', dir: 'desc' }}
          onRowClick={(m) => setEditing(db.materials.find((x) => x.id === m.id) ?? null)}
          columns={[
            {
              key: 'name', header: t('common.material'), sortValue: (m) => m.nameEn,
              render: (m) => (
                <div>
                  <p className="font-medium text-ink-900">{name(m)}</p>
                  <p className="text-xs text-ink-400 tnum">{m.code}{m.origin ? ` · ${m.origin}` : ''}</p>
                </div>
              ),
            },
            {
              key: 'cat', header: t('common.category'), sortValue: (m) => m.category,
              render: (m) => <Badge>{t(`materials.cat.${m.category}` as never)}</Badge>,
            },
            {
              key: 'cost', header: t('materials.costPerUnit'), align: 'end', sortValue: (m) => m.costPerUnit,
              render: (m) => <span className="tnum">{money(m.costPerUnit, m.costPerUnit < 1 ? 3 : 2)}<span className="text-ink-400">/{m.unit}</span></span>,
            },
            {
              key: 'stock', header: t('materials.stockQty'), align: 'end', sortValue: (m) => m.stockQty,
              render: (m) => (
                <div className="min-w-[110px]">
                  <p className={m.low ? 'text-rose-600 font-medium tnum' : 'tnum'}>{qty(m.stockQty, m.unit)}</p>
                  <MiniBar value={m.stockQty} max={Math.max(m.reorderLevel * 3, m.stockQty)} tone={m.low ? 'rose' : 'gold'} />
                  <p className="text-[10px] text-ink-400 mt-0.5 tnum">{t('materials.reorder')} {num(m.reorderLevel)}</p>
                </div>
              ),
            },
            { key: 'value', header: t('materials.stockValue'), align: 'end', sortValue: (m) => m.stockValue, render: (m) => <span className="tnum font-medium">{money(m.stockValue, 0)}</span> },
            {
              key: 'waste', header: t('prod.materialLoss'), align: 'end', sortValue: (m) => m.wastedCost,
              render: (m) => m.wastedCost > 0.5
                ? <span className="tnum text-rose-600">{money(m.wastedCost, 0)}</span>
                : <span className="text-ink-300">—</span>,
            },
            { key: 'sup', header: t('common.supplier'), sortValue: (m) => m.supplierName, render: (m) => <span className="text-ink-600 text-xs">{m.supplierName}</span> },
            {
              key: 'status', header: t('common.status'),
              render: (m) => m.low ? <Badge tone="red">{t('materials.lowStock')}</Badge> : <Badge tone="green">{t('materials.ok')}</Badge>,
            },
          ]}
        />
      </Card>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && db.materials.some((m) => m.id === editing.id) ? t('common.edit') : t('materials.new')}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            <button className="btn-gold" onClick={async () => { if (editing) { await save('materials', editing); setEditing(null) } }}>
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
            <Field label={t('common.category')}>
              <Select
                value={editing.category}
                onChange={(v) => setEditing({ ...editing, category: v as Material['category'] })}
                options={CATEGORIES.map((c) => ({ value: c, label: t(`materials.cat.${c}` as never) }))}
              />
            </Field>
            <Field label={t('common.name') + ' (EN)'}>
              <input className="input" value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} />
            </Field>
            <Field label={t('common.name') + ' (AR)'}>
              <input className="input" dir="rtl" value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} />
            </Field>
            <Field label={t('common.unit')}>
              <Select
                value={editing.unit}
                onChange={(v) => setEditing({ ...editing, unit: v as Material['unit'] })}
                options={(['ml', 'g', 'pcs'] as const).map((u) => ({ value: u, label: u }))}
              />
            </Field>
            <Field label={t('materials.costPerUnit')}>
              <input type="number" step="0.001" className="input" value={editing.costPerUnit} onChange={(e) => setEditing({ ...editing, costPerUnit: +e.target.value })} />
            </Field>
            <Field label={t('materials.stockQty')}>
              <input type="number" step="0.01" className="input" value={editing.stockQty} onChange={(e) => setEditing({ ...editing, stockQty: +e.target.value })} />
            </Field>
            <Field label={t('materials.reorder')}>
              <input type="number" className="input" value={editing.reorderLevel} onChange={(e) => setEditing({ ...editing, reorderLevel: +e.target.value })} />
            </Field>
            <Field label={t('common.supplier')}>
              <Select
                value={editing.supplierId ?? ''}
                onChange={(v) => setEditing({ ...editing, supplierId: v || null })}
                options={[{ value: '', label: t('common.none') }, ...db.suppliers.map((s) => ({ value: s.id, label: s.name }))]}
              />
            </Field>
            <Field label={t('materials.origin')}>
              <input className="input" value={editing.origin ?? ''} onChange={(e) => setEditing({ ...editing, origin: e.target.value })} />
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
