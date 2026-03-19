import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000,
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
    // Server error format: { success: false, error: { code, message } }
    const serverError = error.response?.data?.error;
    const message =
      error.response?.data?.message ||
      (typeof serverError === 'string' ? serverError : serverError?.message) ||
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

// Typed API helpers that account for the response interceptor unwrapping { success, data } → data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiArgs = [url: string, data?: any, config?: any];

export const api = {
  get: <T>(...args: ApiArgs) => apiClient.get(args[0], args[2]) as unknown as Promise<T>,
  post: <T>(...args: ApiArgs) => apiClient.post(args[0], args[1], args[2]) as unknown as Promise<T>,
  put: <T>(...args: ApiArgs) => apiClient.put(args[0], args[1], args[2]) as unknown as Promise<T>,
  delete: <T>(...args: ApiArgs) => apiClient.delete(args[0], args[2]) as unknown as Promise<T>,
};

export default apiClient;
