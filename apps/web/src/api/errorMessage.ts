type ErrorRecord = Record<string, unknown>;

const asRecord = (value: unknown): ErrorRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as ErrorRecord
    : undefined;

const getDetailMessage = (detail: unknown): string | undefined => {
  if (typeof detail === 'string') return detail;

  const entries = Array.isArray(detail) ? detail : [detail];
  const messages = entries
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      const message = asRecord(entry)?.msg;
      return typeof message === 'string' ? message : undefined;
    })
    .filter((message): message is string => Boolean(message));

  return messages.length ? messages.join('; ') : undefined;
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const errorRecord = asRecord(error);
  const response = asRecord(errorRecord?.response);
  const data = asRecord(response?.data);
  const detail = getDetailMessage(data?.detail);

  if (detail) return detail;
  return typeof errorRecord?.message === 'string' ? errorRecord.message : fallback;
};
