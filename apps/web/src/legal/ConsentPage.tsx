import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../api/errorMessage';
import { loadConsentStatus, saveConsentAction, type ConsentAction, type ConsentStatus } from './consentApi';
import { renderLegalText } from './renderLegalText';
import './consent.css';

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
    void loadConsentStatus()
      .then((data) => {
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
      setConsent(await saveConsentAction(action));
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
