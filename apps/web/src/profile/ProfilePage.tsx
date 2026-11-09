import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { UserAvatar } from '../auth/UserAvatar';
import { AvatarCropDialog } from './AvatarCropDialog';

export const ProfilePage = () => {
  const { user, updateProfile, updateAvatar, removeAvatar } = useAuth();
  const avatarInput = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarMessage, setAvatarMessage] = useState('');
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [avatarToCrop, setAvatarToCrop] = useState<File | null>(null);

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

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarError('');
    setAvatarMessage('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Выберите изображение JPEG, PNG или WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Размер изображения не должен превышать 5 МБ.');
      return;
    }

    setAvatarToCrop(file);
  };

  const handleAvatarCropSave = async (file: File) => {
    setIsAvatarSaving(true);
    try {
      await updateAvatar(file);
      setAvatarMessage('Аватар обновлён.');
      setAvatarToCrop(null);
    } finally {
      setIsAvatarSaving(false);
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarError('');
    setAvatarMessage('');
    setIsAvatarSaving(true);
    try {
      await removeAvatar();
      setAvatarMessage('Аватар удалён.');
    } catch (requestError: unknown) {
      setAvatarError(
        (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail
          || 'Не удалось удалить аватар. Попробуйте ещё раз.',
      );
    } finally {
      setIsAvatarSaving(false);
    }
  };

  return (
    <section className="profile-page">
      <Link to="/" className="page-back">
        <span aria-hidden="true">←</span> К датасетам
      </Link>

      <header className="profile-heading">
        <UserAvatar
          className="profile-heading__avatar"
          email={user?.email}
          name={user?.display_name}
          src={user?.avatar_url}
        />
        <div>
          <p className="profile-heading__eyebrow">Аккаунт HUB</p>
          <h1>Профиль</h1>
          <p className="profile-heading__email">{user?.email || 'Email не указан'}</p>
        </div>
      </header>

      <div className="profile-content">
        <div className="profile-content__intro">
          <h2>Аватар профиля</h2>
          <p>Изображение будет видно в шапке сайта на всех устройствах.</p>
        </div>

        <div className="profile-avatar-form">
          <input
            ref={avatarInput}
            accept="image/jpeg,image/png,image/webp"
            className="profile-avatar-form__input"
            onChange={handleAvatarChange}
            type="file"
          />
          <div className="profile-avatar-form__actions">
            <button
              className="button button--primary"
              disabled={isAvatarSaving}
              onClick={() => avatarInput.current?.click()}
              type="button"
            >
              {isAvatarSaving ? 'Загружаем...' : user?.avatar_url ? 'Изменить аватар' : 'Выбрать аватар'}
            </button>
            {user?.avatar_url && (
              <button
                className="button button--quiet"
                disabled={isAvatarSaving}
                onClick={handleAvatarRemove}
                type="button"
              >
                Удалить
              </button>
            )}
          </div>
          <p className="profile-avatar-form__hint">JPEG, PNG или WebP. Максимальный размер — 5 МБ.</p>
          {avatarError && <p className="profile-message profile-message--error" role="alert">{avatarError}</p>}
          {avatarMessage && <p className="profile-message profile-message--success" role="status">{avatarMessage}</p>}
        </div>
      </div>

      {avatarToCrop && (
        <AvatarCropDialog
          file={avatarToCrop}
          isSaving={isAvatarSaving}
          onCancel={() => {
            if (!isAvatarSaving) setAvatarToCrop(null);
          }}
          onSave={handleAvatarCropSave}
        />
      )}

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
