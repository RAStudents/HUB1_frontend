import { apiClient } from '../api/client';

export type ConsentAction = 'accepted' | 'rejected' | 'withdrawn';

export interface ConsentStatus {
  version: string;
  consent_text: string;
  policy_link_text: string;
  policy_url: string;
  action: ConsentAction | null;
  recorded_at: string | null;
}

let pendingStatus: Promise<ConsentStatus> | undefined;

export function loadConsentStatus() {
  pendingStatus ??= apiClient.get<ConsentStatus>('/consent', { withCredentials: true })
    .then(({ data }) => data)
    .finally(() => { pendingStatus = undefined; });
  return pendingStatus;
}

export async function saveConsentAction(action: ConsentAction) {
  const { data } = await apiClient.post<ConsentStatus>('/consent', { action }, { withCredentials: true });
  window.dispatchEvent(new CustomEvent<ConsentStatus>('consent:changed', { detail: data }));
  return data;
}
