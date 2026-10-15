const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Cannot reach the backend at ${BASE_URL}. Start the backend and verify VITE_API_BASE_URL.`);
    }
    throw error;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error([body.message, ...(body.errors || [])].filter(Boolean).join(' ' ) || 'Request failed.');
  return body;
}
export const api = {
  accounts: () => request('/accounts'),
  entries: (params) => request(`/journal-entries?${new URLSearchParams(params)}`),
  entry: (id) => request(`/journal-entries/${id}`),
  createEntry: (payload) => request('/journal-entries', { method: 'POST', body: JSON.stringify(payload) })
};
