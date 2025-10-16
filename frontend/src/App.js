import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import WriterDashboard from './pages/WriterDashboard';
import BusinessDashboard from './pages/BusinessDashboard';
import DiscoverWriters from './pages/DiscoverWriters';
import { Toaster } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const axiosInstance = axios.create({
  baseURL: API,
  withCredentials: true
});

// Add auth token to requests
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for session_id in URL fragment (Emergent OAuth)
    const hash = window.location.hash;
    if (hash && hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1];
      processSessionId(sessionId);
      return;
    }

    // Check for existing session
    checkAuth();
  }, []);

  const processSessionId = async (sessionId) => {
    try {
      const { data } = await axiosInstance.get('/auth/session-data', {
        headers: { 'X-Session-ID': sessionId }
      });
      setUser(data);
      
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Navigate based on user type
      if (data.user_type === 'creative') {
        navigate('/writer/dashboard');
      } else {
        navigate('/business/dashboard');
      }
    } catch (error) {
      console.error('Session error:', error);
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      const { data } = await axiosInstance.get('/auth/me');
      setUser(data);
    } catch (error) {
      console.log('Not authenticated');
    } finally {
      setLoading(false);
    }
  };

  const ProtectedRoute = ({ children, requiredType }) => {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-blue-50 to-yellow-50">
          <div className="text-xl font-semibold">Loading...</div>
        </div>
      );
    }

    if (!user) {
      return <Navigate to="/auth" />;
    }

    if (requiredType && user.user_type !== requiredType) {
      return <Navigate to="/" />;
    }

    return children;
  };

  if (loading && !window.location.hash.includes('session_id=')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-blue-50 to-yellow-50">
        <div className="text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={user ? <Navigate to={user.user_type === 'creative' ? '/writer/dashboard' : '/business/dashboard'} /> : <LandingPage />} />
        <Route path="/auth" element={user ? <Navigate to={user.user_type === 'creative' ? '/writer/dashboard' : '/business/dashboard'} /> : <AuthPage setUser={setUser} />} />
        
        <Route path="/writer/dashboard" element={
          <ProtectedRoute requiredType="creative">
            <WriterDashboard user={user} setUser={setUser} />
          </ProtectedRoute>
        } />
        
        <Route path="/business/dashboard" element={
          <ProtectedRoute requiredType="business">
            <BusinessDashboard user={user} setUser={setUser} />
          </ProtectedRoute>
        } />
        
        <Route path="/discover" element={
          <ProtectedRoute requiredType="business">
            <DiscoverWriters user={user} />
          </ProtectedRoute>
        } />
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </div>
  );
}

export default App;