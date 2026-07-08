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
  'https://api.qwiky.in/qwiky-service/api/v1';


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

      errorMessage =
        data?.detail ||
        data?.message ||
        `Error: ${error.response.status}`;
    }

    error.friendlyMessage = errorMessage;

    if (error.response?.status === 401) {
      console.log("Session expired");

      await removeToken();

      redirectToLogin();

      return Promise.reject(error);
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
    await removeToken();
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
