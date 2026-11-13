import { createBrowserRouter, Navigate, Outlet, Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth/AuthContext';

import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { YandexCallbackPage } from './auth/YandexCallbackPage';
import { DashboardPage } from './datasets/DashboardPage';
import { CreatePage } from './datasets/CreatePage';
import { MembersPage } from './datasets/MembersPage';
import { GalleryPage } from './inspect/GalleryPage'; // Импортируем страницу галереи
import { ProfilePage } from './profile/ProfilePage';
import { UserAvatar } from './auth/UserAvatar';
import { NotificationsPage } from './notifications/NotificationsPage';
import { apiClient } from './api/client';
import { useEffect, useState } from 'react';

// ============ LAYOUT ============
const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    const loadUnreadCount = async () => {
      try {
        const { data } = await apiClient.get<{ unread_count: number }>('/notifications', {
          params: { page: 1, page_size: 1 },
        });
        if (active) setUnreadCount(data.unread_count);
      } catch (error) {
        console.error('Не удалось загрузить счётчик уведомлений:', error);
      }
    };

    void loadUnreadCount();
    const intervalId = window.setInterval(loadUnreadCount, 60_000);
    window.addEventListener('notifications:changed', loadUnreadCount);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('notifications:changed', loadUnreadCount);
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="app-topbar__inner">
          <Link to="/" className="app-brand" aria-label="HUB, к датасетам">
            <span className="app-brand__logo" aria-hidden="true"><img src="/orange.svg" alt="" /></span>
            <span>HUB</span>
          </Link>
          <nav className="app-navigation" aria-label="Основная навигация">
            <Link to="/" className="app-navigation__link">Датасеты</Link>
            <Link to="/notifications" className="app-navigation__link app-navigation__notifications">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
              <span>Уведомления</span>
              {unreadCount > 0 && <span className="app-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </Link>
          </nav>
          <div className="app-account">
            <Link to="/profile" className="app-account__email" aria-label="Открыть профиль">
              {user?.email}
            </Link>
            <Link to="/profile" className="app-account__avatar" aria-label="Открыть профиль" title="Профиль">
              <UserAvatar
                className="app-account__avatar-image"
                email={user?.email}
                name={user?.display_name}
                src={user?.avatar_url}
              />
            </Link>
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
      { path: 'profile', element: <ProfilePage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'datasets/create', element: <CreatePage /> },
      { path: 'datasets/:datasetId/members', element: <MembersPage /> },
      { path: 'datasets/:datasetId/gallery', element: <GalleryPage /> }, // Динамический роут для галереи конкретного датасета
    ],
  },
]);