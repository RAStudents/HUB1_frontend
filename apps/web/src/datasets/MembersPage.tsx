import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Role } from '../api/types';

const demoMembers = [
  {
    id: '1',
    user: { id: '1', email: 'test@test.test', display_name: 'test', },
    role: 'owner' as Role,
  },
  {
    id: '2',
    user: { id: '2', email: 'anna.smirnova@mail.ru', display_name: 'Анна Смирнова' },
    role: 'labeler' as Role,
  },
  {
    id: '3',
    user: { id: '3', email: 'ilya.kovalev@gmail.com', display_name: 'Илья Ковалёв' },
    role: 'observer' as Role,
  },
];

const roleLabels: Record<Role, string> = {
  owner: 'Владелец',
  labeler: 'Разметчик',
  observer: 'Наблюдатель',
};

export const MembersPage = () => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('labeler');
  const [members, setMembers] = useState(demoMembers);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const datasetName = useMemo(() => 'Cats and Dogs', []);

  const handleInvite = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Введите email');
      return;
    }

    setSuccess(`Приглашение отправлено на ${email}`);
    setEmail('');
  };

  const handleRoleChange = (memberId: string, nextRole: Role) => {
    setMembers((current) => current.map((member) => member.id === memberId ? { ...member, role: nextRole } : member));
  };

  const handleRemove = (memberId: string) => {
    setMembers((current) => current.filter((member) => member.id !== memberId));
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
          <strong>{datasetName}</strong>
          <span>·</span>
          <span>Управление доступом и приглашения</span>
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
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@example.com"
                  aria-label="Email участника"
                  className="form-input"
                />
              </div>

              <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="form-select" aria-label="Роль участника">
                <option value="labeler">Разметчик</option>
                <option value="observer">Наблюдатель</option>
              </select>

              <button type="submit" className="button button--primary">Пригласить</button>
            </form>
          </section>

          <section className="panel-surface members-table">
            <h2 className="members-table__heading">Текущие участники <span>{members.length}</span></h2>

            <div className="members-table__columns">
              <span>Пользователь</span>
              <span>Роль</span>
              <span />
            </div>

            {members.map((member) => {
              const initials = (member.user.display_name || member.user.email || 'U').slice(0, 1).toUpperCase();
              return (
                <div key={member.id} className="member-row">
                  <div className="member-info">
                    <span className={member.role === 'owner' ? 'member-avatar member-avatar--owner' : 'member-avatar'} aria-hidden="true">
                      {initials}
                    </span>
                    <span className="member-info__text">
                      <span className="member-info__name">{member.user.display_name || member.user.email}</span>
                      <span className="member-info__email">{member.user.email}</span>
                    </span>
                  </div>

                  <select
                    value={member.role}
                    onChange={(event) => handleRoleChange(member.id, event.target.value as Role)}
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
                  ) : (
                    <span />
                  )}
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
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                </span>
                <span>
                  <strong>{roleLabels.observer}</strong>
                  <small>Только просмотр</small>
                </span>
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