import { createBrowserRouter, Navigate, Outlet, Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth/AuthContext';
import { useRole } from './auth/roles';

import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { YandexCallbackPage } from './auth/YandexCallbackPage';
import { DashboardPage } from './datasets/DashboardPage';
import { CreatePage } from './datasets/CreatePage';
import { MembersPage } from './datasets/MembersPage';
import { GalleryPage } from './inspect/GalleryPage'; // Импортируем страницу галереи

// ============ LAYOUT ============
const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar__inner">
          <Link to="/" className="app-brand" aria-label="HUB, к датасетам">
            <span className="app-brand__logo" aria-hidden="true"><img src="/brand-mark-app.svg" alt="" /></span>
            <span>HUB</span>
          </Link>
          <nav className="app-navigation" aria-label="Основная навигация">
            <Link to="/" className="app-navigation__link">Датасеты</Link>
          </nav>
          <div className="app-account">
            <span className="app-account__email">{user?.email}</span>
            <span className="app-account__avatar" aria-hidden="true">
              {(user?.display_name || user?.email || 'U').slice(0, 1).toUpperCase()}
            </span>
            <span className="app-account__divider" />
            <button type="button" className="app-logout" onClick={() => { logout(); navigate('/login'); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></svg>
              Выйти
            </button>
          </div>
        </div>
      </header>
      <main className="app-main"><Outlet /></main>
    </div>
  );
};

// ============ ROUTE GUARDS ============
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const GuestRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Загрузка...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// ============ ROUTER ============
export const router = createBrowserRouter([
  { path: '/login', element: <GuestRoute><LoginPage /></GuestRoute> },
  { path: '/register', element: <GuestRoute><RegisterPage /></GuestRoute> },
  { path: '/auth/yandex/callback', element: <YandexCallbackPage /> },
  {
    path: '/',
    element: <ProtectedRoute><Layout /></ProtectedRoute>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'datasets/create', element: <CreatePage /> },
      { path: 'datasets/:datasetId/members', element: <MembersPage /> },
      { path: 'datasets/:datasetId/gallery', element: <GalleryPage /> }, // Динамический роут для галереи конкретного датасета
    ],
  },
]);