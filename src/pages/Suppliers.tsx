import { useMemo, useState } from 'react'
import { Plus, Star } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import { Badge, Card, DataTable, Field, Modal, PageHeader, SearchInput, StatCard } from '@/components/ui'
import { purchaseTotal, sum } from '@/lib/calc'
import type { Supplier } from '@/types'

const blank = (): Supplier => ({
  id: `sup-${Date.now()}`,
  code: '',
  name: '',
  phone: '',
  country: 'UAE',
  paymentTerms: 'Net 30',
  rating: 4,
})

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={i <= n ? 'h-3.5 w-3.5 fill-gold-400 text-gold-400' : 'h-3.5 w-3.5 text-ink-200'} />
      ))}
    </span>
  )
}

export default function Suppliers() {
  const { t, money, num } = useI18n()
  const { db, save } = useData()

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [detail, setDetail] = useState<Supplier | null>(null)

  const rows = useMemo(
    () =>
      db.suppliers.map((s) => {
        const pos = db.purchases.filter((p) => p.supplierId === s.id && p.status !== 'cancelled')
        const totalPurchased = sum(pos.map((p) => purchaseTotal(p).total))
        const outstanding = sum(pos.map((p) => Math.max(0, purchaseTotal(p).balance)))
        const mats = db.materials.filter((m) => m.supplierId === s.id)
        return { ...s, poCount: pos.length, totalPurchased, outstanding, materialCount: mats.length, materials: mats }
      }),
    [db]
  )

  const filtered = rows.filter((s) => {
    const q = search.toLowerCase()
    return !q || s.name.toLowerCase().includes(q) || s.country.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
  })

  const detailRow = detail ? rows.find((r) => r.id === detail.id) : null

  return (
    <>
      <PageHeader
        title={t('sup.title')}
        subtitle={t('sup.subtitle')}
        actions={
          <button className="btn-gold" onClick={() => setEditing(blank())}>
            <Plus className="h-4 w-4" />
            {t('sup.new')}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('sup.title')} value={num(db.suppliers.length)} />
        <StatCard label={t('sup.totalPurchased')} value={money(sum(rows.map((s) => s.totalPurchased)), 0)} />
        <StatCard label={t('acc.payables')} value={money(sum(rows.map((s) => s.outstanding)), 0)} tone="warn" />
        <StatCard label={t('common.country')} value={num(new Set(db.suppliers.map((s) => s.country)).size)} />
      </div>

      <Card bodyClassName="pt-0 pb-0">
        <div className="py-4 max-w-sm no-print"><SearchInput value={search} onChange={setSearch} /></div>
        <DataTable
          rows={filtered}
          onRowClick={(s) => setDetail(s)}
          initialSort={{ key: 'purchased', dir: 'desc' }}
          columns={[
            {
              key: 'name', header: t('common.name'), sortValue: (s) => s.name,
              render: (s) => (
                <div>
                  <p className="font-medium text-ink-900">{s.name}</p>
                  <p className="text-xs text-ink-400">{s.contactPerson ?? '—'} · {s.phone}</p>
                </div>
              ),
            },
            { key: 'country', header: t('common.country'), sortValue: (s) => s.country, render: (s) => <Badge>{s.country}</Badge> },
            { key: 'mats', header: t('sup.materialsSupplied'), align: 'end', sortValue: (s) => s.materialCount, render: (s) => <span className="tnum">{num(s.materialCount)}</span> },
            { key: 'pos', header: t('pur.title'), align: 'end', sortValue: (s) => s.poCount, render: (s) => <span className="tnum text-ink-500">{num(s.poCount)}</span> },
            { key: 'purchased', header: t('sup.totalPurchased'), align: 'end', sortValue: (s) => s.totalPurchased, render: (s) => <span className="tnum font-semibold">{money(s.totalPurchased, 0)}</span> },
            {
              key: 'out', header: t('common.balance'), align: 'end', sortValue: (s) => s.outstanding,
              render: (s) => s.outstanding > 0.5 ? <span className="tnum text-rose-600">{money(s.outstanding, 0)}</span> : <span className="text-ink-300">—</span>,
            },
            { key: 'terms', header: t('sup.terms'), render: (s) => <span className="text-xs text-ink-600">{s.paymentTerms}</span> },
            { key: 'rating', header: t('sup.rating'), sortValue: (s) => s.rating, render: (s) => <Stars n={s.rating} /> },
          ]}
        />
      </Card>

      <Modal
        open={!!detailRow}
        onClose={() => setDetail(null)}
        title={detailRow?.name ?? ''}
        wide
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDetail(null)}>{t('common.close')}</button>
            <button className="btn-primary" onClick={() => { setEditing(detail); setDetail(null) }}>{t('common.edit')}</button>
          </>
        }
      >
        {detailRow && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label={t('sup.totalPurchased')} value={money(detailRow.totalPurchased, 0)} />
              <StatCard label={t('pur.title')} value={num(detailRow.poCount)} />
              <StatCard label={t('common.balance')} value={money(detailRow.outstanding, 0)} tone={detailRow.outstanding > 0 ? 'warn' : 'good'} />
              <StatCard label={t('sup.materialsSupplied')} value={num(detailRow.materialCount)} />
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {([
                [t('sup.contact'), detailRow.contactPerson ?? '—'],
                [t('common.phone'), detailRow.phone],
                [t('common.email'), detailRow.email ?? '—'],
                [t('common.country'), detailRow.country],
                [t('sup.terms'), detailRow.paymentTerms],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 pb-1.5 border-b border-ink-100">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="text-ink-900 text-end break-all">{v}</dd>
                </div>
              ))}
            </dl>

            {detailRow.notes && <p className="text-sm text-ink-600 italic border-s-2 border-gold-300 ps-3">{detailRow.notes}</p>}

            <div>
              <h3 className="section-title mb-2">{t('sup.materialsSupplied')}</h3>
              <div className="flex flex-wrap gap-1.5">
                {detailRow.materials.map((m) => (
                  <Badge key={m.id} tone="gold">{m.nameEn}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && db.suppliers.some((s) => s.id === editing.id) ? t('common.edit') : t('sup.new')}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
            <button className="btn-gold" onClick={async () => { if (editing) { await save('suppliers', editing); setEditing(null) } }}>
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
            <Field label={t('common.name')}>
              <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </Field>
            <Field label={t('sup.contact')}>
              <input className="input" value={editing.contactPerson ?? ''} onChange={(e) => setEditing({ ...editing, contactPerson: e.target.value })} />
            </Field>
            <Field label={t('common.phone')}>
              <input className="input" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </Field>
            <Field label={t('common.email')}>
              <input className="input" type="email" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label={t('common.country')}>
              <input className="input" value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value })} />
            </Field>
            <Field label={t('sup.terms')}>
              <input className="input" value={editing.paymentTerms} onChange={(e) => setEditing({ ...editing, paymentTerms: e.target.value })} />
            </Field>
            <Field label={t('sup.rating')}>
              <input type="number" min={1} max={5} className="input" value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: +e.target.value })} />
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
