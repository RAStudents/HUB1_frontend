import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    setIsSaving(true);

    try {
      const updatedUser = await updateProfile(displayName.trim());
      setDisplayName(updatedUser.display_name);
      setSaved(true);
    } catch (requestError: any) {
      setError(requestError.response?.data?.detail || 'Не удалось сохранить изменения. Попробуйте ещё раз.');
    } finally {
      setIsSaving(false);
    }
  };

  const initials = (user?.display_name || user?.email || 'U').slice(0, 1).toUpperCase();

  return (
    <section className="profile-page">
      <Link to="/" className="page-back">
        <span aria-hidden="true">←</span> К датасетам
      </Link>

      <header className="profile-heading">
        <div className="profile-heading__avatar" aria-hidden="true">{initials}</div>
        <div>
          <p className="profile-heading__eyebrow">Аккаунт HUB</p>
          <h1>Профиль</h1>
          <p className="profile-heading__email">{user?.email || 'Email не указан'}</p>
        </div>
      </header>

      <div className="profile-content">
        <div className="profile-content__intro">
          <h2>Личные данные</h2>
          <p>Имя отображается в рабочем пространстве и списках участников.</p>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label className="profile-field" htmlFor="profile-name">
            <span>Отображаемое имя</span>
            <input
              id="profile-name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={100}
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setSaved(false);
              }}
              required
            />
          </label>

          <label className="profile-field" htmlFor="profile-email">
            <span>Email</span>
            <input id="profile-email" type="email" value={user?.email || ''} readOnly />
          </label>

          {error && <p className="profile-message profile-message--error" role="alert">{error}</p>}
          {saved && <p className="profile-message profile-message--success" role="status">Изменения сохранены.</p>}

          <div className="profile-form__actions">
            <button type="submit" className="button button--primary" disabled={isSaving || !displayName.trim()}>
              {isSaving ? 'Сохраняем...' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
