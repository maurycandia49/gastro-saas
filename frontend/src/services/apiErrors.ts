type ErrorPayload = Record<string, unknown>;

function formatPayload(payload: unknown): string | null {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as ErrorPayload;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.message === 'string') return data.message;
  const messages = Object.entries(data).flatMap(([field, value]) => {
    const values = Array.isArray(value) ? value : [value];
    return values.map((item) => `${field}: ${typeof item === 'string' ? item : JSON.stringify(item)}`);
  });
  return messages.length ? messages.join(' ') : null;
}

export function getApiErrorMessage(error: unknown, fallback = 'No se pudo completar la solicitud. Intenta nuevamente.'): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'response' in error) {
    const response = error as { response?: { data?: unknown } };
    return formatPayload(response.response?.data) ?? fallback;
  }
  return formatPayload(error) ?? fallback;
}
