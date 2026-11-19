import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import './consent-banner.css';

type ConsentAction = 'accepted' | 'rejected' | 'withdrawn';

interface ConsentStatus {
  action: ConsentAction | null;
}

export const ConsentBanner = () => {
  const [hasAccepted, setHasAccepted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    void apiClient.get<ConsentStatus>('/consent')
      .then(({ data }) => {
        if (active) setHasAccepted(data.action === 'accepted');
      })
      .catch((error: unknown) => {
        console.error('Не удалось проверить статус согласия:', error);
        if (active) setHasAccepted(false);
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    const handleConsentChanged = (event: Event) => {
      const action = (event as CustomEvent<ConsentAction>).detail;
      setHasAccepted(action === 'accepted');
    };
    window.addEventListener('consent:changed', handleConsentChanged);

    return () => {
      active = false;
      window.removeEventListener('consent:changed', handleConsentChanged);
    };
  }, []);

  if (!isReady || hasAccepted) return null;

  return (
    <aside className="consent-banner" aria-label="Использование файлов cookie" role="status">
      Используя данный сайт, вы даёте{' '}
      <Link to="/consent">согласие</Link> на использование файлов cookie.
    </aside>
  );
};
