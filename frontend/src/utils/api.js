export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function apiUrl(path) {
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return `${API_BASE_URL}${path}`;
}
