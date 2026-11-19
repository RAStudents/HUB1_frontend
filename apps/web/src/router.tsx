import { isPublicDatasetId } from './api/datasetId';
import { createBrowserRouter, Navigate, Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth/AuthContext';

import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { YandexCallbackPage } from './auth/YandexCallbackPage';
import { DashboardPage } from './datasets/DashboardPage';
import { CreatePage } from './datasets/CreatePage';
import { UploadFramesPage } from './datasets/UploadFramesPage';
import { DatasetStatisticsPage } from './datasets/DatasetStatisticsPage';
import { MembersPage } from './datasets/MembersPage';
import { GalleryPage } from './inspect/GalleryPage'; // Импортируем страницу галереи
import { AnnotationEditorPage } from './inspect/AnnotationEditorPage';
import { ProfilePage } from './profile/ProfilePage';
import { UserAvatar } from './auth/UserAvatar';
import { NotificationsPage } from './notifications/NotificationsPage';
import { ReviewPage } from './review/ReviewPage';
import { apiClient } from './api/client';
import { useEffect, useState } from 'react';

// ============ LAYOUT ============
const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingInvitationCount, setPendingInvitationCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const notificationBadgeCount = Math.max(unreadCount, pendingInvitationCount);
  const isDatasetsActive = location.pathname === '/' || location.pathname.startsWith('/datasets/');
  const isReviewActive = location.pathname === '/review';
  const isNotificationsActive = location.pathname === '/notifications';

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

    const loadPendingInvitationCount = async () => {
      try {
        const { data } = await apiClient.get<Array<{ dataset_id: string }>>('/invitations');
        if (active) setPendingInvitationCount(data.length);
      } catch (error) {
        console.error('Не удалось загрузить счётчик приглашений:', error);
      }
    };

    const loadReviewCount = async () => {
      try {
        const { data } = await apiClient.get<{ items: Array<{
          id: number;
          is_owner?: boolean;
          my_role?: string;
        }> }>('/datasets/');
        const ownedDatasets = (data.items || []).filter(
          (dataset) => dataset.is_owner || dataset.my_role === 'owner',
        );
        const queues = await Promise.all(ownedDatasets.map(({ id }) => (
          apiClient.get<{ total: number }>(`/datasets/${id}/samples`, {
            params: { status: 'in_review', page: 1, page_size: 1 },
          })
        )));
        if (active) setReviewCount(queues.reduce((total, { data: queue }) => total + queue.total, 0));
      } catch (error) {
        console.error('Не удалось загрузить счётчик проверки:', error);
      }
    };

    void loadUnreadCount();
    void loadPendingInvitationCount();
    void loadReviewCount();
    const refreshNotificationCounts = () => {
      void loadUnreadCount();
      void loadPendingInvitationCount();
    };
    const refreshCounts = () => {
      refreshNotificationCounts();
      void loadReviewCount();
    };
    const intervalId = window.setInterval(refreshCounts, 60_000);
    const notificationIntervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshNotificationCounts();
    }, 15_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshNotificationCounts();
    };
    window.addEventListener('notifications:changed', refreshNotificationCounts);
    window.addEventListener('review-queue:changed', loadReviewCount);
    window.addEventListener('focus', refreshNotificationCounts);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.clearInterval(notificationIntervalId);
      window.removeEventListener('notifications:changed', refreshNotificationCounts);
      window.removeEventListener('review-queue:changed', loadReviewCount);
      window.removeEventListener('focus', refreshNotificationCounts);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
            <Link
              to="/"
              aria-current={isDatasetsActive ? 'page' : undefined}
              className={`app-navigation__link${isDatasetsActive ? ' app-navigation__link--active' : ''}`}
            >
              Датасеты
            </Link>
            <Link
              to="/review"
              aria-current={isReviewActive ? 'page' : undefined}
              className={`app-navigation__link app-navigation__review${isReviewActive ? ' app-navigation__link--active' : ''}`}
            >
              Проверка
              {reviewCount > 0 && <span className="app-notification-count">{reviewCount > 99 ? '99+' : reviewCount}</span>}
            </Link>
            <Link
              to="/notifications"
              aria-current={isNotificationsActive ? 'page' : undefined}
              className={`app-navigation__link app-navigation__notifications${isNotificationsActive ? ' app-navigation__link--active' : ''}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
              <span>Уведомления</span>
              {notificationBadgeCount > 0 && <span className="app-notification-count">{notificationBadgeCount > 99 ? '99+' : notificationBadgeCount}</span>}
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
      <main className={`app-main${location.pathname.includes('/annotate/') ? ' app-main--editor' : ''}`}><Outlet /></main>
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

const DatasetRoute = () => {
  const { datasetId } = useParams();
  return isPublicDatasetId(datasetId) ? <Outlet /> : <Navigate to="/" replace />;
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
      { path: 'review', element: <ReviewPage /> },
      { path: 'datasets/create', element: <CreatePage /> },
      { path: 'datasets/:datasetId', element: <DatasetRoute />, children: [
        { path: 'upload', element: <UploadFramesPage /> },
        { path: 'statistics', element: <DatasetStatisticsPage /> },
        { path: 'members', element: <MembersPage /> },
        { path: 'gallery', element: <GalleryPage /> },
        { path: 'annotate/:sampleId', element: <AnnotationEditorPage /> },
      ] },
    ],
  },
]);