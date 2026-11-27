import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getApiErrorMessage } from '../api/errorMessage';
import { loadConsentStatus, saveConsentAction, type ConsentAction, type ConsentStatus } from './consentApi';
import { renderLegalText } from './renderLegalText';
import './consent-banner.css';

type ConsentDecision = Exclude<ConsentAction, 'withdrawn'>;

export const ConsentBanner = () => {
  const location = useLocation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [consent, setConsent] = useState<ConsentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const isLegalPage = location.pathname === '/consent' || location.pathname === '/privacy-policy';
  const needsDecision = consent === null
    || consent.action === null
    || consent.action === 'withdrawn';
  const isDialogOpen = !isLegalPage && needsDecision && (!isLoading || retryCount > 0);

  useEffect(() => {
    let active = true;
    void loadConsentStatus()
      .then((data) => {
        if (active) setConsent(data);
      })
      .catch((error: unknown) => {
        console.error('Не удалось проверить статус согласия:', error);
        if (active) setLoadError(getApiErrorMessage(error, 'Не удалось загрузить согласие.'));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [retryCount]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isDialogOpen && !dialog.open) dialog.showModal();
    if (!isDialogOpen && dialog.open) dialog.close();
  }, [isDialogOpen]);

  useEffect(() => {
    const handleConsentChanged = (event: Event) => {
      setConsent((event as CustomEvent<ConsentStatus>).detail);
    };
    window.addEventListener('consent:changed', handleConsentChanged);
    return () => window.removeEventListener('consent:changed', handleConsentChanged);
  }, []);

  const submitDecision = async (action: ConsentDecision) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await saveConsentAction(action);
    } catch (error: unknown) {
      console.error('Не удалось сохранить решение по согласию:', error);
      setSubmitError(getApiErrorMessage(error, 'Не удалось сохранить выбор. Попробуйте ещё раз.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="consent-dialog"
      aria-labelledby="consent-dialog-title"
      aria-describedby="consent-dialog-description"
      aria-busy={isLoading || isSubmitting}
      onCancel={(event) => event.preventDefault()}
    >
      <header className="consent-dialog__header">
        <h2 id="consent-dialog-title">Согласие на обработку данных</h2>
        <p id="consent-dialog-description">
          Ознакомьтесь с текстом и выберите, принимаете ли вы согласие на обработку
          электронных пользовательских данных, включая cookie-файлы.
        </p>
        {consent && <span>Версия {consent.version}</span>}
      </header>

      <div className="consent-dialog__content">
        {consent
          ? <div className="legal-page__content">{renderLegalText(consent.consent_text)}</div>
          : loadError
            ? (
              <div className="consent-dialog__error" role="alert">
                <p>{loadError}</p>
                <button
                  className="button button--quiet"
                  disabled={isLoading}
                  onClick={() => {
                    setLoadError(null);
                    setIsLoading(true);
                    setRetryCount((count) => count + 1);
                  }}
                  type="button"
                >
                  Повторить загрузку
                </button>
              </div>
            )
            : <p role="status">Загружаем текст согласия...</p>}
      </div>

      <footer className="consent-dialog__footer">
        {consent && (
          <div className="consent-dialog__links">
            <Link to="/consent">Открыть страницу согласия</Link>
            <Link to={consent.policy_url}>{consent.policy_link_text}</Link>
          </div>
        )}
        {submitError && <p className="consent-dialog__error" role="alert">{submitError}</p>}
        <div className="consent-dialog__actions">
          <button
            className="button button--quiet"
            disabled={!consent || isLoading || isSubmitting}
            onClick={() => void submitDecision('rejected')}
            type="button"
          >
            Не принимаю
          </button>
          <button
            className="button button--primary"
            disabled={!consent || isLoading || isSubmitting}
            onClick={() => void submitDecision('accepted')}
            type="button"
          >
            {isSubmitting ? 'Сохраняем...' : 'Даю согласие'}
          </button>
        </div>
      </footer>
    </dialog>
  );
};
