import { useState } from 'react'
import { CheckCircle2, CloudOff, Database, Languages, RefreshCw, Upload, XCircle } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import { Card, Field, PageHeader, Select, StatCard } from '@/components/ui'
import { seedCounts } from '@/data/seed'
import { projectId } from '@/lib/firebase'
import type { Settings as SettingsType } from '@/types'

export default function SettingsPage() {
  const { t, lang, setLang, num } = useI18n()
  const { settings, saveSettings, source, loadSeed, refresh, error, db } = useData()

  const [draft, setDraft] = useState<SettingsType>(settings)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [progress, setProgress] = useState<string[]>([])

  const counts = seedCounts()
  const isRemote = source === 'firestore'

  const runSeed = async () => {
    setSeeding(true)
    setSeedMsg(null)
    setProgress([])
    try {
      await loadSeed((m) => setProgress((p) => [...p, m]))
      setSeedMsg({ kind: 'ok', text: t('set.seedDone') })
    } catch (e) {
      setSeedMsg({ kind: 'err', text: `${t('set.seedFailed')} — ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setSeeding(false)
    }
  }

  return (
    <>
      <PageHeader title={t('set.title')} subtitle={t('set.subtitle')} />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title={t('set.company')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label={t('set.companyName')}>
              <input className="input" value={draft.companyName} onChange={(e) => setDraft({ ...draft, companyName: e.target.value })} />
            </Field>
            <Field label={t('set.companyNameAr')}>
              <input className="input" dir="rtl" value={draft.companyNameAr} onChange={(e) => setDraft({ ...draft, companyNameAr: e.target.value })} />
            </Field>
            <Field label={t('set.trn')}>
              <input className="input tnum" value={draft.trn ?? ''} onChange={(e) => setDraft({ ...draft, trn: e.target.value })} />
            </Field>
            <Field label={t('common.phone')}>
              <input className="input" value={draft.phone ?? ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </Field>
            <Field label={t('common.email')}>
              <input className="input" value={draft.email ?? ''} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </Field>
            <Field label={t('set.currency')}>
              <input className="input" value={draft.currency} disabled />
            </Field>
            <Field label={t('set.vatRate')}>
              <input
                type="number"
                step="0.01"
                className="input"
                value={draft.vatRate}
                onChange={(e) => setDraft({ ...draft, vatRate: +e.target.value })}
              />
            </Field>
            <Field label={t('set.address')} className="sm:col-span-2">
              <textarea className="input" rows={2} value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
            </Field>
          </div>
          <button className="btn-gold mt-4" onClick={() => saveSettings(draft)}>
            {t('common.save')}
          </button>
        </Card>

        <div className="space-y-4">
          <Card title={t('set.appearance')}>
            <Field label={t('set.language')}>
              <Select
                value={lang}
                onChange={(v) => setLang(v as 'en' | 'ar')}
                options={[
                  { value: 'en', label: 'English (LTR)' },
                  { value: 'ar', label: 'العربية (RTL)' },
                ]}
              />
            </Field>
            <p className="mt-2 text-xs text-ink-400 flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5" />
              {lang === 'en' ? 'Interface direction flips automatically.' : 'اتجاه الواجهة يتغيّر تلقائيًا.'}
            </p>
          </Card>

          <Card title={t('set.firebaseStatus')}>
            <div className="flex items-start gap-3">
              {isRemote ? (
                <Database className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <CloudOff className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">
                  {isRemote ? t('set.connected') : t('set.local')}
                </p>
                <p className="text-xs text-ink-500 mt-1">
                  {isRemote ? `Project: ${projectId}` : t('set.localDesc')}
                </p>
                {error && <p className="text-xs text-rose-600 mt-1.5">{error}</p>}
              </div>
            </div>
            {isRemote && (
              <button className="btn-ghost mt-3" onClick={() => void refresh()}>
                <RefreshCw className="h-4 w-4" />
                {t('common.loading')}
              </button>
            )}
          </Card>

          <Card title={t('set.data')} subtitle={t('set.dataSource')}>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatCard label={t('nav.products')} value={num(db.products.length)} />
              <StatCard label={t('nav.customers')} value={num(db.customers.length)} />
              <StatCard label={t('nav.orders')} value={num(db.orders.length)} />
            </div>

            <p className="text-sm text-ink-600 mb-3">{t('set.seedDesc')}</p>

            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-500 mb-4">
              {Object.entries(counts).map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-ink-100 py-0.5">
                  <span>{k}</span>
                  <span className="tnum font-medium text-ink-700">{num(v as number)}</span>
                </li>
              ))}
            </ul>

            <button className="btn-primary w-full" onClick={runSeed} disabled={seeding}>
              <Upload className="h-4 w-4" />
              {seeding ? t('set.seedRunning') : isRemote ? t('set.seed') : t('set.reset')}
            </button>

            {progress.length > 0 && (
              <ul className="mt-3 text-xs text-ink-400 space-y-0.5 max-h-32 overflow-y-auto tnum">
                {progress.map((p, i) => <li key={i}>✓ {p}</li>)}
              </ul>
            )}

            {seedMsg && (
              <p className={`mt-3 text-sm flex items-start gap-1.5 ${seedMsg.kind === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {seedMsg.kind === 'ok' ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                {seedMsg.text}
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  )
}
