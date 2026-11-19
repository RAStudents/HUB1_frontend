import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';
import type { DatasetInvitation, Notification, NotificationPage as NotificationPageData } from '../api/types';

const dispatchNotificationsChanged = () => window.dispatchEvent(new Event('notifications:changed'));

const formatDate = (value: string) => new Date(value).toLocaleString('ru-RU', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [invitations, setInvitations] = useState<DatasetInvitation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationTotal, setNotificationTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [busyDatasetId, setBusyDatasetId] = useState<string | null>(null);
  const [busyNotificationId, setBusyNotificationId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    try {
      const [notificationResponse, invitationResponse] = await Promise.all([
        apiClient.get<NotificationPageData>('/notifications', { params: { page, page_size: 20 } }),
        apiClient.get<DatasetInvitation[]>('/invitations'),
      ]);
      setNotifications(notificationResponse.data.items);
      setUnreadCount(notificationResponse.data.unread_count);
      setNotificationTotal(notificationResponse.data.total);
      setInvitations(invitationResponse.data);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Не удалось загрузить уведомления.'));
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const respondToInvitation = async (datasetId: string, decision: 'accept' | 'decline') => {
    setBusyDatasetId(datasetId);
    setError('');
    try {
      await apiClient.post(`/invitations/${datasetId}/${decision}`);
      dispatchNotificationsChanged();
      await loadNotifications();
      if (decision === 'accept') navigate(`/datasets/${datasetId}/gallery`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Не удалось обработать приглашение.'));
    } finally {
      setBusyDatasetId(null);
    }
  };

  const markRead = async (notificationId: number) => {
    setBusyNotificationId(notificationId);
    setError('');
    try {
      await apiClient.post(`/notifications/${notificationId}/read`);
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, is_read: true } : item));
      setUnreadCount((current) => Math.max(0, current - 1));
      dispatchNotificationsChanged();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Не удалось отметить уведомление прочитанным.'));
    } finally {
      setBusyNotificationId(null);
    }
  };

  const markAllRead = async () => {
    setError('');
    try {
      await apiClient.post('/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
      dispatchNotificationsChanged();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Не удалось отметить уведомления прочитанными.'));
    }
  };

  const pageCount = Math.ceil(notificationTotal / 20);

  return (
    <section className="notifications-page">
      <header className="page-heading notifications-heading">
        <div>
          <h1>Уведомления</h1>
          <p>Приглашения и события ваших датасетов</p>
        </div>
        {unreadCount > 0 && (
          <button type="button" className="button button--quiet" onClick={() => void markAllRead()}>
            Отметить все прочитанными
          </button>
        )}
      </header>

      {error && <div className="form-alert" role="alert">{error}</div>}

      <section className="panel-surface notification-section" aria-labelledby="invitation-heading">
        <h2 id="invitation-heading" className="notification-section__title">
          Приглашения <span>{invitations.length}</span>
        </h2>
        {isLoading ? (
          <p className="notification-empty">Загружаем приглашения...</p>
        ) : invitations.length === 0 ? (
          <p className="notification-empty">Новых приглашений нет.</p>
        ) : (
          <div className="notification-list">
            {invitations.map((invitation) => (
              <article className="notification-card notification-card--invitation" key={invitation.dataset_id}>
                <div className="notification-card__body">
                  <strong>Приглашение в датасет «{invitation.dataset_name}»</strong>
                  <p>
                    {invitation.inviter_name} приглашает вас как{' '}
                    {invitation.role === 'labeler' ? 'разметчика' : 'наблюдателя'}.
                  </p>
                </div>
                <div className="notification-card__actions">
                  <button
                    className="button button--primary"
                    disabled={busyDatasetId === invitation.dataset_id}
                    onClick={() => void respondToInvitation(invitation.dataset_id, 'accept')}
                    type="button"
                  >
                    Принять
                  </button>
                  <button
                    className="button button--quiet"
                    disabled={busyDatasetId === invitation.dataset_id}
                    onClick={() => void respondToInvitation(invitation.dataset_id, 'decline')}
                    type="button"
                  >
                    Отклонить
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel-surface notification-section" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="notification-section__title">
          Все уведомления <span>{notificationTotal}</span>
        </h2>
        {isLoading ? (
          <p className="notification-empty">Загружаем уведомления...</p>
        ) : notifications.length === 0 ? (
          <p className="notification-empty">Пока уведомлений нет.</p>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => (
              <article
                className={`notification-card${notification.is_read ? '' : ' notification-card--unread'}`}
                key={notification.id}
              >
                <div className="notification-card__body">
                  <div className="notification-card__title-row">
                    <strong>{notification.title}</strong>
                    {!notification.is_read && <span className="notification-unread-label">Новое</span>}
                  </div>
                  <p>{notification.message}</p>
                  <time dateTime={notification.created_at}>{formatDate(notification.created_at)}</time>
                </div>
                <div className="notification-card__actions">
                  {notification.dataset_id && (
                    <Link className="button button--quiet" to={`/datasets/${notification.dataset_id}/gallery`}>
                      Открыть датасет
                    </Link>
                  )}
                  {!notification.is_read && (
                    <button
                      className="button button--quiet"
                      disabled={busyNotificationId === notification.id}
                      onClick={() => void markRead(notification.id)}
                      type="button"
                    >
                      Прочитано
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {pageCount > 1 && (
          <nav className="notification-pagination" aria-label="Страницы уведомлений">
            <button type="button" className="button button--quiet" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
              Назад
            </button>
            <span>Страница {page} из {pageCount}</span>
            <button type="button" className="button button--quiet" disabled={page === pageCount} onClick={() => setPage((current) => current + 1)}>
              Далее
            </button>
          </nav>
        )}
      </section>
    </section>
  );
};
