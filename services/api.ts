import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const TOKEN_STORAGE_KEY = 'qwiky_admin_token';

// Get token from environment or use empty as fallback (user must set in settings)
const DEFAULT_TOKEN = process.env.EXPO_PUBLIC_QWIKY_TOKEN || '';

// Use the backend proxy URL from environment
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_BASE_URL = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

let currentToken = DEFAULT_TOKEN;

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth header
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
      if (storedToken) {
        currentToken = storedToken;
      }
    } catch (e) {
      // Use current token if storage fails
    }
    config.headers.Authorization = `Bearer ${currentToken}`;
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
      // Server responded with error
      const data = error.response.data as any;
      errorMessage = data?.detail || data?.message || `Error: ${error.response.status}`;
      console.error('API Error:', error.response.status, errorMessage);
    } else if (error.request) {
      // Network error
      errorMessage = 'Network error. Please check your connection.';
      console.error('Network Error:', error.message);
    } else {
      errorMessage = error.message || 'Request failed';
      console.error('Request Error:', error.message);
    }
    
    // Attach friendly message to error
    (error as any).friendlyMessage = errorMessage;
    return Promise.reject(error);
  }
);

// Token management functions
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

// Pagination response type
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

// API Functions using backend proxy

// Fetch bookings with pagination
export const fetchBookings = async (page: number = 0, size: number = 20): Promise<PaginatedResponse> => {
  const response = await apiClient.get('/qwiky/bookings', {
    params: { page, size }
  });
  return response.data;
};

// Fetch bookings count for polling
export const fetchBookingsCount = async (): Promise<{ totalCount: number }> => {
  const response = await apiClient.get('/qwiky/bookings/count');
  return response.data;
};

// Fetch user details
export const fetchUserDetails = async (userId: string) => {
  const response = await apiClient.get(`/qwiky/user/${userId}`);
  return response.data;
};

// Cancel booking
export const cancelBooking = async (bookingId: string) => {
  const response = await apiClient.post(`/qwiky/booking/${bookingId}/cancel`);
  return response.data;
};

// Settle booking
export const settleBooking = async (bookingId: string) => {
  const response = await apiClient.post(`/qwiky/booking/${bookingId}/settled`);
  return response.data;
};

// Helper to get friendly error message
export const getErrorMessage = (error: any): string => {
  return error?.friendlyMessage || error?.message || 'An error occurred';
};

export default apiClient;
