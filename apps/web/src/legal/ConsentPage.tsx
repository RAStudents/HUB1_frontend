import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { getApiErrorMessage } from '../api/errorMessage';
import { renderLegalText } from './renderLegalText';
import './consent.css';

type ConsentAction = 'accepted' | 'rejected' | 'withdrawn';

interface ConsentStatus {
  version: string;
  consent_text: string;
  policy_link_text: string;
  policy_url: string;
  action: ConsentAction | null;
  recorded_at: string | null;
}

const CONSENT_TITLE = 'Согласие на обработку электронных пользовательских данных';

const statusLabels: Record<ConsentAction, string> = {
  accepted: 'Согласие принято',
  rejected: 'Вы отказались от согласия',
  withdrawn: 'Согласие отозвано',
};

export const ConsentPage = () => {
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void apiClient.get<ConsentStatus>('/consent')
      .then(({ data }) => {
        if (active) setConsent(data);
      })
      .catch((requestError: unknown) => {
        console.error('Не удалось загрузить согласие:', requestError);
        if (active) {
          setError(getApiErrorMessage(requestError, 'Не удалось загрузить текст согласия.'));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const submitAction = async (action: ConsentAction) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const { data } = await apiClient.post<ConsentStatus>('/consent', { action });
      setConsent(data);
      window.dispatchEvent(new CustomEvent<ConsentAction>('consent:changed', { detail: action }));
    } catch (requestError: unknown) {
      console.error('Не удалось сохранить действие по согласию:', requestError);
      setError(getApiErrorMessage(requestError, 'Не удалось сохранить действие. Попробуйте ещё раз.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const consentBody = consent?.consent_text.replace(
    new RegExp(`^${CONSENT_TITLE}\\r?\\n+`),
    '',
  );

  return (
    <section className="consent-page">
      <Link to="/login" className="page-back">
        <span aria-hidden="true">←</span> Ко входу
      </Link>

      <header className="page-heading page-heading--stacked">
        <h1>{CONSENT_TITLE}</h1>
        <p>Версия {consent?.version ?? '—'}</p>
      </header>

      <article className="panel-surface consent-page__document">
        {error && <p className="form-alert" role="alert">{error}</p>}
        {!consent
          ? error
            ? null
            : <p className="consent-page__loading" role="status">Загрузка согласия...</p>
          : (
            <>
              {consent.action && (
                <p
                  className={`consent-page__status consent-page__status--${consent.action}`}
                  role="status"
                >
                  {statusLabels[consent.action]}
                  {consent.recorded_at
                    ? ` — ${new Date(consent.recorded_at).toLocaleString('ru-RU')}`
                    : ''}
                </p>
              )}

              <div className="legal-page__content">
                {renderLegalText(consentBody ?? consent.consent_text)}
              </div>

              <p className="consent-page__policy">
                <Link to={consent.policy_url}>{consent.policy_link_text}</Link>
              </p>

              <div className="consent-page__actions">
                {consent.action === 'accepted' ? (
                  <button
                    className="button button--quiet"
                    disabled={isSubmitting}
                    onClick={() => void submitAction('withdrawn')}
                    type="button"
                  >
                    {isSubmitting ? 'Сохраняем...' : 'Отозвать согласие'}
                  </button>
                ) : (
                  <>
                    <button
                      className="button button--primary"
                      disabled={isSubmitting}
                      onClick={() => void submitAction('accepted')}
                      type="button"
                    >
                      {isSubmitting ? 'Сохраняем...' : 'Даю согласие'}
                    </button>
                    <button
                      className="button button--quiet"
                      disabled={isSubmitting || consent.action === 'rejected'}
                      onClick={() => void submitAction('rejected')}
                      type="button"
                    >
                      Не принимаю
                    </button>
                  </>
                )}
              </div>
            </>
          )}
      </article>
    </section>
  );
};
