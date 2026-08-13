import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from '@/components/Layout'
import { useData } from '@/store/DataContext'
import { useI18n } from '@/i18n'

import Dashboard from '@/pages/Dashboard'
import Products from '@/pages/Products'
import Materials from '@/pages/Materials'
import Formulas from '@/pages/Formulas'
import Production from '@/pages/Production'
import Customers from '@/pages/Customers'
import CustomerDetail from '@/pages/CustomerDetail'
import Orders from '@/pages/Orders'
import Suppliers from '@/pages/Suppliers'
import Purchases from '@/pages/Purchases'
import Marketing from '@/pages/Marketing'
import Events from '@/pages/Events'
import Accounting from '@/pages/Accounting'
import Reports from '@/pages/Reports'
import SettingsPage from '@/pages/Settings'

function Splash() {
  const { t } = useI18n()
  return (
    <div className="min-h-screen grid place-items-center bg-ink-50">
      <div className="text-center">
        <div className="h-12 w-12 mx-auto rounded-xl bg-gradient-to-br from-gold-300 to-gold-600 grid place-items-center animate-pulse">
          <span className="text-ink-950 font-bold text-xs">HMY</span>
        </div>
        <p className="mt-4 text-sm text-ink-500">{t('common.loading')}</p>
      </div>
    </div>
  )
}

export default function App() {
  const { loading } = useData()
  if (loading) return <Splash />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="materials" element={<Materials />} />
        <Route path="formulas" element={<Formulas />} />
        <Route path="production" element={<Production />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="orders" element={<Orders />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="events" element={<Events />} />
        <Route path="accounting" element={<Accounting />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
