import axios from 'axios';

const TOKEN_KEY = 'geistdesk_token';

/** Apply the persisted GeistDesk session token to axios default headers. */
export function applySessionAuthHeader() {
  let token: string | null = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch {
    /* ignore storage errors */
  }
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
}
