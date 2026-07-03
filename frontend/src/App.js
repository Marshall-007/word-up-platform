import { useState, useEffect } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import WriterDashboard from './pages/WriterDashboard';
import BusinessDashboard from './pages/BusinessDashboard';
import DiscoverWriters from './pages/DiscoverWriters';
import AccountInfo from './pages/AccountInfo';
import Settings from './pages/Settings';
import Help from './pages/Help';
import { Toaster, toast } from 'sonner';

// Dynamically resolve backend URL so mobile devices on the same network work.
// If the browser loaded from an IP (e.g. 10.0.0.14), API calls go to that IP too.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = (() => {
  try {
    const backendUrl = new URL(BACKEND_URL);
    // If the configured backend host is localhost/127.0.0.1 but we're
    // accessing from a different hostname (mobile on LAN), swap it.
    if (
      (backendUrl.hostname === 'localhost' || backendUrl.hostname === '127.0.0.1') &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      backendUrl.hostname = window.location.hostname;
    }
    return `${backendUrl.origin}/api`;
  } catch {
    return `${BACKEND_URL}/api`;
  }
})();

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

// Clear a stale/expired token on any 401 so we don't keep sending it.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('auth_token')) {
      localStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
  }
);

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
      // Retrieve the user type they chose before the OAuth redirect
      const chosenType = sessionStorage.getItem('google_oauth_user_type') || 'creative';
      sessionStorage.removeItem('google_oauth_user_type');
      
      const { data } = await axiosInstance.get('/auth/session-data', {
        headers: { 
          'X-Session-ID': sessionId,
          'X-User-Type': chosenType
        }
      });
      
      // Store JWT token if the backend returned one
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }
      
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
      toast.error('Sign-in failed. Please try again.');
      // Clean the OAuth params out of the URL and return to the auth page.
      window.history.replaceState({}, document.title, window.location.pathname);
      setLoading(false);
      navigate('/auth');
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
        
        <Route path="/account" element={
          <ProtectedRoute>
            <AccountInfo user={user} setUser={setUser} />
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings user={user} />
          </ProtectedRoute>
        } />
        
        <Route path="/help" element={
          <ProtectedRoute>
            <Help user={user} />
          </ProtectedRoute>
        } />
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  );
}

function App() {
  // PUBLIC_URL is set from package.json "homepage" at build time (e.g.
  // /word-up-platform on GitHub Pages), and is empty in local dev.
  const basename = process.env.PUBLIC_URL || undefined;
  return (
    <div className="App">
      <BrowserRouter basename={basename}>
        <AppContent />
      </BrowserRouter>
    </div>
  );
}

export default App;