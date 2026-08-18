import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import { redirectToLogin } from "../utils/navigation";


const ONESIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID;

const ONESIGNAL_API_KEY = process.env.EXPO_PUBLIC_ONESIGNAL_API_KEY;

// Default token from environment

// IMPORTANT: Must stay '/api' for Vercel rewrite to work
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://devapi.qwiky.in/qwiky-service/api/v1';


// Hardcoded Hood ID (as requested)
const HOOD_ID =
  process.env.EXPO_PUBLIC_DEFAULT_HOOD_ID ||
  '4dd4d3a6-c0b3-4042-8e01-5b9299273ee1';

export const getFriendlyError = error => {
  const code = error?.friendlyMessage || "";

  switch (code) {
    case "otp_not_verified":
      return "Incorrect OTP. Please try again.";

    case "otp_expired":
      return "OTP has expired. Please request a new OTP.";

    case "otp_not_found":
      return "Please request an OTP first.";

    case "user_not_found":
      return "You are not authorized to access Qwiky Admin.";

    case "invalid_mobile_number":
      return "Please enter a valid mobile number.";

    default:
      return code || "Something went wrong. Please try again.";
  }
};


// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string> | null = null;

const isAuthenticationEndpoint = (url = '') =>
  ['/auth/otp/', '/auth/token/refresh', '/auth/logout'].some(path =>
    url.includes(path),
  );

const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    throw new Error('Refresh token is unavailable');
  }

  const response = await axios.post(
    `${API_BASE_URL}/auth/token/refresh`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Refresh-Token': refreshToken,
      },
    },
  );
  const refreshedAuth =
    response.data?.authResponse || response.data?.auth || response.data;
  const accessToken = refreshedAuth?.accessToken;

  if (!accessToken) {
    throw new Error('Refresh response did not include an access token');
  }

  await saveToken(accessToken);
  if (refreshedAuth?.refreshToken) {
    await saveRefreshToken(refreshedAuth.refreshToken);
  }

  return accessToken;
};

// Request interceptor to attach token
apiClient.interceptors.request.use(
  async config => {
    const token = await getToken();
    config.headers.Accept =
      'application/json';

    config.headers['Content-Type'] =
      'application/json';

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  },
);

// Response interceptor for error handling

apiClient.interceptors.response.use(
  response => response,

  async error => {
    let errorMessage = "Something went wrong";

    if (error.response) {
      const data = error.response.data;

      error.apiCode = data?.code;
      error.apiStatus = error.response.status;

      errorMessage =
        data?.detail ||
        data?.message ||
        data?.error?.message ||
        data?.error ||
        data?.title ||
        (Array.isArray(data?.errors)
          ? data.errors.map(item => item?.message || item).join(', ')
          : null) ||
        `Error: ${error.response.status}`;
    }

    error.friendlyMessage = errorMessage;

    if (error.response?.status === 401) {
      const originalRequest = error.config as any;
      const requestUrl = originalRequest?.url || '';

      if (
        originalRequest &&
        !originalRequest._retry &&
        !isAuthenticationEndpoint(requestUrl)
      ) {
        const currentAccessToken = await getToken();
        const failedAuthorization = String(
          originalRequest.headers?.Authorization ||
            originalRequest.headers?.authorization ||
            '',
        );
        const failedAccessToken = failedAuthorization.replace(/^Bearer\s+/i, '');

        if (
          currentAccessToken &&
          failedAccessToken &&
          currentAccessToken !== failedAccessToken
        ) {
          originalRequest._retry = true;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${currentAccessToken}`;
          return apiClient(originalRequest);
        }
      }

      if (
        originalRequest &&
        !originalRequest._retry &&
        !isAuthenticationEndpoint(requestUrl)
      ) {
        originalRequest._retry = true;

        try {
          if (!refreshPromise) {
            refreshPromise = refreshAccessToken().finally(() => {
              refreshPromise = null;
            });
          }

          const accessToken = await refreshPromise;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          await removeToken();
          redirectToLogin();
          return Promise.reject(refreshError);
        }
      }

      if (!isAuthenticationEndpoint(requestUrl)) {
        await removeToken();
        redirectToLogin();
      }
    }

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

export type BookingStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'PAYMENT_PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'SETTLED'
  | 'CANCELLED'
  | 'FAILED';

export interface BookingLifecycleResponse {
  bookingId: string;
  bookingCode: string;
  status: BookingStatus;
  grandTotal: number;
  paymentRequired: boolean;
}

// Fetch all hoods
export const fetchHoods = async (options: { includeInactive?: boolean } = {}) => {
  const response = await apiClient.get('/hoods', {
    params: options.includeInactive ? { includeInactive: true } : undefined,
  });
  return response.data;
};

export const createHood = async payload => {
  const response = await apiClient.post('/hoods', payload);
  return response.data;
};

export const updateHood = async (hoodId, payload) => {
  const response = await apiClient.put(`/hoods/${hoodId}`, payload);
  return response.data;
};

export const createAdminUser = async payload => {
  const response = await apiClient.post('/admin', payload);
  return response.data;
};

export const fetchCategories = async () => {
  const response = await apiClient.get('/categories');
  return response.data;
};

export const fetchSubcategories = async () => {
  const response = await apiClient.get('/subcategories');
  return response.data;
};

export const createCategory = async payload => {
  const response = await apiClient.post('/categories', payload);
  return response.data;
};

export const updateCategory = async (categoryId, payload) => {
  const response = await apiClient.put(`/categories/${categoryId}`, payload);
  return response.data;
};

export const createSubcategory = async payload => {
  const response = await apiClient.post('/subcategories/', payload);
  return response.data;
};

export const fetchProducts = async () => {
  const response = await apiClient.get('/products');
  return response.data;
};

export const createProduct = async payload => {
  const response = await apiClient.post('/products', payload);
  return response.data;
};

export const updateProduct = async (productId, payload) => {
  const response = await apiClient.put(`/products/${productId}`, payload);
  return response.data;
};

export const deleteProduct = async productId => {
  const response = await apiClient.delete(`/products/${productId}`);
  return response.data;
};

export const fetchItems = async () => {
  const response = await apiClient.get('/items');
  return response.data;
};

export const createItem = async payload => {
  const response = await apiClient.post('/items', payload);
  return response.data;
};

export const updateItem = async (itemId, payload) => {
  const response = await apiClient.put(`/items/${itemId}`, payload);
  return response.data;
};

export const deleteItem = async itemId => {
  const response = await apiClient.delete(`/items/${itemId}`);
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

export const cancelBooking = async (
  bookingId: string,
): Promise<BookingLifecycleResponse> => {
  const response = await apiClient.post(`/admin/booking/${bookingId}/cancel`);
  return response.data;
};

export const settleBooking = async (
  bookingId: string,
): Promise<BookingLifecycleResponse> => {
  const response = await apiClient.post(`/admin/booking/${bookingId}/settled`);
  return response.data;
};

// Fetch hood details including operating hours
export const fetchHoodDetails = async (
  hoodId
) => {
  const response = await apiClient.get(`/hoods/${hoodId}`);
  return response.data;
};

// Update hood operating hours (single day or full week)
export const updateHoodOperatingHours = async (
  payload,
  hoodId
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

export const createHoodItem = async payload => {
  const response = await apiClient.post('/hood-items', payload);
  return response.data;
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

export const updateHoodItem =
  async (
    hoodItemId,
    payload,
  ) => {
    return apiClient.put(
      `/hood-items/${hoodItemId}`,
      payload,
    );
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

export const deleteHoodUser = async (
  hoodId,
  userId,
) => {
  const res = await apiClient.delete(
    `/hood-users/${hoodId}/user/${userId}`
  );

  return res.data;
};


export const createHoodUser = async (
  payload,
) => {
  const res = await apiClient.post(
    '/hood-users',
    payload,
  );

  return res.data;
};

// Create and update use the same complete hood-user contract. Sending the
// complete payload is important because expertise and shifts belong to the
// hood assignment, not the global user.
export const updateHoodUser = async (
  payload,
) => {
  const { hoodId, userId } = payload;
  const res = await apiClient.put(
    `/hood-users/${hoodId}/user/${userId}`,
    payload,
  );

  return res.data;
};


export const updateHoodUserStatus = async (
  hoodId,
  userId,
  status,
) => {
  const res = await apiClient.put(
    `/hood-users/${hoodId}/user/${userId}`,
    {
      status,
    },
    {
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    },
  );

  return res.data;
};


/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

export const requestOtp = async (
  mobileNumber,
  countryCode = '91',
) => {
  const response = await apiClient.post(
    '/auth/otp/request',
    {
      mobileNumber,
      countryCode,
    },
  );

  return response.data;
};

export const verifyOtp = async (
  mobileNumber,
  otp,
  countryCode = "91",
) => {
  const response = await apiClient.post(
    "/auth/otp/verify",
    {
      mobileNumber,
      countryCode,
      otp,
    },
  );

  const data = response.data;

  const auth = data?.authResponse;

  if (!auth?.accessToken) {
    throw new Error("Token not received");
  }

  await saveToken(auth.accessToken);

  await saveRefreshToken(
    auth.refreshToken,
  );

  if (data.user) {
    await saveUser(data.user);
  }

  return data;
};

export const logout = async () => {
  const refreshToken = await getRefreshToken();

  try {
    await apiClient.post(
      '/auth/logout',
      {},
      refreshToken
        ? { headers: { 'X-Refresh-Token': refreshToken } }
        : undefined,
    );
  } catch (error) {
    console.warn('Server logout failed; completing local logout.', error);
  } finally {
    await removeToken();
  }
};

export const logoutAllDevices = async () => {
  const refreshToken = await getRefreshToken();
  const response = await apiClient.post(
    '/auth/logout-all',
    {},
    refreshToken
      ? { headers: { 'X-Refresh-Token': refreshToken } }
      : undefined,
  );

  await removeToken();
  return response.data;
};

export const saveToken = async token => {
  await AsyncStorage.setItem(
    STORAGE_KEYS.TOKEN,
    token,
  );
};

export const getToken = async () => {
  return AsyncStorage.getItem(
    STORAGE_KEYS.TOKEN,
  );
};

export const getRefreshToken = async () => {
  return AsyncStorage.getItem(
    STORAGE_KEYS.REFRESH_TOKEN,
  );
};

export const removeToken = async () => {
    await AsyncStorage.multiRemove([
    STORAGE_KEYS.TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER,
  ]);
};

export const saveUser = async user => {
  await AsyncStorage.setItem(
    STORAGE_KEYS.USER,
    JSON.stringify(user),
  );
};

export const getUser = async () => {
  const user =
    await AsyncStorage.getItem(
      STORAGE_KEYS.USER,
    );

  return user
    ? JSON.parse(user)
    : null;
};

export const isLoggedIn = async () => {
  const token = await getToken();

  return !!token;
};

export const saveRefreshToken = async token => {
  await AsyncStorage.setItem(
    STORAGE_KEYS.REFRESH_TOKEN,
    token,
  );
};


export default apiClient;
