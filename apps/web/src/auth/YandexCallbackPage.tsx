import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../router';

export const YandexCallbackPage = () => {
  const { loginWithYandex } = useAuth();
  const { search } = useLocation();
  const navigate = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const expectedState = sessionStorage.getItem('yandex_oauth_state');
    const providerError = params.get('error_description') || params.get('error');

    sessionStorage.removeItem('yandex_oauth_state');
    window.history.replaceState(null, '', window.location.pathname);

    if (!expectedState) {
      setError('OAuth-сессия потеряна. Начните вход на том же адресе сайта: localhost и 127.0.0.1 считаются разными адресами.');
      return;
    }

    if (returnedState !== expectedState) {
      setError('OAuth state не совпал. Проверьте, что callback URL в настройках Яндекса точно совпадает с адресом сайта и портом.');
      return;
    }

    if (providerError) {
      setError(`Яндекс не завершил вход: ${providerError}`);
      return;
    }

    if (!code) {
      setError('Яндекс не вернул код авторизации. Попробуйте войти ещё раз.');
      return;
    }

    loginWithYandex(code)
      .then(() => navigate('/', { replace: true }))
      .catch((err: any) => {
        setError(err.response?.data?.detail || 'Не удалось войти через Яндекс');
      });
  }, [loginWithYandex, navigate, search]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <section className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
        {error ? (
          <>
            <h1 className="mb-3 text-xl font-semibold text-gray-900">Вход не выполнен</h1>
            <p className="mb-5 text-sm text-red-700">{error}</p>
            <Link to="/login" className="text-blue-600 hover:underline">
              Вернуться ко входу
            </Link>
          </>
        ) : (
          <>
            <h1 className="mb-3 text-xl font-semibold text-gray-900">Входим через Яндекс</h1>
            <p className="text-sm text-gray-600">Проверяем авторизацию...</p>
          </>
        )}
      </section>
    </main>
  );
};