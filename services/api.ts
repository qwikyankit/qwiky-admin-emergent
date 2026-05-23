import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_STORAGE_KEY = 'qwiky_admin_token';

const ONESIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;

const ONESIGNAL_API_KEY = process.env.EXPO_PUBLIC_ONESIGNAL_API_KEY;

// Default token from environment
const DEFAULT_TOKEN = process.env.EXPO_PUBLIC_QWIKY_TOKEN;
// const DEFAULT_TOKEN =  'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJTVVBFUl9BRE1JTiIsIkNVU1RPTUVSIl0sIm1vYmlsZSI6Ijk2NjA3NjYyMjciLCJ0b2tlbl90eXBlIjoiYWNjZXNzIiwidXNlcklkIjoiM2Y3N2JmMmYtNWYxYi00N2Y2LWFjYzgtNGJjNjIwMDhjYjc1Iiwic3ViIjoiM2Y3N2JmMmYtNWYxYi00N2Y2LWFjYzgtNGJjNjIwMDhjYjc1IiwiaWF0IjoxNzc4ODQxMjM4LCJleHAiOjE3NzkwMjEyMzh9.22blACPXQ7-MDDqfTC1XbXLCqjnDpAGCL-tw6JrfBIk';


// IMPORTANT: Must stay '/api' for Vercel rewrite to work
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://api.qwiky.in/qwiky-service/api/v1';



// Hardcoded Hood ID (as requested)
const HOOD_ID =
  process.env.EXPO_PUBLIC_DEFAULT_HOOD_ID ||
  '4dd4d3a6-c0b3-4042-8e01-5b9299273ee1';

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

// Fetch all hoods
export const fetchHoods = async () => {
  const response = await apiClient.get('/hoods');
  return response.data;
};

// Fetch bookings with pagination
export const fetchBookings = async (
  hoodId: string = HOOD_ID,
  page: number = 0,
  size: number = 50
): Promise<PaginatedResponse> => {
  const response = await apiClient.get(
    `/admin/booking/hood/${hoodId}`,
    {
      params: { page, size },
    }
  );
  return response.data;
};

// Fetch user details
export const fetchUserDetails = async (userId: string) => {
  const response = await apiClient.get(`/admin/user/${userId}`);
  return response.data;
};

export const cancelBooking = async (bookingId: string) => {
  const response = await apiClient.post(
    `/admin/booking/${bookingId}/cancel`,
    {}   // 🔥 mandatory empty body
  );
  return response.data;
};

export const settleBooking = async (bookingId: string) => {
  const response = await apiClient.post(
    `/admin/booking/${bookingId}/settled`,
    {}   // 🔥 mandatory empty body
  );
  return response.data;
};

// Fetch hood details including operating hours
export const fetchHoodDetails = async (
  hoodId: string = HOOD_ID
) => {
  const response = await apiClient.get(`/hoods/${hoodId}`);
  return response.data;
};

// Update hood operating hours (single day or full week)
export const updateHoodOperatingHours = async (
  payload: any,
  hoodId: string = HOOD_ID
) => {
  const body = Array.isArray(payload) ? payload : [payload];

  const response = await apiClient.put(
    `/hoods/${hoodId}/operating-hours`,
    body
  );

  return response.data;
};

// 1️⃣ Validate User
export const validateUserByMobile = async (mobile) => {
  try {
    const res = await apiClient.get(
      `/admin/user/mobileNumber/${mobile}`
    );
    return res.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

// 2️⃣ Fetch Hood Items
export const fetchHoodItems = async (hoodId) => {
  const res = await apiClient.get(
    `/hood-items/hood/${hoodId}`
  );
  return res.data;
};

// 3️⃣ Fetch Slots
export const fetchSlots = async (hoodItemId, date) => {
  const res = await apiClient.get(
    `/slots/hoodItemId/${hoodItemId}/date/${date}`
  );
  return res.data;
};

// 4️⃣ Create Assisted Booking
export const createAssistedBooking = async (body) => {
  const res = await apiClient.post(
    `/admin/bookings/create`,
    body
  );
  return res.data;
};


// Helper to extract friendly error message
export const getErrorMessage = (error: any): string => {
  return (
    error?.friendlyMessage ||
    error?.message ||
    'An error occurred'
  );
};

// ✅ Fetch Experts (Hood Experts)
export const fetchHoodExperts = async (hoodId) => {
  const res = await apiClient.get(`/hood-users/hood/${hoodId}`);
  return res.data;
};

// ✅ Assign Expert
export const assignExpert = async (bookingId, expertUserId) => {
  const res = await apiClient.post(
    `/admin/bookings/${bookingId}/assign/${expertUserId}`,
    {}
  );
  return res.data;
};

// ✅ Send Push Notification
export const sendPushNotification = async ({
  title,
  message,
}: {
  title: string;
  message: string;
}) => {
  
  const response = await axios.post(
    'https://api.onesignal.com/notifications?c=push',
    {
      app_id: ONESIGNAL_APP_ID,
      headings: {
        en: title,
      },

      contents: {
        en: message,
      },

      included_segments: ['All'],
      target_channel: 'push',
    },
    {
      headers: {
        Authorization: `Key ${ONESIGNAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
};

export default apiClient;
