// apps/web/src/datasets/MembersPage.tsx
import { useState, FormEvent, useEffect } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useRole } from '../auth/roles';
import { apiClient } from '../api/client';
import { Member, Role } from '../api/types';

export const MembersPage = () => {
  const { id: datasetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [datasetRole, setDatasetRole] = useState<Role | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('labeler');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [datasetId]);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      // TODO: заменить на реальный эндпоинт
      // const res = await apiClient.get<{ role: Role; members: Member[] }>(
      //   `/datasets/${datasetId}/members`
      // );
      // setDatasetRole(res.data.role);
      // setMembers(res.data.members);

      // Заглушка — текущий пользователь как владелец
      setDatasetRole('owner');
      setMembers(
        user
          ? [
              {
                id: '1',
                user: {
                  id: user.id,
                  email: user.email,
                  display_name: user.display_name,
                },
                role: 'owner',
                joined_at: new Date().toISOString(),
              },
            ]
          : []
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка загрузки участников');
    } finally {
      setIsLoading(false);
    }
  };

  const { isOwner } = useRole(datasetRole);

  // Если не владелец — редирект на главную (права проверяются и на API)
  if (datasetRole && !isOwner) {
    return <Navigate to="/" replace />;
  }

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Введите email');
      return;
    }

    try {
      // TODO: заменить на реальный эндпоинт
      // await apiClient.post(`/datasets/${datasetId}/members`, { email, role });
      // setSuccess(`Приглашение отправлено на ${email}`);
      // setEmail('');
      // loadMembers();

      alert(`Приглашение отправлено: ${email} (${role}) — заглушка`);
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка приглашения');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    try {
      // TODO: заменить на реальный эндпоинт
      // await apiClient.patch(`/datasets/${datasetId}/members/${memberId}`, { role: newRole });
      // loadMembers();

      alert(`Роль изменена на ${newRole} — заглушка`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка смены роли');
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Удалить участника из датасета?')) return;

    try {
      // TODO: заменить на реальный эндпоинт
      // await apiClient.delete(`/datasets/${datasetId}/members/${memberId}`);
      // loadMembers();

      alert('Участник удалён — заглушка');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка удаления');
    }
  };

  const roleLabels: Record<Role, string> = {
    owner: 'Владелец',
    labeler: 'Разметчик',
    observer: 'Наблюдатель',
  };

  const roleDescriptions: Record<Role, string> = {
    owner: 'Полный доступ: управление, экспорт, удаление',
    labeler: 'Разметка и отправка на проверку',
    observer: 'Только просмотр',
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
          <strong>Cats and Dogs</strong><span>·</span><span>Управление доступом и приглашения</span>
        </p>
      </header>

      <div className="members-layout">
        <div className="members-main">
          <section className="panel-surface members-invite">
            <h2 className="panel-heading">Пригласить участника</h2>
            <p className="panel-subtitle">Укажите почту человека и выберите роль в этом датасете</p>
            {error && <div className="form-alert" role="alert">{error}</div>}
            {success && <div className="form-alert members-success" role="status">{success}</div>}
            <form onSubmit={handleInvite} className="invite-form">
              <div className="invite-input-wrap">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  aria-label="Email участника"
                  required
                  className="form-input"
                />
              </div>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="form-select" aria-label="Роль участника">
                <option value="labeler">Разметчик</option>
                <option value="observer">Наблюдатель</option>
              </select>
              <button type="submit" className="button button--primary">Пригласить</button>
            </form>
          </section>

          <section className="panel-surface members-table">
            <h2 className="members-table__heading">Текущие участники <span>{members.length}</span></h2>
            {isLoading ? (
              <div className="members-empty">Загрузка списка участников...</div>
            ) : members.length === 0 ? (
              <div className="members-empty">Пока нет участников. Пригласите первого по email.</div>
            ) : (
              <>
                <div className="members-table__columns"><span>Пользователь</span><span>Роль</span><span /></div>
                {members.map((member) => (
                  <div key={member.id} className="member-row">
                    <div className="member-info">
                      <span className={member.role === 'owner' ? 'member-avatar member-avatar--owner' : 'member-avatar'} aria-hidden="true">
                        {(member.user.display_name || member.user.email || 'U').slice(0, 1).toUpperCase()}
                      </span>
                      <span className="member-info__text">
                        <span className="member-info__name">{member.user.display_name || member.user.email}</span>
                        <span className="member-info__email">{member.user.email}</span>
                      </span>
                    </div>
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                      disabled={member.role === 'owner'}
                      className="member-select"
                      aria-label={`Роль участника ${member.user.email}`}
                    >
                      <option value="owner">Владелец</option>
                      <option value="labeler">Разметчик</option>
                      <option value="observer">Наблюдатель</option>
                    </select>
                    {member.role !== 'owner' ? (
                      <button type="button" className="icon-button" onClick={() => handleRemove(member.id)} aria-label={`Удалить ${member.user.email}`}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" /></svg>
                      </button>
                    ) : <span />}
                  </div>
                ))}
              </>
            )}
          </section>
        </div>

        <aside className="members-side">
          <section className="panel-surface roles-panel">
            <h2 className="panel-heading">Роли и права</h2>
            <div className="role-list">
              <div className="role-description">
                <span className="role-description__icon role-description__icon--owner"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14a4 4 0 1 1 3.9 4.8L7 21H4v-3l2-2-1-2ZM15 5l4 4m-2-6 4 4" /></svg></span>
                <span><strong>{roleLabels.owner}</strong><small>Полный доступ: управление, экспорт, удаление</small></span>
              </div>
              <div className="role-description">
                <span className="role-description__icon role-description__icon--labeler"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6 4 4M4 20l4-1 11-11-3-3L5 16zM4 20h16" /></svg></span>
                <span><strong>{roleLabels.labeler}</strong><small>Разметка и отправка на проверку</small></span>
              </div>
              <div className="role-description">
                <span className="role-description__icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg></span>
                <span><strong>{roleLabels.observer}</strong><small>Только просмотр</small></span>
              </div>
            </div>
          </section>
          <div className="members-note">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg>
            <span>Роль владельца нельзя изменить, а самого владельца — удалить из датасета.</span>
          </div>
        </aside>
      </div>
    </section>
  );
};