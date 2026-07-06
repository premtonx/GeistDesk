import axios from 'axios';

/** Configure axios to send httpOnly session cookies on same-origin API calls. */
export function applySessionAuthHeader() {
  axios.defaults.withCredentials = true;
  delete axios.defaults.headers.common['Authorization'];
}

applySessionAuthHeader();
