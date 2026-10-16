// apps/web/src/auth/LoginPage.tsx
import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { YandexLoginResponse } from '../api/types';
import { useAuth } from '../router';

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isYandexLoading, setIsYandexLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Ошибка входа');
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
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-3xl font-bold text-center mb-6 text-blue-600">Вход в HUB</h1>
                {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 border rounded-md" />
                    <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-3 py-2 border rounded-md" />
                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">Войти</button>
                </form>
                <div className="mt-4">
                    <button
                        type="button"
                        onClick={handleYandexLogin}
                        disabled={isYandexLoading}
                        className="w-full bg-yellow-400 text-black py-2 rounded-md hover:bg-yellow-500 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isYandexLoading ? 'Переход к Яндексу...' : 'Войти через Яндекс ID'}
                    </button>
                </div>
                <p className="text-center text-sm text-gray-600 mt-6">
                    Нет аккаунта? <Link to="/register" className="text-blue-600 hover:underline">Зарегистрироваться</Link>
                </p>
            </div>
        </div>
    );
};