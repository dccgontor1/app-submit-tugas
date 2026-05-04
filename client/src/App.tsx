import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/AdminLoginPage';
import DashboardPage from './pages/DashboardPage';
import ErrorPage from './pages/ErrorPage';
import StudentLoginPage from './pages/SantriLoginPage';
import UjianAdminPage from './pages/UjianAdminPage';
import UjianSiswaPage from './pages/UjianSiswaPage';
import PenilaianPage from './pages/PenilaianPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<StudentLoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
           {/* Error pages */}
          <Route path="/401" element={<ErrorPage code={401} />} />
          <Route path="/403" element={<ErrorPage code={403} />} />
          <Route path="/500" element={<ErrorPage code={500} />} />

          {/* 404 — semua route yang tidak dikenal */}
          <Route path="*" element={<ErrorPage code={404} />} />
          <Route path="/ujian-admin" element={
          <ProtectedRoute>
            <UjianAdminPage />
          </ProtectedRoute>
        } />
        <Route path="/ujian" element={<UjianSiswaPage />} />
        <Route path="/penilaian" element={
            <ProtectedRoute>
              <PenilaianPage />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}