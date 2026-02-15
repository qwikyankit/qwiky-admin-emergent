import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEY = 'qwiky_admin_token';

// Default token from environment
const DEFAULT_TOKEN = process.env.EXPO_PUBLIC_QWIKY_TOKEN || '';

// IMPORTANT: Must stay '/api' for Vercel rewrite to work
const API_BASE_URL = '/api';

// Hardcoded Hood ID (as requested)
const HOOD_ID = '4dd4d3a6-c0b3-4042-8e01-5b9299273ee1';

let currentToken = DEFAULT_TOKEN;

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        currentToken = storedToken;
      }
    } catch {
      // Ignore storage failures
    }

    if (currentToken) {
      config.headers.Authorization = `Bearer ${currentToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    let errorMessage = 'An unexpected error occurred';

    if (error.response) {
      const data = error.response.data as any;
      errorMessage =
        data?.detail ||
        data?.message ||
        `Error: ${error.response.status}`;
      console.error('API Error:', error.response.status, errorMessage);
    } else if (error.request) {
      errorMessage = 'Network error. Please check your connection.';
      console.error('Network Error:', error.message);
    } else {
      errorMessage = error.message || 'Request failed';
      console.error('Request Error:', error.message);
    }

    (error as any).friendlyMessage = errorMessage;
    return Promise.reject(error);
  }
);

// --------------------
// TYPES
// --------------------

export interface PaginatedResponse {
  _embedded: {
    bookingDetailsResponses: any[];
  };
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

// --------------------
// TOKEN MANAGEMENT
// --------------------

export const getToken = async (): Promise<string> => {
  try {
    const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    return storedToken || DEFAULT_TOKEN;
  } catch {
    return DEFAULT_TOKEN;
  }
};

export const setToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
    currentToken = token;
  } catch (e) {
    console.error('Failed to save token:', e);
    throw e;
  }
};

export const resetToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    currentToken = DEFAULT_TOKEN;
  } catch (e) {
    console.error('Failed to reset token:', e);
  }
};

// --------------------
// API FUNCTIONS
// --------------------

// Fetch bookings with pagination
export const fetchBookings = async (
  page: number = 0,
  size: number = 20
): Promise<PaginatedResponse> => {
  const response = await apiClient.get(
    `/admin/booking/hood/${HOOD_ID}`,
    {
      params: { page, size },
    }
  );

  return response.data;
};

// Fetch user details
export const fetchUserDetails = async (userId: string) => {
  const response = await apiClient.get(`/user/${userId}`);
  return response.data;
};

// Cancel booking
export const cancelBooking = async (bookingId: string) => {
  const response = await apiClient.post(
    `/admin/booking/${bookingId}/cancel`
  );
  return response.data;
};

// Settle booking
export const settleBooking = async (bookingId: string) => {
  const response = await apiClient.post(
    `/admin/booking/${bookingId}/settled`
  );
  return response.data;
};

// Helper to extract friendly error message
export const getErrorMessage = (error: any): string => {
  return (
    error?.friendlyMessage ||
    error?.message ||
    'An error occurred'
  );
};

export default apiClient;
