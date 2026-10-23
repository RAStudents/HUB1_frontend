// apps/web/src/auth/LoginPage.tsx
import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { YandexLoginResponse } from '../api/types';
import { useAuth } from './AuthContext';
import { AuthField } from './AuthField';
import { AuthLayout } from './AuthLayout';

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isYandexLoading, setIsYandexLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Ошибка входа');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleYandexLogin = async () => {
        setError('');
        setIsYandexLoading(true);
        try {
            const response = await apiClient.get<YandexLoginResponse>('/auth/yandex/login');
            const authorizationUrl = new URL(response.data.auth_url);
            const state = Array.from(
                crypto.getRandomValues(new Uint8Array(32)),
                (byte) => byte.toString(16).padStart(2, '0'),
            ).join('');

            sessionStorage.setItem('yandex_oauth_state', state);
            authorizationUrl.searchParams.set(
                'redirect_uri',
                `${window.location.origin}/auth/yandex/callback`,
            );
            authorizationUrl.searchParams.set('state', state);
            window.location.assign(authorizationUrl.toString());
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Не удалось начать вход через Яндекс');
            setIsYandexLoading(false);
        }
    };

    return (
        <AuthLayout title="Вход в HUB" description="Войдите, чтобы продолжить работу с датасетами">
            {error && <div className="auth-alert" role="alert">{error}</div>}
            <form onSubmit={handleSubmit} className="auth-form">
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
                    placeholder="Введите пароль"
                    autoComplete="current-password"
                    onChange={setPassword}
                />
                <button type="submit" className="auth-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Входим...' : 'Войти'}
                </button>
            </form>
            <div className="auth-divider">или</div>
            <button
                type="button"
                onClick={handleYandexLogin}
                disabled={isYandexLoading}
                className="auth-secondary"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14 4h5v16h-5M10 8l4 4-4 4M14 12H4" />
                </svg>
                {isYandexLoading ? 'Переход к Яндексу...' : 'Войти через Яндекс ID'}
            </button>
            <p className="auth-switch">
                Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
            </p>
        </AuthLayout>
    );
};