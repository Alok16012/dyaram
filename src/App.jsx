import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { PackageProvider } from './context/PackageContext'
import { CRMProvider }     from './context/CRMContext'
import { BookingProvider } from './context/BookingContext'
import { isAdmin, hasAccess } from './lib/auth'

// Each page is its own lazy chunk so the browser only downloads the code
// for the page the user actually opens, instead of one giant bundle upfront.

// Itinerary Maker pages
const Home    = lazy(() => import('./pages/Home'))
const Editor  = lazy(() => import('./pages/Editor'))
const Admin   = lazy(() => import('./pages/Admin'))

// CRM pages
const Dashboard     = lazy(() => import('./pages/crm/Dashboard'))
const Leads         = lazy(() => import('./pages/crm/Leads'))
const Bookings      = lazy(() => import('./pages/crm/Bookings'))
const BookingDetail = lazy(() => import('./pages/crm/BookingDetail'))

// Itinerary listing
const Itinerary = lazy(() => import('./pages/Itinerary'))

// Resources & Admin (placeholders)
const Invoices  = lazy(() => import('./pages/Invoices'))
const InvoiceGenerator = lazy(() => import('./pages/InvoiceGenerator'))
const Hotels    = lazy(() => import('./pages/Hotels'))
const Cabs      = lazy(() => import('./pages/Cabs'))
const Photos    = lazy(() => import('./pages/Photos'))
const Income    = lazy(() => import('./pages/Income'))
const Expenses  = lazy(() => import('./pages/Expenses'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const WebsiteContent = lazy(() => import('./pages/WebsiteContent'))
const WebsitePackages = lazy(() => import('./pages/WebsitePackages'))
const NewsletterSubscribers = lazy(() => import('./pages/NewsletterSubscribers'))

// Auth & Public
const Login       = lazy(() => import('./pages/Login'))
const BookingForm = lazy(() => import('./pages/BookingForm'))

// Layout
import MainLayout from './components/MainLayout'

function PageFallback() {
  return <div className="loading-state"><div className="spinner" /></div>
}

// Styles
import './styles/index.css'

const ProtectedRoute = ({ children, module }) => {
  const isAuth = localStorage.getItem('shara_auth') === 'true'
  if (!isAuth) return <Navigate to="/login" replace />
  if (module && !hasAccess(module)) return <Navigate to="/" replace />
  return <MainLayout>{children}</MainLayout>
}

const AdminRoute = ({ children }) => {
  const isAuth = localStorage.getItem('shara_auth') === 'true'
  if (!isAuth) return <Navigate to="/login" replace />
  if (!isAdmin()) return <Navigate to="/" replace />
  return <MainLayout>{children}</MainLayout>
}

const StandaloneRoute = ({ children }) => {
  const isAuth = localStorage.getItem('shara_auth') === 'true'
  return isAuth ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <PackageProvider>
        <CRMProvider>
          <BookingProvider>
            <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* ── Public ── */}
              <Route path="/login" element={<Login />} />
              <Route path="/booking/form/:token" element={<BookingForm />} />

              {/* ── Protected Dashboard ── */}
              <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
              <Route path="/itinerary" element={<ProtectedRoute module="itinerary"><Itinerary /></ProtectedRoute>} />
              <Route path="/editor/:id" element={<StandaloneRoute><Editor /></StandaloneRoute>} />
              <Route path="/admin" element={<ProtectedRoute module="admin"><Admin /></ProtectedRoute>} />
              <Route path="/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
              <Route path="/website-content" element={<AdminRoute><WebsiteContent /></AdminRoute>} />
              <Route path="/website-packages" element={<AdminRoute><WebsitePackages /></AdminRoute>} />
              <Route path="/newsletter" element={<ProtectedRoute module="leads"><NewsletterSubscribers /></ProtectedRoute>} />

              <Route path="/leads" element={<ProtectedRoute module="leads"><Leads /></ProtectedRoute>} />
              <Route path="/bookings" element={<ProtectedRoute module="bookings"><Bookings /></ProtectedRoute>} />
              <Route path="/bookings/:id" element={<ProtectedRoute module="bookings"><BookingDetail /></ProtectedRoute>} />

              {/* ── Operations / Resources / Admin ── */}
              <Route path="/invoices" element={<ProtectedRoute module="invoices"><Invoices /></ProtectedRoute>} />
              <Route path="/invoices/new" element={<ProtectedRoute module="invoices"><InvoiceGenerator /></ProtectedRoute>} />
              <Route path="/invoices/:id/edit" element={<ProtectedRoute module="invoices"><InvoiceGenerator /></ProtectedRoute>} />
              <Route path="/hotels" element={<ProtectedRoute module="hotels"><Hotels /></ProtectedRoute>} />
              <Route path="/cabs" element={<ProtectedRoute module="cabs"><Cabs /></ProtectedRoute>} />
              <Route path="/photos" element={<ProtectedRoute module="photos"><Photos /></ProtectedRoute>} />
              <Route path="/income" element={<ProtectedRoute module="income"><Income /></ProtectedRoute>} />
              <Route path="/expenses" element={<ProtectedRoute module="expenses"><Expenses /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute module="audit_logs"><AuditLogs /></ProtectedRoute>} />
            </Routes>
            </Suspense>

            <Toaster
              position="bottom-center"
              toastOptions={{
                style: {
                  borderRadius: '10px',
                  background: '#1a1a1a',
                  color: '#fff',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif',
                },
                success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
                error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
              }}
            />
          </BookingProvider>
        </CRMProvider>
      </PackageProvider>
    </BrowserRouter>
  )
}
