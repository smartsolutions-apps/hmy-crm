import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import {
  Badge, Card, DataTable, Modal, PageHeader, SearchInput, Select, StatCard,
  exportCsv, statusTone,
} from '@/components/ui'
import { purchaseTotal, sum } from '@/lib/calc'
import type { Purchase } from '@/types'

export default function Purchases() {
  const { t, lang, money, num, date, qty } = useI18n()
  const { db } = useData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [detail, setDetail] = useState<Purchase | null>(null)

  const supName = (id: string) => db.suppliers.find((s) => s.id === id)?.name ?? '—'

  const rows = useMemo(
    () => db.purchases.map((p) => ({ ...p, totals: purchaseTotal(p), supplierName: supName(p.supplierId) })),
    [db]
  )

  const filtered = rows.filter((p) => {
    const q = search.toLowerCase()
    const matchQ = !q || p.poNo.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q)
    return matchQ && (status === 'all' || p.status === status)
  })

  const totalSpend = sum(rows.filter((p) => p.status !== 'cancelled').map((p) => p.totals.total))
  const payable = sum(rows.filter((p) => p.status !== 'cancelled').map((p) => Math.max(0, p.totals.balance)))
  const totalCustoms = sum(rows.map((p) => p.customsDuty + p.shipping))

  return (
    <>
      <PageHeader
        title={t('pur.title')}
        subtitle={t('pur.subtitle')}
        actions={
          <button
            className="btn-ghost"
            onClick={() =>
              exportCsv('purchase-orders.csv', filtered.map((p) => ({
                po_no: p.poNo, date: p.date, supplier: p.supplierName, status: p.status,
                payment: p.paymentStatus, goods_aed: +p.totals.goods.toFixed(2),
                shipping_aed: p.shipping, customs_aed: p.customsDuty,
                total_aed: +p.totals.total.toFixed(2), paid_aed: p.amountPaid,
                balance_aed: +p.totals.balance.toFixed(2),
              })))
            }
          >
            <Download className="h-4 w-4" />
            {t('common.export')}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <StatCard label={t('pur.title')} value={num(db.purchases.length)} />
        <StatCard label={t('sup.totalPurchased')} value={money(totalSpend, 0)} />
        <StatCard label={t('acc.payables')} value={money(payable, 0)} tone={payable > 0 ? 'warn' : 'good'} />
        <StatCard label={`${t('common.shipping')} + ${t('pur.customs')}`} value={money(totalCustoms, 0)} />
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
              ...(['ordered', 'partial', 'received', 'cancelled'] as const).map((s) => ({
                value: s, label: t(`pur.status.${s}` as never),
              })),
            ]}
          />
        </div>

        <DataTable
          rows={filtered}
          onRowClick={(p) => setDetail(p)}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'po', header: t('pur.poNo'), sortValue: (p) => p.poNo, render: (p) => <span className="font-medium tnum">{p.poNo}</span> },
            { key: 'sup', header: t('common.supplier'), sortValue: (p) => p.supplierName, render: (p) => <span>{p.supplierName}</span> },
            { key: 'date', header: t('common.date'), sortValue: (p) => p.date, render: (p) => <span className="text-ink-500">{date(p.date)}</span> },
            { key: 'exp', header: t('pur.expected'), sortValue: (p) => p.expectedDate ?? '', render: (p) => <span className="text-ink-500 text-xs">{date(p.expectedDate)}</span> },
            { key: 'items', header: t('orders.items'), align: 'end', sortValue: (p) => p.items.length, render: (p) => <span className="tnum text-ink-500">{num(p.items.length)}</span> },
            { key: 'total', header: t('common.total'), align: 'end', sortValue: (p) => p.totals.total, render: (p) => <span className="tnum font-semibold">{money(p.totals.total, 0)}</span> },
            {
              key: 'bal', header: t('common.balance'), align: 'end', sortValue: (p) => p.totals.balance,
              render: (p) => p.totals.balance > 0.5 ? <span className="tnum text-rose-600">{money(p.totals.balance, 0)}</span> : <span className="text-ink-300">—</span>,
            },
            { key: 'status', header: t('common.status'), render: (p) => <Badge tone={statusTone(p.status)}>{t(`pur.status.${p.status}` as never)}</Badge> },
            { key: 'pay', header: t('orders.payment'), render: (p) => <Badge tone={statusTone(p.paymentStatus)}>{t(`orders.pay.${p.paymentStatus}` as never)}</Badge> },
          ]}
        />
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.poNo ?? ''} wide>
        {detail && (() => {
          const totals = purchaseTotal(detail)
          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">{supName(detail.supplierId)}</p>
                  <p className="text-xs text-ink-500">{date(detail.date)} · {t('pur.expected')} {date(detail.expectedDate)}</p>
                </div>
                <div className="flex gap-1.5">
                  <Badge tone={statusTone(detail.status)}>{t(`pur.status.${detail.status}` as never)}</Badge>
                  <Badge tone={statusTone(detail.paymentStatus)}>{t(`orders.pay.${detail.paymentStatus}` as never)}</Badge>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="th">{t('common.material')}</th>
                      <th className="th text-end">{t('common.qty')}</th>
                      <th className="th text-end">{t('materials.costPerUnit')}</th>
                      <th className="th text-end">{t('orders.lineTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((i, idx) => {
                      const m = db.materials.find((x) => x.id === i.materialId)
                      return (
                        <tr key={idx}>
                          <td className="td">{m ? (lang === 'ar' ? m.nameAr : m.nameEn) : i.materialId}</td>
                          <td className="td text-end tnum">{qty(i.qty, m?.unit ?? '')}</td>
                          <td className="td text-end tnum text-ink-500">{money(i.unitCost, i.unitCost < 1 ? 3 : 2)}</td>
                          <td className="td text-end tnum font-medium">{money(i.qty * i.unitCost)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <dl className="ms-auto max-w-xs space-y-1.5 text-sm">
                {([
                  [t('common.subtotal'), money(totals.goods)],
                  [t('common.shipping'), money(detail.shipping)],
                  [t('pur.customs'), money(detail.customsDuty)],
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
    </>
  )
}
