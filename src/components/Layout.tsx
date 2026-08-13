import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  LayoutDashboard, Package, FlaskConical, Beaker, Factory, Users, ShoppingCart,
  Truck, ClipboardList, Megaphone, Wallet, BarChart3, Settings as SettingsIcon,
  Menu, X, Languages, Database as DatabaseIcon, CloudOff, Gift,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { useData } from '@/store/DataContext'
import type { TranslationKey } from '@/i18n'

const NAV: Array<{ group: TranslationKey; items: Array<{ to: string; key: TranslationKey; icon: typeof Package }> }> = [
  {
    group: 'nav.group.overview',
    items: [{ to: '/', key: 'nav.dashboard', icon: LayoutDashboard }],
  },
  {
    group: 'nav.group.catalogue',
    items: [
      { to: '/products', key: 'nav.products', icon: Package },
      { to: '/materials', key: 'nav.materials', icon: Beaker },
      { to: '/formulas', key: 'nav.formulas', icon: FlaskConical },
      { to: '/production', key: 'nav.production', icon: Factory },
    ],
  },
  {
    group: 'nav.group.sales',
    items: [
      { to: '/customers', key: 'nav.customers', icon: Users },
      { to: '/orders', key: 'nav.orders', icon: ShoppingCart },
    ],
  },
  {
    group: 'nav.group.supply',
    items: [
      { to: '/suppliers', key: 'nav.suppliers', icon: Truck },
      { to: '/purchases', key: 'nav.purchases', icon: ClipboardList },
    ],
  },
  {
    group: 'nav.group.growth',
    items: [
      { to: '/marketing', key: 'nav.marketing', icon: Megaphone },
      { to: '/events', key: 'nav.events', icon: Gift },
      { to: '/accounting', key: 'nav.accounting', icon: Wallet },
      { to: '/reports', key: 'nav.reports', icon: BarChart3 },
    ],
  },
  {
    group: 'nav.group.system',
    items: [{ to: '/settings', key: 'nav.settings', icon: SettingsIcon }],
  },
]

function Brand() {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2.5 px-4 h-16 border-b border-ink-800/60">
      <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-gold-300 to-gold-600 grid place-items-center shadow-inner">
        <span className="text-ink-950 font-bold text-[11px] tracking-tight">HMY</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate">{t('app.name')}</p>
        <p className="text-[11px] text-ink-400 truncate">{t('app.subtitle')}</p>
      </div>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useI18n()
  return (
    <>
      <Brand />
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((section) => (
          <div key={section.group} className="mb-4">
            <p className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              {t(section.group)}
            </p>
            <ul className="space-y-0.5 px-2">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-gold-500/15 text-gold-200 font-medium'
                          : 'text-ink-300 hover:bg-white/5 hover:text-white'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(item.key)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  )
}

function DataSourceChip() {
  const { t } = useI18n()
  const { source } = useData()
  const isRemote = source === 'firestore'
  return (
    <span
      className={clsx(
        'hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        isRemote ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      )}
      title={isRemote ? t('set.connected') : t('set.localDesc')}
    >
      {isRemote ? <DatabaseIcon className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
      {isRemote ? t('set.connected') : t('set.local')}
    </span>
  )
}

export default function Layout() {
  const { t, lang, toggle } = useI18n()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex bg-ink-50">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-ink-950 no-print">
        <SidebarContent />
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex no-print">
          <div className="fixed inset-0 bg-ink-950/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 flex flex-col bg-ink-950">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur border-b border-ink-100 flex items-center gap-3 px-4 sm:px-6 no-print">
          <button
            className="lg:hidden text-ink-600 hover:text-ink-900"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="menu"
          >
            {mobileOpen ? <Menu className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex-1" />

          <DataSourceChip />

          <button
            onClick={toggle}
            className="btn-ghost !px-3 !py-1.5"
            title={t('set.language')}
          >
            <Languages className="h-4 w-4" />
            <span className="font-medium">{lang === 'en' ? 'العربية' : 'English'}</span>
          </button>

          <div className="h-9 w-9 rounded-full bg-gold-100 text-gold-800 grid place-items-center text-sm font-semibold">
            A
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          <Outlet />
        </main>

        <footer className="px-6 py-4 text-xs text-ink-400 border-t border-ink-100 no-print">
          {t('app.name')} · {t('app.subtitle')}
        </footer>
      </div>
    </div>
  )
}
