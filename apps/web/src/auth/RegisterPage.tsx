// apps/web/src/auth/RegisterPage.tsx
import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { getErrorMessage } from './errorMessage';

export const RegisterPage = () => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await register(email, password, displayName);
      navigate('/');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Ошибка регистрации'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Регистрация" description="Создайте аккаунт, чтобы размечать датасеты вместе с командой">
      {error && <div className="auth-alert" role="alert">{error}</div>}
      <form onSubmit={handleSubmit} className="auth-form">
        <AuthField
          id="display-name"
          label="Отображаемое имя"
          type="text"
          value={displayName}
          placeholder="Как к вам обращаться"
          autoComplete="name"
          onChange={setDisplayName}
        />
        <AuthField
          id="email"
          label="Email"
          type="email"
          value={email}
          placeholder="you@example.com"
          autoComplete="email"
          onChange={setEmail}
        />
        <AuthField
          id="password"
          label="Пароль"
          type="password"
          value={password}
          placeholder="Придумайте пароль"
          autoComplete="new-password"
          onChange={setPassword}
        />
        <button type="submit" className="auth-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Создаём аккаунт...' : 'Создать аккаунт'}
        </button>
      </form>
      <p className="auth-switch">
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </AuthLayout>
  );
};