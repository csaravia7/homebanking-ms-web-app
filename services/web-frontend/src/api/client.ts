import axios, { AxiosInstance } from 'axios';

// En producción (K8s): baseURL vacío → rutas relativas → nginx hace proxy_pass a api-gateway
// En desarrollo local: Vite proxy redirige /api → http://localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    // Interceptor para agregar token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Interceptor para manejar errores
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  public getClient() {
    return this.client;
  }
}

export default new ApiClient().getClient();
