import { Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import BlockingBar from './components/BlockingBar';
import { ENABLE_WRITES } from './lib/env';
import { useState, useEffect } from 'react';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import AddClient from './pages/AddClient';
import VisitStart from './pages/VisitStart';
import VisitEnd from './pages/VisitEnd';
import QuickOrder from './pages/QuickOrder';
import Notes from './pages/Notes';
import Orders from './pages/Orders';
import Tasks from './pages/Tasks';
import Nearby from './pages/Nearby';
import RoutePlan from './pages/RoutePlan';

function AppContent() {
  const { user, loading } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle app errors gracefully
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {!ENABLE_WRITES && (
        <BlockingBar text="Demo mode - writes disabled. Actions will be queued." />
      )}
      
      {!isOnline && (
        <BlockingBar text="Offline — actions will be queued" />
      )}

      <main className={`pb-16 pt-16 ${!ENABLE_WRITES || !isOnline ? 'pt-28' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/clients/add" element={<AddClient />} />
          <Route path="/visit/start/:clientId" element={<VisitStart />} />
          <Route path="/visit/end/:clientId" element={<VisitEnd />} />
          <Route path="/order/quick/:clientId" element={<QuickOrder />} />
          <Route path="/notes/:clientId?" element={<Notes />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/nearby" element={<Nearby />} />
          <Route path="/route" element={<RoutePlan />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;