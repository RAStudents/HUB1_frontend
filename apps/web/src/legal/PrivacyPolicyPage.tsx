import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';
import { renderLegalText } from './renderLegalText';
import './privacy-policy.css';

interface PrivacyPolicy {
  title: string;
  subtitle: string;
  content: string;
}

export const PrivacyPolicyPage = () => {
  const [policy, setPolicy] = useState<PrivacyPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiClient.get<PrivacyPolicy>('/privacy-policy')
      .then(({ data }) => {
        if (active) setPolicy(data);
      })
      .catch((requestError: unknown) => {
        console.error('Не удалось загрузить Политику конфиденциальности:', requestError);
        if (active) {
          setError(getApiErrorMessage(requestError, 'Не удалось загрузить документ.'));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="legal-page">
      <div className="legal-page__container">
        <header className="legal-page__header">
          <Link to="/login" className="legal-page__brand" aria-label="HUB — перейти ко входу">
            <span className="legal-page__logo" aria-hidden="true">
              <img src="/orange.svg" alt="" />
            </span>
            <span>HUB</span>
          </Link>
          <Link to="/login" className="legal-page__back">Ко входу</Link>
        </header>

        <article className="legal-page__document">
          <h1>{policy?.title ?? 'Политика конфиденциальности'}</h1>
          {policy && <p className="legal-page__subtitle">{policy.subtitle}</p>}
          {error
            ? <p className="legal-page__error" role="alert">{error}</p>
            : policy
              ? <div className="legal-page__content">{renderLegalText(policy.content)}</div>
              : <p className="legal-page__loading" role="status">Загрузка документа...</p>}
        </article>
      </div>
    </main>
  );
};
