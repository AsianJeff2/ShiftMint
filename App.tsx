
import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useLocalAuth } from '@/contexts/LocalAuthContext'
import { DataProvider } from '@/contexts/DataContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './App.css'

import AuthPage from '@/components/auth/AuthPage'
const Dashboard = React.lazy(() => import('@/pages/Dashboard'))
const Tips = React.lazy(() => import('@/pages/Tips'))
const Shifts = React.lazy(() => import('@/pages/Shifts'))
const Employees = React.lazy(() => import('@/pages/Employees'))
const Payroll = React.lazy(() => import('@/pages/Payroll'))
const Settings = React.lazy(() => import('@/pages/Settings'))
const ErrorDetection = React.lazy(() => import('@/pages/ErrorDetection'))
const Index = React.lazy(() => import('@/pages/Index'))
import NotFound from '@/pages/NotFound'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Permission } from '@/lib/security/rbac'

// Loading component
const LoadingSpinner = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      <p className="mt-4 text-gray-600">Loading ShiftMint...</p>
    </div>
  </div>
)

// Error display component
const ErrorDisplay = ({ error }: { error: string }) => (
  <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
    <div className="text-center max-w-md mx-auto p-6">
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
      <p className="text-gray-600">Please refresh the page or contact support if the problem persists.</p>
    </div>
  </div>
)

const App: React.FC = () => {
  const { user, loading, requiresSetup, isConfigured, error } = useLocalAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorDisplay error={error} />
  }

  // If app requires setup or not authenticated, show unified auth page
  if (requiresSetup || !isConfigured || !user) {
    return <AuthPage />
  }

  // User is authenticated, show main app with error boundaries
  return (
    <ErrorBoundary context="App">
      <DataProvider key={`${user.id}:${user.businessId}:${user.role}`}>
        <Layout>
          <ErrorBoundary context="MainLayout">
            <Suspense fallback={<LoadingSpinner />}><Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <ErrorBoundary context="Dashboard">
                    <Dashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/tips" element={
                <ProtectedRoute permission={Permission.TIPS_VIEW}>
                  <ErrorBoundary context="Tips">
                    <Tips />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/shifts" element={
                <ProtectedRoute permission={Permission.SHIFTS_VIEW}>
                  <ErrorBoundary context="Shifts">
                    <Shifts />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/employees" element={
                <ProtectedRoute permission={Permission.EMPLOYEES_VIEW}>
                  <ErrorBoundary context="Employees">
                    <Employees />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/payroll" element={
                <ProtectedRoute permission={Permission.PAYROLL_VIEW}>
                  <ErrorBoundary context="Payroll">
                    <Payroll />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <ErrorBoundary context="Settings">
                    <Settings />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/error-detection" element={
                <ProtectedRoute permission={Permission.SHIFTS_VIEW}>
                  <ErrorBoundary context="ErrorDetection">
                    <ErrorDetection />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/welcome" element={<Index />} />
              <Route path="*" element={<NotFound />} />
            </Routes></Suspense>
          </ErrorBoundary>
        </Layout>
      </DataProvider>
    </ErrorBoundary>
  )
}

export default App
