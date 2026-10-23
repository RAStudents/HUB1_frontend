import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AuthLayout } from './AuthLayout';

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
    <AuthLayout title={error ? 'Вход не выполнен' : 'Входим через Яндекс'} description="">
      {error ? (
        <>
          <div className="auth-alert" role="alert">{error}</div>
          <Link to="/login" className="auth-callback-link">Вернуться ко входу</Link>
        </>
      ) : (
        <p className="auth-callback-copy">Проверяем авторизацию...</p>
      )}
    </AuthLayout>
  );
};