import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';
import type { DatasetMember, Role } from '../api/types';

interface DatasetSummary {
  id: number;
  name: string;
  is_owner?: boolean;
  my_role?: Role;
}

const roleLabels: Record<Role, string> = {
  owner: 'Владелец',
  labeler: 'Разметчик',
  observer: 'Наблюдатель',
};

export const MembersPage = () => {
  const { datasetId } = useParams();
  const id = Number(datasetId);
  const isValidDatasetId = Number.isInteger(id) && id > 0;
  const [datasetName, setDatasetName] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<Role, 'owner'>>('labeler');
  const [members, setMembers] = useState<DatasetMember[]>([]);
  const [isLoading, setIsLoading] = useState(isValidDatasetId);
  const [isInviting, setIsInviting] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [datasetsResponse, membersResponse] = await Promise.all([
        apiClient.get<{ items: DatasetSummary[] }>('/datasets/'),
        apiClient.get<DatasetMember[]>(`/datasets/${id}/members`),
      ]);
      const dataset = datasetsResponse.data.items.find((item) => item.id === id);
      setDatasetName(dataset?.name || `Датасет #${id}`);
      setCanManage(Boolean(dataset?.is_owner || dataset?.my_role === 'owner'));
      setMembers(membersResponse.data);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Не удалось загрузить участников датасета.'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isValidDatasetId) void loadData();
  }, [isValidDatasetId, loadData]);

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setIsInviting(true);
    try {
      const { data } = await apiClient.post<DatasetMember>(`/datasets/${id}/members`, {
        email: email.trim(),
        role,
      });
      setEmail('');
      setMembers((current) => [...current.filter((member) => member.user_id !== data.user_id), data]);
      setSuccess(data.email_notification_sent === false
        ? 'Приглашение создано и появилось у пользователя в уведомлениях, но письмо отправить не удалось.'
        : `Приглашение отправлено пользователю ${data.email}.`);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Не удалось отправить приглашение.'));
    } finally {
      setIsInviting(false);
    }
  };

  const changeRole = async (member: DatasetMember, nextRole: Exclude<Role, 'owner'>) => {
    setBusyMemberId(member.user_id);
    setError('');
    setSuccess('');
    try {
      const { data } = await apiClient.put<DatasetMember>(`/datasets/${id}/members/${member.user_id}`, {
        role: nextRole,
      });
      setMembers((current) => current.map((item) => item.user_id === data.user_id ? data : item));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Не удалось изменить роль участника.'));
    } finally {
      setBusyMemberId(null);
    }
  };

  const removeMember = async (member: DatasetMember) => {
    if (!window.confirm(`Удалить ${member.email} из датасета?`)) return;
    setBusyMemberId(member.user_id);
    setError('');
    setSuccess('');
    try {
      await apiClient.delete(`/datasets/${id}/members/${member.user_id}`);
      setMembers((current) => current.filter((item) => item.user_id !== member.user_id));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Не удалось удалить участника.'));
    } finally {
      setBusyMemberId(null);
    }
  };

  return (
    <section className="members-page">
      <Link to="/" className="page-back">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h12" /></svg>
        Назад к списку
      </Link>

      <header className="page-heading page-heading--stacked">
        <h1>Участники датасета</h1>
        <p className="members-heading__dataset">
          <strong>{datasetName || 'Загрузка датасета...'}</strong>
          <span>·</span>
          <span>Управление доступом и приглашения</span>
        </p>
      </header>

      <div className="members-layout">
        <div className="members-main">
          {canManage && (
            <section className="panel-surface members-invite">
              <h2 className="panel-heading">Пригласить участника</h2>
              <p className="panel-subtitle">Укажите почту зарегистрированного пользователя и выберите роль</p>

              {error && <div className="form-alert" role="alert">{error}</div>}
              {!isValidDatasetId && <div className="form-alert" role="alert">Некорректный адрес датасета.</div>}
              {success && <div className="form-alert members-success" role="status">{success}</div>}

              <form onSubmit={handleInvite} className="invite-form">
                <div className="invite-input-wrap">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@example.com"
                    aria-label="Email участника"
                    className="form-input"
                    required
                  />
                </div>

                <select value={role} onChange={(event) => setRole(event.target.value as Exclude<Role, 'owner'>)} className="form-select" aria-label="Роль участника">
                  <option value="labeler">Разметчик</option>
                  <option value="observer">Наблюдатель</option>
                </select>

                <button type="submit" className="button button--primary" disabled={isInviting}>
                  {isInviting ? 'Отправляем...' : 'Пригласить'}
                </button>
              </form>
            </section>
          )}

          {!canManage && !isLoading && (
            <div className="members-note" role="status">
              Управлять участниками и отправлять приглашения может только владелец датасета.
            </div>
          )}
          {!canManage && (error || success) && <div className="form-alert" role={error ? 'alert' : 'status'}>{error || success}</div>}

          <section className="panel-surface members-table">
            <h2 className="members-table__heading">Текущие участники <span>{members.length}</span></h2>

            <div className="members-table__columns">
              <span>Пользователь</span>
              <span>Роль</span>
              <span />
            </div>

            {isLoading ? (
              <div className="members-empty">Загружаем участников...</div>
            ) : members.length === 0 ? (
              <div className="members-empty">Пока никто не приглашён.</div>
            ) : members.map((member) => {
              const initials = (member.name || member.email || 'U').slice(0, 1).toUpperCase();
              return (
                <div key={member.user_id} className="member-row">
                  <div className="member-info">
                    <span className={member.role === 'owner' ? 'member-avatar member-avatar--owner' : 'member-avatar'} aria-hidden="true">
                      {initials}
                    </span>
                    <span className="member-info__text">
                      <span className="member-info__name">{member.name || member.email}</span>
                      <span className="member-info__email">
                        {member.email}{member.status === 'pending' ? ' · Ожидает ответа' : ''}
                      </span>
                    </span>
                  </div>

                  <select
                    value={member.role}
                    onChange={(event) => void changeRole(member, event.target.value as Exclude<Role, 'owner'>)}
                    disabled={!canManage || member.role === 'owner' || member.status === 'pending' || busyMemberId === member.user_id}
                    className="member-select"
                    aria-label={`Роль участника ${member.email}`}
                  >
                    {member.role === 'owner' && <option value="owner">Владелец</option>}
                    <option value="labeler">Разметчик</option>
                    <option value="observer">Наблюдатель</option>
                  </select>

                  {canManage && member.role !== 'owner' ? (
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => void removeMember(member)}
                      disabled={busyMemberId === member.user_id}
                      aria-label={`Удалить ${member.email}`}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" /></svg>
                    </button>
                  ) : <span />}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="members-side">
          <section className="panel-surface roles-panel">
            <h2 className="panel-heading">Роли и права</h2>

            <div className="role-list">
              <div className="role-description">
                <span className="role-description__icon role-description__icon--owner">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14a4 4 0 1 1 3.9 4.8L7 21H4v-3l2-2-1-2ZM15 5l4 4m-2-6 4 4" /></svg>
                </span>
                <span>
                  <strong>{roleLabels.owner}</strong>
                  <small>Полный доступ: управление, экспорт, удаление</small>
                </span>
              </div>

              <div className="role-description">
                <span className="role-description__icon role-description__icon--labeler">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6 4 4M4 20l4-1 11-11-3-3L5 16zM4 20h16" /></svg>
                </span>
                <span>
                  <strong>{roleLabels.labeler}</strong>
                  <small>Разметка и отправка на проверку</small>
                </span>
              </div>

              <div className="role-description">
                <span className="role-description__icon">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                </span>
                <span>
                  <strong>{roleLabels.observer}</strong>
                  <small>Просмотр датасета и результатов разметки</small>
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
};
