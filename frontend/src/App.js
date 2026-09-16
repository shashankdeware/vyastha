import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './context/AuthContext';
import { EntitlementProvider } from './context/EntitlementContext';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingWizard from './pages/OnboardingWizard';
import DashboardPage from './pages/DashboardPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceBuilderPage from './pages/InvoiceBuilderPage';
import QuotationsPage from './pages/QuotationsPage';
import QuotationBuilderPage from './pages/QuotationBuilderPage';
import DraftsPage from './pages/DraftsPage';
import PaymentsPage from './pages/PaymentsPage';
import InventoryPage from './pages/InventoryPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';
import SubscriptionPage from './pages/SubscriptionPage';
import SubscriptionSuccessPage from './pages/SubscriptionSuccessPage';
import AdminPage from './pages/AdminPage';
import AnalyticsPage from './pages/AnalyticsPage';
import RemindersPage from './pages/RemindersPage';

function ProtectedRoute({ children, withLayout = true }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Loading Vyastha workspace...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return withLayout ? <Layout>{children}</Layout> : children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <EntitlementProvider>
          <Toaster position="top-right" richColors closeButton />
          <Routes>
            {/* Public */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />

            {/* Onboarding — protected but without global layout */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute withLayout={false}>
                  <OnboardingWizard />
                </ProtectedRoute>
              }
            />

            {/* Protected app routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/invoices"
              element={
                <ProtectedRoute>
                  <InvoicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices/new"
              element={
                <ProtectedRoute>
                  <InvoiceBuilderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices/edit/:id"
              element={
                <ProtectedRoute>
                  <InvoiceBuilderPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/quotations"
              element={
                <ProtectedRoute>
                  <QuotationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quotations/new"
              element={
                <ProtectedRoute>
                  <QuotationBuilderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quotations/edit/:id"
              element={
                <ProtectedRoute>
                  <QuotationBuilderPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/drafts"
              element={
                <ProtectedRoute>
                  <DraftsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute>
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <CustomersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription"
              element={
                <ProtectedRoute>
                  <SubscriptionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription/success"
              element={
                <ProtectedRoute withLayout={false}>
                  <SubscriptionSuccessPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reminders"
              element={
                <ProtectedRoute>
                  <RemindersPage />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </EntitlementProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
