import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Response interceptor: extract .data from successful API responses
// Server returns { success, data, meta? } — we unwrap to return just the payload
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    // If the server wraps in { success, data }, unwrap to return the inner data
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      return body.data;
    }
    return body;
  },
  (error) => {
    // Extract meaningful error message
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';

    const status = error.response?.status;

    return Promise.reject({
      message,
      status,
      original: error,
    });
  }
);

export default apiClient;
