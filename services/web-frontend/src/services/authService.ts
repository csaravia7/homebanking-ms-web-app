import api from '../api/client';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface VerifyResponse {
  valid: boolean;
  user: {
    id: string;
    email: string;
  };
}

export const authService = {
  register: async (data: RegisterRequest): Promise<any> => {
    const response = await api.post('/api/auth/register', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/api/auth/login', data);
    const { token } = response.data;
    localStorage.setItem('token', token);
    return response.data;
  },

  verify: async (): Promise<VerifyResponse> => {
    const response = await api.post('/api/auth/verify');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
  },

  getToken: (): string | null => {
    return localStorage.getItem('token');
  },
};
