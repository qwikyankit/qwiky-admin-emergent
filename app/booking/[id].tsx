import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  BackHandler,
  Linking,
  Share,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import StatusBadge from '../../components/StatusBadge';
import ConfirmationModal from '../../components/ConfirmationModal';
import Toast from '../../components/Toast';
import { addCustomerFeedback, fetchUserDetails, fetchBookings, fetchBookingFeedback, cancelBooking, settleBooking, getErrorMessage, fetchFeedbackOptions, fetchHoodExperts, assignExpert, reassignExpert } from '../../services/api';
import { createCalendarEvent, formatIndiaDateTime, formatTime12Hour, getRemainingTime, getServiceEndTime } from '../../utils/helpers';
import THEME from '../../constants/theme';

const DAY_INDEX_BY_NAME = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const isClosedValue = value =>
  value === true || String(value).toLowerCase() === 'true';

const getAssignedExpert = (bookingValue: any) => {
  if (!bookingValue) return null;
  const assigned =
    bookingValue.assignedExpert ||
    bookingValue.assignedExpertResponse ||
    bookingValue.expert ||
    {};
  const id =
    assigned.expertId ||
    assigned.id ||
    assigned.userId ||
    assigned.expertUserId ||
    bookingValue.assignedExpertId ||
    bookingValue.expertId;
  const name =
    assigned.expertName ||
    assigned.name ||
    assigned.fullName ||
    assigned.userName ||
    assigned.user?.name ||
    bookingValue.assignedExpertName ||
    bookingValue.expertName;
  return id || name ? { id: id || '', name: name || 'Assigned expert' } : null;
};

const getIndiaSlotParts = value => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const getPart = type => parts.find(part => part.type === type)?.value;
  const dayOfWeek = DAY_INDEX_BY_NAME[getPart('weekday')];
  const hours = Number(getPart('hour'));
  const minutes = Number(getPart('minute'));
  if (!dayOfWeek || !Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return { dayOfWeek, minutes: hours * 60 + minutes };
};

const timeToMinutes = value => {
  if (!value) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const getExpertEligibility = (expert, booking) => {
  const service = booking?.services?.[0] || {};
  const categoryId = service.categoryId || booking?.categoryId;
  const subcategoryId =
    service.subcategoryId ||
    service.subCategoryId ||
    booking?.subcategoryId ||
    booking?.subCategoryId;
  const expertises =
    expert.expertises ||
    expert.expertiseList ||
    expert.hoodUserExpertises ||
    [];

  if ((categoryId || subcategoryId) && expertises.length > 0) {
    const expertiseMatch = expertises.some(expertise => {
      const expertCategoryId = expertise.categoryId || expertise.category?.id;
      const expertSubcategoryId =
        expertise.subcategoryId ||
        expertise.subCategoryId ||
        expertise.subcategory?.id;
      if (subcategoryId) {
        return (
          String(expertSubcategoryId || '') === String(subcategoryId) &&
          (!categoryId || String(expertCategoryId || '') === String(categoryId))
        );
      }
      return String(expertCategoryId || '') === String(categoryId);
    });
    if (!expertiseMatch) return { eligible: false, reason: 'EXPERTISE' };
  }

  const assignmentStart =
    service.expertSlotStart ||
    service.slotStart ||
    booking?.expertSlotStart ||
    booking?.slotStart;
  const assignmentEnd =
    service.expertSlotEnd ||
    service.slotEnd ||
    booking?.expertSlotEnd ||
    booking?.slotEnd;
  const start = getIndiaSlotParts(assignmentStart);
  const end = getIndiaSlotParts(assignmentEnd);

  if (!start || !end || start.dayOfWeek !== end.dayOfWeek) {
    return { eligible: false, reason: 'SCHEDULE' };
  }

  const workingHours =
    expert.workingHours ||
    expert.hoodUserWorkingHours ||
    expert.expertWorkingHours ||
    [];
  const shift = workingHours.find(
    day => Number(day.dayOfWeek) === start.dayOfWeek,
  );
  if (!shift || isClosedValue(shift.isClosed)) {
    return { eligible: false, reason: 'LEAVE' };
  }

  const shiftStart = timeToMinutes(
    shift.workStartTime || shift.startTime || shift.openTime,
  );
  const shiftEnd = timeToMinutes(
    shift.workEndTime || shift.endTime || shift.closeTime,
  );
  if (
    shiftStart === null ||
    shiftEnd === null ||
    start.minutes < shiftStart ||
    end.minutes > shiftEnd
  ) {
    return { eligible: false, reason: 'SCHEDULE' };
  }

  return { eligible: true, reason: null };
};

export default function BookingDetail() {
  const router = useRouter();
  const { id, booking: bookingParam } = useLocalSearchParams();
  
  const [booking, setBooking] = useState<any>(null);
  const [feedbackBookings, setFeedbackBookings] = useState<any[]>([]);
  const [bookingFeedback, setBookingFeedback] = useState<any[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<any>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackOptionCodes, setFeedbackOptionCodes] = useState<string[]>([]);
  const [feedbackOptions, setFeedbackOptions] = useState<any[]>([]);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [loadingFeedbackOptions, setLoadingFeedbackOptions] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackFormError, setFeedbackFormError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    type: 'settle' | 'cancel' | null;
  }>({ visible: false, type: null });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as const });
  const [experts, setExperts] = useState<{ id: string; name: string }[]>([]);
const [selectedExpert, setSelectedExpert] = useState<{ id: string; name: string } | null>(null);
const [loadingExperts, setLoadingExperts] = useState(false);
const [assigning, setAssigning] = useState(false);
const [showExpertPicker, setShowExpertPicker] = useState(false);
const [pendingExpert, setPendingExpert] = useState<{ id: string; name: string } | null>(null);
const assignmentInFlight = useRef(false);
const [expertError, setExpertError] = useState('');
const [remainingTime, setRemainingTime] = useState('');

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    let active = true;

    const loadRouteBooking = async () => {
      if (!bookingParam) return;
      try {
        const rawBookingParam = Array.isArray(bookingParam) ? bookingParam[0] : bookingParam;
        const parsed = JSON.parse(rawBookingParam as string);
        const routeBookingId = Array.isArray(id) ? id[0] : id;
        let currentBooking = parsed;

        if (parsed.hoodId && routeBookingId) {
          try {
            const response = await fetchBookings(parsed.hoodId, 0, 100);
            const fetchedBookings = response?._embedded?.bookingDetailsResponses || [];
            currentBooking =
              fetchedBookings.find(item => item.bookingId === routeBookingId) || parsed;
          } catch (error) {
            console.error('Failed to refresh route booking:', error);
          }
        }

        const embeddedChildren =
          currentBooking?.bookings ||
          currentBooking?.childBookings ||
          currentBooking?.bookingDetailsResponses ||
          [];
        const orderKey =
          currentBooking?.bookingOrderId ||
          currentBooking?.orderId ||
          currentBooking?.bookingOrder?.id ||
          currentBooking?.orderReferenceId;
        let childBookings = embeddedChildren;
        if (!childBookings.length && orderKey && parsed.hoodId) {
          try {
            const response = await fetchBookings(parsed.hoodId, 0, 100);
            const fetchedBookings = response?._embedded?.bookingDetailsResponses || [];
            childBookings = fetchedBookings.filter(item => {
              const itemOrderKey =
                item?.bookingOrderId ||
                item?.orderId ||
                item?.bookingOrder?.id ||
                item?.orderReferenceId;
              return String(itemOrderKey || '') === String(orderKey);
            });
          } catch (error) {
            console.error('Failed to load sibling bookings for feedback:', error);
          }
        }
        if (!childBookings.length && currentBooking?.bookingId) childBookings = [currentBooking];

        if (!active) return;
        setBooking(currentBooking);
        setFeedbackBookings(
          childBookings.filter(item => item?.bookingId),
        );
        if (currentBooking.userId) {
          loadUserDetails(currentBooking.userId);
        } else {
          setLoadingUser(false);
        }
      } catch (e) {
        console.error('Failed to parse booking:', e);
        if (active) setLoadingUser(false);
      }
    };

    loadRouteBooking();
    return () => {
      active = false;
    };
  }, [bookingParam, id]);

  useEffect(() => {
    let active = true;
    const loadFeedback = async () => {
      if (!feedbackBookings.length) {
        setBookingFeedback([]);
        return;
      }
      setLoadingFeedback(true);
      const results = await Promise.all(
        feedbackBookings.map(async childBooking => {
          try {
            const feedback = await fetchBookingFeedback(childBooking.bookingId);
            return { booking: childBooking, feedback, available: true };
          } catch {
            return { booking: childBooking, feedback: null, available: false };
          }
        }),
      );
      if (active) {
        setBookingFeedback(results);
        setLoadingFeedback(false);
      }
    };
    loadFeedback();
    return () => {
      active = false;
    };
  }, [feedbackBookings]);

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      if (!feedbackTarget || !feedbackRating) {
        setFeedbackOptions([]);
        return;
      }
      try {
        setLoadingFeedbackOptions(true);
        setFeedbackFormError('');
        const options = await fetchFeedbackOptions({
          reviewerType: 'CUSTOMER',
          revieweeType: 'EXPERT',
          rating: feedbackRating,
          active: true,
        });
        if (active) setFeedbackOptions(options || []);
      } catch (error) {
        if (active) {
          setFeedbackOptions([]);
          setFeedbackFormError(getErrorMessage(error));
        }
      } finally {
        if (active) setLoadingFeedbackOptions(false);
      }
    };
    loadOptions();
    return () => {
      active = false;
    };
  }, [feedbackTarget, feedbackRating]);

  const openCustomerFeedback = (result: any) => {
    setFeedbackTarget(result);
    setFeedbackRating(0);
    setFeedbackOptionCodes([]);
    setFeedbackOptions([]);
    setFeedbackComment('');
    setFeedbackFormError('');
  };

  const closeCustomerFeedback = () => {
    if (submittingFeedback) return;
    setFeedbackTarget(null);
    setFeedbackFormError('');
  };

  const replaceCustomerFeedback = (bookingId: string, customerFeedback: any) => {
    setBookingFeedback(current =>
      current.map(result =>
        result.booking?.bookingId === bookingId
          ? {
              ...result,
              available: true,
              feedback: { ...result.feedback, customerFeedback },
            }
          : result,
      ),
    );
  };

  const submitCustomerFeedback = async () => {
    const bookingId = feedbackTarget?.booking?.bookingId;
    if (!bookingId || submittingFeedback) return;
    if (!feedbackRating) {
      setFeedbackFormError('Select a rating from 1 to 5.');
      return;
    }
    try {
      setSubmittingFeedback(true);
      setFeedbackFormError('');
      const customerFeedback = await addCustomerFeedback(bookingId, {
        rating: feedbackRating,
        optionCodes: feedbackOptionCodes,
        comment: feedbackComment.trim(),
      });
      replaceCustomerFeedback(bookingId, customerFeedback);
      setFeedbackTarget(null);
      showToast('Customer feedback added', 'success');
    } catch (error: any) {
      const status = error?.apiStatus || error?.response?.status;
      if (status === 409) {
        try {
          const feedback = await fetchBookingFeedback(bookingId);
          setBookingFeedback(current =>
            current.map(result =>
              result.booking?.bookingId === bookingId
                ? { ...result, available: true, feedback }
                : result,
            ),
          );
          setFeedbackTarget(null);
          showToast('Customer feedback already exists. Showing the saved feedback.', 'info');
        } catch (refreshError) {
          setFeedbackFormError(getErrorMessage(refreshError));
        }
      } else {
        setFeedbackFormError(getErrorMessage(error));
      }
    } finally {
      setSubmittingFeedback(false);
    }
  };


useEffect(() => {
  setSelectedExpert(getAssignedExpert(booking));
}, [booking]);

useEffect(() => {
  if (
    booking?.status?.toUpperCase() !== 'IN_PROGRESS' ||
    !booking?.bookingSessionResponse?.expectedBookingEndTime
  ) {
    return;
  }

  const updateTimer = () => {
    const endTime = new Date(
      booking.bookingSessionResponse.expectedBookingEndTime,
    ).getTime();

    const diff = endTime - Date.now();

    if (diff <= 0) {
      setRemainingTime('00:00:00');
      return;
    }

    const totalSeconds = Math.floor(
      diff / 1000,
    );

    const hours = Math.floor(
      totalSeconds / 3600,
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60,
    );

    const seconds =
      totalSeconds % 60;

    setRemainingTime(
      `${String(hours).padStart(2, '0')}:${String(
        minutes,
      ).padStart(2, '0')}:${String(
        seconds,
      ).padStart(2, '0')}`,
    );
  };

  updateTimer();

  const interval = setInterval(
    updateTimer,
    1000,
  );

  return () => clearInterval(interval);

}, [
  booking?.status,
  booking?.bookingSessionResponse?.expectedBookingEndTime,
]);

  const loadUserDetails = async (userId: string) => {
    try {
      setLoadingUser(true);
      const userData = await fetchUserDetails(userId);
      setUser(userData);
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      // Don't show error toast, just display N/A for user info
    } finally {
      setLoadingUser(false);
    }
  };


const loadExperts = async (hoodId) => {
  try {
    setLoadingExperts(true);
    setExperts([]);
    setExpertError('');

    const data = await fetchHoodExperts(hoodId);

    const normalized = (data || [])
      .filter((item) => String(item.status || '').toUpperCase() === 'ACTIVE')
      .filter(item => getExpertEligibility(item, booking).eligible)
      .map((item, index) => ({
        id: item.id || item.userId || item.expertUserId,
        name:
          item.name ||
          item.fullName ||
          item.userName ||
          item.user?.name ||
          `Expert ${index + 1}`,
      }));

    // ✅ Remove already assigned expert
    const assignedExpert = getAssignedExpert(booking);
    const unique = normalized.filter(
      (e) => e.id && e.id !== assignedExpert?.id
    );

    setExperts(unique);

  } catch (err) {
    console.error('Failed to fetch experts', err);
    setExpertError('Unable to load available experts. Please retry.');
  } finally {
    setLoadingExperts(false);
  }
};
  
  const openExpertPicker = () => {
    setPendingExpert(null);
    setExpertError('');
    setShowExpertPicker(true);
    loadExperts(booking.hoodId);
  };

  const handleAssignExpert = async () => {
    const assignedExpert = getAssignedExpert(booking);
    if (assignmentInFlight.current || assigning || loadingExperts || !pendingExpert?.id ||
        booking?.status?.toUpperCase() !== 'CONFIRMED' ||
        pendingExpert.id === assignedExpert?.id) return;
    assignmentInFlight.current = true;
    const replacing = Boolean(assignedExpert?.id || assignedExpert?.name);
    try {
      setAssigning(true);
      setExpertError('');
      const nextExpert = pendingExpert;
      await (replacing ? reassignExpert : assignExpert)(booking.bookingId, nextExpert.id);
      // The mutation has succeeded even if the following refresh is unavailable.
      setBooking((current: any) => ({ ...current, assignedExpert: {
        expertId: nextExpert.id, expertName: nextExpert.name,
      } }));
      setShowExpertPicker(false);
      setPendingExpert(null);
      await refreshCurrentBooking();
      // Keep the successful assignment visible if the list endpoint is briefly stale.
      setBooking((current: any) => ({ ...current, assignedExpert: {
        expertId: nextExpert.id, expertName: nextExpert.name,
      } }));
      showToast(`${nextExpert.name} ${replacing ? 'reassigned' : 'assigned'}`, 'success');
    } catch (err: any) {
      setExpertError(getErrorMessage(err));
      if ([400, 403, 404, 409].includes(err?.apiStatus || err?.response?.status)) {
        setPendingExpert(null);
        await refreshCurrentBooking();
      }
    } finally {
      assignmentInFlight.current = false;
      setAssigning(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const refreshCurrentBooking = async () => {
    if (!booking?.hoodId || !booking?.bookingId) return;

    try {
      const response = await fetchBookings(booking.hoodId, 0, 100);
      const refreshedBookings = response?._embedded?.bookingDetailsResponses || [];
      const refreshedBooking = refreshedBookings.find(
        (item: any) => item.bookingId === booking.bookingId
      );

      if (refreshedBooking) {
        setBooking(refreshedBooking);
      }
    } catch (error) {
      console.error('Failed to refresh updated booking:', error);
    }
  };

  const handleSettle = async () => {
    if (!booking?.bookingId) return;
    
    try {
      setActionLoading(true);
      const updatedBooking = await settleBooking(booking.bookingId);
      setBooking((current: any) => ({ ...current, ...updatedBooking }));
      await refreshCurrentBooking();
      showToast('Booking settled successfully!', 'success');
    } catch (err: any) {
      if (err?.apiStatus === 409) await refreshCurrentBooking();
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActionLoading(false);
      setConfirmModal({ visible: false, type: null });
    }
  };

  const handleCancel = async () => {
    if (!booking?.bookingId) return;
    
    try {
      setActionLoading(true);
      const updatedBooking = await cancelBooking(booking.bookingId);
      setBooking((current: any) => ({ ...current, ...updatedBooking }));
      await refreshCurrentBooking();
      showToast('Booking cancelled successfully!', 'success');
    } catch (err: any) {
      if (err?.apiStatus === 409) await refreshCurrentBooking();
      showToast(getErrorMessage(err), 'error');
    } finally {
      setActionLoading(false);
      setConfirmModal({ visible: false, type: null });
    }
  };

  const handleCallUser = (phone: string) => {
    if (phone && phone !== 'N/A') {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleCopyPhone = async (phone: string) => {
    if (!phone || phone === 'N/A') return;
    await Clipboard.setStringAsync(phone);
    showToast('Mobile number copied', 'success');
  };

  const handleCopyCoordinates = async () => {
    const coordinates = getCoordinates();
    if (!coordinates) return;
    await Clipboard.setStringAsync(coordinates);
    showToast('Coordinates copied', 'success');
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, type });
  };

  const formatDate = (dateString?: string) => {
    return formatIndiaDateTime(dateString);
  };

  const getServiceName = () => {
    if (booking?.services && booking.services.length > 0) {
      return booking.services[0].productName || booking.services[0].serviceName;
    }
    return booking?.serviceType || booking?.serviceName;
  };

  const getAddress = () => {
    const addr = booking?.bookingAddress;
    if (!addr) return null;
    const parts = [
      addr.addressLine1,
      addr.addressLine2,
      addr.locality,
      `${addr.city}, ${addr.state} ${addr.pincode}`.trim()
    ].filter(Boolean);
    return parts.join('\n');
  };

  const getUserPhone = () => {
    // API returns mobileNumber with countryCode
    if (user?.mobileNumber) {
      const countryCode = user?.countryCode || '91';
      return `+${countryCode} ${user.mobileNumber}`;
    }
    return user?.phone || user?.phoneNumber || user?.mobile || booking?.phone || 'N/A';
  };

  const getCoordinates = () => {
    const address = booking?.bookingAddress;
    if (
      address?.latitude === undefined ||
      address?.latitude === null ||
      address?.longitude === undefined ||
      address?.longitude === null
    ) {
      return '';
    }
    return `${address.latitude}, ${address.longitude}`;
  };

  const getGoogleMapLink = () => {
  const addr = booking?.bookingAddress;
  if (!getCoordinates()) return '';

  const lat = Number(addr.latitude).toFixed(6);
  const lng = Number(addr.longitude).toFixed(6);

  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
};


const handleOpenDirections = () => {
  const link = getGoogleMapLink();
  if (link) {
    Linking.openURL(link);
  }
};


const handleShareLocation = async () => {
  const link = getGoogleMapLink();
  if (!link) return;

  try {
    await Share.share({
      message: `Guest Location:\n${getAddress()}\n\nDirections:\n${link}`,
    });
  } catch (error) {
    console.error('Share failed:', error);
  }
};



const handleAddToCalendar = async () => {

  if (!booking) return;

  await createCalendarEvent({
    booking,

    getAddress: () => {
      const addr = booking?.bookingAddress;
      if (!addr) return '';

      return [
        addr.addressLine1,
        addr.addressLine2,
        addr.locality,
        `${addr.city}, ${addr.state} ${addr.pincode}`
      ]
        .filter(Boolean)
        .join(', ');
    },

    getGoogleMapLink: () => {
      const addr = booking?.bookingAddress;

      if (!addr?.latitude || !addr?.longitude) return '';

      return `https://www.google.com/maps/search/?api=1&query=${addr.latitude},${addr.longitude}`;
    },

    getAmount: () =>
      booking?.priceSummary?.grandTotal ||
      booking?.amount ||
      booking?.totalAmount ||
      booking?.services?.[0]?.totalAmount ||
      0,

    getServiceRecordConsent: () =>
      booking?.serviceRecordConsent?.agreed ? 'true' : 'false'
  });
};

  const isSettled = booking?.status?.toUpperCase() === 'SETTLED';
  const isCancelled = booking?.status?.toUpperCase() === 'CANCELLED';
  const isFailed = booking?.status?.toUpperCase() === 'FAILED';
  const canTakeAction = !isSettled && !isCancelled && !isFailed;
  const canAssignExpert = booking?.status?.toUpperCase() === 'CONFIRMED';
 

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      <ConfirmationModal
        visible={confirmModal.visible && confirmModal.type === 'settle'}
        title="Settle Booking?"
        message="Are you sure you want to mark this booking as settled? This action cannot be undone."
        confirmText="Settle"
        confirmColor={THEME.colors.settled}
        icon="checkmark-circle"
        onConfirm={handleSettle}
        onCancel={() => setConfirmModal({ visible: false, type: null })}
        loading={actionLoading}
      />

      <ConfirmationModal
        visible={confirmModal.visible && confirmModal.type === 'cancel'}
        title="Cancel Booking?"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmText="Cancel Booking"
        confirmColor={THEME.colors.cancelled}
        icon="close-circle"
        onConfirm={handleCancel}
        onCancel={() => setConfirmModal({ visible: false, type: null })}
        loading={actionLoading}
      />
      <Modal
        visible={feedbackTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeCustomerFeedback}
      >
        <View style={styles.expertOverlay}>
          <View style={styles.feedbackDialog}>
            <Text style={styles.feedbackDialogTitle}>Add customer feedback</Text>
            <Text style={styles.feedbackDialogDescription}>
              Record feedback collected from the customer. Once saved, it cannot be edited by an administrator.
            </Text>

            <Text style={styles.feedbackFieldLabel}>Rating</Text>
            <View style={styles.feedbackRatingPicker}>
              {[1, 2, 3, 4, 5].map(value => (
                <TouchableOpacity
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                  accessibilityState={{ checked: feedbackRating === value }}
                  disabled={submittingFeedback}
                  onPress={() => {
                    setFeedbackRating(value);
                    setFeedbackOptionCodes([]);
                  }}
                  style={[
                    styles.feedbackRatingButton,
                    feedbackRating === value && styles.feedbackRatingButtonActive,
                  ]}
                >
                  <Ionicons
                    name={feedbackRating === value ? 'star' : 'star-outline'}
                    size={20}
                    color={feedbackRating === value ? '#FFF' : THEME.colors.primary}
                  />
                  <Text
                    style={[
                      styles.feedbackRatingText,
                      feedbackRating === value && styles.feedbackRatingTextActive,
                    ]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {feedbackRating > 0 && (
              <>
                <Text style={styles.feedbackFieldLabel}>Feedback options</Text>
                {loadingFeedbackOptions ? (
                  <ActivityIndicator color={THEME.colors.primary} />
                ) : feedbackOptions.length ? (
                  <View style={styles.feedbackOptionPicker}>
                    {feedbackOptions.map(option => {
                      const selected = feedbackOptionCodes.includes(option.code);
                      return (
                        <TouchableOpacity
                          key={option.id || option.code}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          disabled={submittingFeedback}
                          onPress={() =>
                            setFeedbackOptionCodes(current =>
                              selected
                                ? current.filter(code => code !== option.code)
                                : [...current, option.code],
                            )
                          }
                          style={[
                            styles.feedbackOptionButton,
                            selected && styles.feedbackOptionButtonActive,
                          ]}
                        >
                          <Ionicons
                            name={selected ? 'checkbox' : 'square-outline'}
                            size={17}
                            color={selected ? THEME.colors.primary : THEME.colors.textMuted}
                          />
                          <Text style={styles.feedbackOptionButtonText}>{option.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.feedbackEmpty}>No options configured for this rating.</Text>
                )}
              </>
            )}

            <Text style={styles.feedbackFieldLabel}>Comment</Text>
            <TextInput
              multiline
              maxLength={2000}
              editable={!submittingFeedback}
              value={feedbackComment}
              onChangeText={setFeedbackComment}
              placeholder="Feedback collected over call"
              placeholderTextColor={THEME.colors.textMuted}
              style={styles.feedbackCommentInput}
            />
            <Text style={styles.feedbackCharacterCount}>{feedbackComment.length}/2000</Text>

            {!!feedbackFormError && (
              <Text accessibilityRole="alert" style={styles.feedbackError}>
                {feedbackFormError}
              </Text>
            )}

            <View style={styles.feedbackDialogActions}>
              <TouchableOpacity
                disabled={submittingFeedback}
                onPress={closeCustomerFeedback}
                style={styles.feedbackCancelButton}
              >
                <Text style={styles.feedbackCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                disabled={submittingFeedback || !feedbackRating || loadingFeedbackOptions}
                onPress={submitCustomerFeedback}
                style={[
                  styles.feedbackSubmitButton,
                  (submittingFeedback || !feedbackRating || loadingFeedbackOptions) && styles.feedbackSubmitButtonDisabled,
                ]}
              >
                {submittingFeedback ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.feedbackSubmitButtonText}>Add feedback</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
<Modal visible={showExpertPicker} transparent animationType="fade"
  onRequestClose={() => !assigning && setShowExpertPicker(false)}>
  <View style={styles.expertOverlay}>
    <View style={styles.expertDialog}>
      <Text style={styles.sectionTitle}>{selectedExpert ? 'Reassign Expert' : 'Assign Expert'}</Text>
      <Text style={styles.eligibilityNoteText}>
        {selectedExpert ? `Current expert: ${selectedExpert.name}. Select a replacement. The customer will receive a new start OTP.` : 'Select an available expert for this booking.'}
      </Text>
      <Text style={styles.eligibilityNoteText}>Showing active experts whose expertise and shift cover this booking.</Text>
      {loadingExperts ? <ActivityIndicator color={THEME.colors.primary} /> : (
        <ScrollView style={{ maxHeight: 320 }}>
          {experts.length === 0 && !expertError && <Text style={styles.noEligibleExperts}>No eligible experts match this service and booking time.</Text>}
          {experts.map(expert => (
            <TouchableOpacity key={expert.id} accessibilityRole="radio"
              accessibilityState={{ checked: pendingExpert?.id === expert.id }}
              disabled={assigning} onPress={() => setPendingExpert(expert)}
              style={[styles.expertOption, pendingExpert?.id === expert.id && { borderColor: THEME.colors.primary }]}>
              <Text style={styles.expertText}>{expert.name}</Text>
              <Ionicons name={pendingExpert?.id === expert.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={THEME.colors.primary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {!!expertError && <Text accessibilityRole="alert" style={{ color: THEME.colors.cancelled }}>{expertError}</Text>}
      {!loadingExperts && <TouchableOpacity disabled={assigning} onPress={() => { setPendingExpert(null); loadExperts(booking.hoodId); }}><Text style={styles.expertText}>Refresh experts</Text></TouchableOpacity>}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity style={styles.expertOption} disabled={assigning} onPress={() => setShowExpertPicker(false)}><Text>Cancel</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button"
          disabled={assigning || loadingExperts || !pendingExpert || !canAssignExpert}
          onPress={handleAssignExpert}
          style={[styles.expertSubmit, (assigning || loadingExperts || !pendingExpert || !canAssignExpert) && { opacity: 0.5 }]}>
          {assigning ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '600' }}>{selectedExpert ? 'Reassign Expert' : 'Assign Expert'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  </View>
</Modal>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Booking Details</Text>
          <Text style={styles.headerId}>{booking.bookingCode || `#${booking.bookingId?.substring(0, 8)}`}</Text>
        </View>
       <View style={styles.headerActions}>

  {booking?.status?.toUpperCase() === 'CONFIRMED' && (
    <TouchableOpacity
      onPress={handleAddToCalendar}
      style={styles.calendarIcon}
    >
      <Ionicons
        name="calendar-outline"
        size={20}
        color={THEME.colors.textMuted}
      />
    </TouchableOpacity>
  )}

<View style={styles.statusContainer}>

  {booking?.status?.toUpperCase() ===
    'IN_PROGRESS' &&
    remainingTime && (
      <View style={styles.timerBadge}>
        <Ionicons
          name="time-outline"
          size={12}
          color="#FFF"
        />

        <Text style={styles.timerBadgeText}>
          {remainingTime}
        </Text>
      </View>
  )}

 <View style={styles.statusBadgeWrapper}>
  <StatusBadge status={booking.status} />
</View>

</View>

</View>
      </View>



      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryServiceIcon}>
              <Ionicons name="briefcase-outline" size={22} color={THEME.colors.primary} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryEyebrow}>Service booking</Text>
              <Text style={styles.summaryService}>{getServiceName() || 'Service details'}</Text>
            </View>
          </View>
          {booking.services?.[0]?.slotStart && (
            <View style={styles.summarySchedule}>
              <Ionicons name="calendar-outline" size={18} color={THEME.colors.primary} />
              <Text style={styles.summaryScheduleText}>
                {formatDate(booking.services[0].slotStart)}
                {booking.services[0].slotEnd
                  ? ` – ${formatTime12Hour(booking.services[0].slotEnd)}`
                  : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Booking Info Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt-outline" size={22} color={THEME.colors.primary} />
            <Text style={styles.sectionTitle}>Booking Information</Text>
          </View>

          <View style={styles.infoCard}>
            <InfoRow label="Created" value={formatDate(booking.createdAt)} />
            {getServiceName() && (
              <InfoRow label="Service" value={getServiceName()} />
            )}
            {booking.services?.[0]?.slotStart && (
              <InfoRow label="Slot Time" value={formatDate(booking.services[0].slotStart)} />
            )}
            {booking.services?.[0]?.slotEnd && (
              <InfoRow label="Slot Ends" value={formatDate(booking.services[0].slotEnd)} />
            )}
            {booking.services?.[0]?.durationMinutes && (
              <InfoRow label="Duration" value={`${booking.services[0].durationMinutes} minutes`} />
            )}
           
          </View>
        </View>

      {['CONFIRMED', 'IN_PROGRESS', 'SETTLED'].includes(
  booking?.status?.toUpperCase(),
) && (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Ionicons
        name="time-outline"
        size={22}
        color={THEME.colors.primary}
      />
      <Text style={styles.sectionTitle}>
        Service Tracking
      </Text>
    </View>

   <View
  style={[
    styles.infoCard,
    styles.serviceTrackingCard,
  ]}
>

      {/* Start Time */}
      <InfoRow
        label="Service Start Time"
        value={formatDate(
          booking?.bookingSessionResponse
            ?.startTime,
        )}
      />

      {/* End Time */}
      <InfoRow
        label={
          booking?.status?.toUpperCase() ===
          'SETTLED'
            ? 'Service End Time'
            : 'Expected End Time'
        }
        value={formatDate(
          getServiceEndTime(booking),
        )}
      />

      {booking?.status?.toUpperCase() === 'IN_PROGRESS' && (
        <InfoRow
          label="Time Remaining"
          value={remainingTime || getRemainingTime(booking)}
          highlight
        />
      )}
    
     {/* OTPs only for active bookings */}
{booking?.status?.toUpperCase() !== 'SETTLED' &&
 booking?.bookingOtpResponse && (
  <>
    {booking.bookingOtpResponse.type === 'END' ? (
      <>
        <InfoRow
          label="Start OTP"
          value="Verified ✓"
        />

        <InfoRow
          label="End OTP"
          value={
            booking.bookingOtpResponse.otp ||
            'N/A'
          }
          highlight
        />
      </>
    ) : (
      <>
        <InfoRow
          label="Start OTP"
          value={
            booking.bookingOtpResponse.otp ||
            'N/A'
          }
          highlight
        />

        <InfoRow
          label="End OTP"
          value="Pending"
        />
      </>
    )}
  </>
)}
    </View>
  </View>
)}
        
{(canAssignExpert || selectedExpert) && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Assigned Expert</Text>
    <View style={styles.infoCard}>
      <View style={styles.assignedExpertSummary}>
        <View style={styles.assignedExpertAvatar}>
          <Ionicons name="person" size={20} color={THEME.colors.primary} />
        </View>
        <View style={styles.assignedExpertCopy}>
          <Text style={styles.assignedExpertLabel}>
            {selectedExpert ? 'Current assigned expert' : 'Assignment status'}
          </Text>
          <Text style={styles.assignedExpertName}>
            {selectedExpert?.name || 'No expert assigned'}
          </Text>
        </View>
      </View>
      {canAssignExpert && <TouchableOpacity accessibilityRole="button" style={styles.expertSubmit} onPress={openExpertPicker}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>{selectedExpert ? 'Reassign Expert' : 'Assign Expert'}</Text>
      </TouchableOpacity>}
    </View>
  </View>
)}
       {/* Address Section */}
{booking.bookingAddress && (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Ionicons
        name="location-outline"
        size={22}
        color={THEME.colors.primary}
      />
      <Text style={styles.sectionTitle}>Booking Address</Text>
    </View>

    <View style={styles.infoCard}>
      <Text style={styles.addressText}>{getAddress()}</Text>

      {getCoordinates() !== '' && (
        <View style={styles.coordinateRow}>
          <View style={styles.coordinateCopy}>
            <Text style={styles.coordinateLabel}>Coordinates</Text>
            <Text style={styles.coordinateValue} selectable>
              {getCoordinates()}
            </Text>
          </View>
          <TouchableOpacity
            style={infoStyles.copyButton}
            onPress={handleCopyCoordinates}
            accessibilityRole="button"
            accessibilityLabel="Copy booking coordinates"
            hitSlop={8}
          >
            <Ionicons name="copy-outline" size={18} color={THEME.colors.primary} />
          </TouchableOpacity>
        </View>
      )}

     {getGoogleMapLink() !== '' && (
        <View style={styles.mapActionsInline}>
          <TouchableOpacity
            style={styles.mapButtonInline}
            onPress={handleOpenDirections}
          >
            <Ionicons
              name="navigate"
              size={16}
              color="#FFF"
            />
            <Text style={styles.mapButtonText}>
              Directions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.mapButtonInline,
              styles.shareButton,
            ]}
            onPress={handleShareLocation}
          >
            <Ionicons
              name="share-social"
              size={16}
              color="#FFF"
            />
            <Text style={styles.mapButtonText}>
              Share
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  </View>
)}



        {/* Guest Info Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={22} color={THEME.colors.primary} />
            <Text style={styles.sectionTitle}>Guest Information</Text>
          </View>

          <View style={styles.infoCard}>
            {loadingUser ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={THEME.colors.primary} />
                <Text style={styles.loadingText}>Loading guest details...</Text>
              </View>
            ) : (
              <>
                <InfoRow
                  label="Name"
                  value={user?.name || user?.fullName || booking.userName || 'N/A'}
                  icon="person"
                />
                <View style={infoStyles.row}>
                  <View style={infoStyles.labelContainer}>
                    <Ionicons name="call" size={16} color={THEME.colors.textMuted} style={infoStyles.icon} />
                    <Text style={infoStyles.label}>Phone</Text>
                  </View>
                  <View style={infoStyles.phoneActions}>
                    <TouchableOpacity
                      onPress={() => handleCallUser(getUserPhone())}
                      disabled={getUserPhone() === 'N/A'}
                      accessibilityRole="link"
                      accessibilityLabel={`Call ${getUserPhone()}`}
                    >
                      <Text style={[infoStyles.value, infoStyles.phoneValue]}>
                        {getUserPhone()}
                      </Text>
                    </TouchableOpacity>
                    {getUserPhone() !== 'N/A' && (
                      <TouchableOpacity
                        style={infoStyles.copyButton}
                        onPress={() => handleCopyPhone(getUserPhone())}
                        accessibilityRole="button"
                        accessibilityLabel="Copy mobile number"
                        hitSlop={8}
                      >
                        <Ionicons name="copy-outline" size={18} color={THEME.colors.primary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <InfoRow
                  label="Email"
                  value={user?.email || booking.email || 'N/A'}
                  icon="mail"
                />
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star-outline" size={22} color={THEME.colors.primary} />
            <Text style={styles.sectionTitle}>Order Feedback</Text>
          </View>
          <Text style={styles.feedbackHelp}>
            Feedback is shown per individual booking in this order.
          </Text>
          {loadingFeedback ? (
            <View style={styles.infoCard}>
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={THEME.colors.primary} />
                <Text style={styles.loadingText}>Loading booking feedback...</Text>
              </View>
            </View>
          ) : (
            bookingFeedback.map(result => {
              const child = result.booking;
              const customerFeedback = result.feedback?.customerFeedback;
              const expertFeedback = result.feedback?.expertFeedback;
              const service = child?.services?.[0];
              const childLabel =
                service?.productName ||
                service?.serviceName ||
                child?.serviceName ||
                child?.bookingCode ||
                `Booking ${String(child?.bookingId || '').slice(0, 8)}`;
              const renderFeedback = (label, feedback, allowCustomerAdd = false) => {
                const submitted = feedback?.submitted === true;
                const rating = Number(feedback?.rating || 0);
                const choices =
                  feedback?.optionLabels ||
                  feedback?.selectedOptionLabels ||
                  feedback?.options ||
                  feedback?.optionCodes ||
                  [];
                return (
                  <View style={styles.feedbackSide}>
                    <View style={styles.feedbackSideHeader}>
                      <Text style={styles.feedbackSideLabel}>{label}</Text>
                      {submitted && rating > 0 && (
                        <View style={styles.feedbackStars}>
                          {[1, 2, 3, 4, 5].map(value => (
                            <Ionicons
                              key={value}
                              name={value <= rating ? 'star' : 'star-outline'}
                              size={15}
                              color={value <= rating ? '#FBBF24' : THEME.colors.textMuted}
                            />
                          ))}
                        </View>
                      )}
                    </View>
                    {submitted ? (
                      <>
                        {Array.isArray(choices) && choices.length > 0 && (
                          <View style={styles.feedbackChoices}>
                            {choices.map((choice, index) => (
                              <View key={`${String(choice?.code || choice)}-${index}`} style={styles.feedbackChoice}>
                                <Text style={styles.feedbackChoiceText}>
                                  {choice?.label || choice?.code || String(choice)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {!!feedback?.comment && (
                          <Text style={styles.feedbackComment}>“{feedback.comment}”</Text>
                        )}
                        {rating <= 0 && (
                          <Text style={styles.feedbackEmpty}>Submitted</Text>
                        )}
                      </>
                    ) : (
                      <>
                        <Text style={styles.feedbackEmpty}>Not submitted</Text>
                        {allowCustomerAdd && (
                          <TouchableOpacity
                            accessibilityRole="button"
                            onPress={() => openCustomerFeedback(result)}
                            style={styles.addFeedbackButton}
                          >
                            <Ionicons name="add-circle-outline" size={17} color="#FFF" />
                            <Text style={styles.addFeedbackButtonText}>Add customer feedback</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                );
              };

              return (
                <View key={child.bookingId} style={styles.feedbackCard}>
                  <View style={styles.feedbackBookingHeader}>
                    <View style={styles.feedbackBookingIcon}>
                      <Ionicons name="briefcase-outline" size={18} color={THEME.colors.primary} />
                    </View>
                    <View style={styles.feedbackBookingCopy}>
                      <Text style={styles.feedbackBookingTitle}>{childLabel}</Text>
                      <Text style={styles.feedbackBookingId}>{child.bookingCode || child.bookingId}</Text>
                    </View>
                  </View>
                  {!result.available ? (
                    <Text style={styles.feedbackError}>Feedback could not be loaded.</Text>
                  ) : (
                    <>
                      {renderFeedback('Customer → Expert', customerFeedback, true)}
                      <View style={styles.feedbackDivider} />
                      {renderFeedback('Expert → Customer', expertFeedback)}
                    </>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Payment Info */}
        {booking.paymentTransactionResponses && booking.paymentTransactionResponses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="card-outline" size={22} color={THEME.colors.primary} />
              <Text style={styles.sectionTitle}>Payment Information</Text>
            </View>

            <View style={styles.infoCard}>
              <InfoRow
                label="Payment Status"
                value={booking.paymentTransactionResponses[0].status || 'N/A'}
              />
              <InfoRow
                label="Payment Mode"
                value={booking.paymentTransactionResponses[0].transactionMode || 'N/A'}
              />
              {booking.paymentTransactionResponses[0].remarks && (
                <InfoRow
                  label="Remarks"
                  value={booking.paymentTransactionResponses[0].remarks}
                />
              )}
            </View>
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Action Buttons - Sticky at bottom */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.settleButton,
            !canTakeAction && styles.disabledButton,
          ]}
          onPress={() => setConfirmModal({ visible: true, type: 'settle' })}
          disabled={!canTakeAction}
          activeOpacity={0.7}
        >
          <Ionicons
            name="checkmark-circle"
            size={22}
            color={!canTakeAction ? '#AAA' : '#FFF'}
          />
          <Text
            style={[
              styles.actionButtonText,
              !canTakeAction && styles.disabledButtonText,
            ]}
          >
            {isSettled ? 'Settled' : 'Settle'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.cancelButton,
            !canTakeAction && styles.disabledButton,
          ]}
          onPress={() => setConfirmModal({ visible: true, type: 'cancel' })}
          disabled={!canTakeAction}
          activeOpacity={0.7}
        >
          <Ionicons
            name="close-circle"
            size={22}
            color={!canTakeAction ? '#AAA' : '#FFF'}
          />
          <Text
            style={[
              styles.actionButtonText,
              !canTakeAction && styles.disabledButtonText,
            ]}
          >
            {isCancelled ? 'Cancelled' : 'Cancel'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Info Row Component
interface InfoRowProps {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
  highlight?: boolean;
  copyable?: boolean;
  actionable?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, icon, highlight, copyable, actionable }) => (
  <View style={infoStyles.row}>
    <View style={infoStyles.labelContainer}>
      {icon && <Ionicons name={icon} size={16} color={THEME.colors.textMuted} style={infoStyles.icon} />}
      <Text style={infoStyles.label}>{label}</Text>
    </View>
    <Text
      style={[
        infoStyles.value, 
        highlight && infoStyles.highlightValue,
        actionable && infoStyles.actionableValue,
      ]}
      numberOfLines={2}
      selectable={copyable}
    >
      {value}
    </Text>
  </View>
);

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  label: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  value: {
    fontSize: 14,
    color: THEME.colors.text,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  phoneActions: {
    flex: 1,
    marginLeft: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  phoneValue: {
    flex: 0,
    marginLeft: 0,
    color: THEME.colors.primary,
    textDecorationLine: 'underline',
  },
  copyButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
  },
  highlightValue: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.settled,
  },
  actionableValue: {
    color: THEME.colors.primary,
    textDecorationLine: 'underline',
  },
});

const styles = StyleSheet.create({
  expertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  expertDialog: { backgroundColor: THEME.colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 520, maxHeight: '90%', gap: 16 },
  expertOption: { padding: 14, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  expertSubmit: { padding: 14, borderRadius: 12, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    marginLeft: -8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  headerId: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  summaryCard: {
    marginBottom: 22,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center' },
  summaryServiceIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, marginHorizontal: 11 },
  summaryEyebrow: { color: THEME.colors.primary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  summaryService: { marginTop: 3, color: THEME.colors.text, fontSize: 16, fontWeight: '800' },
  summarySchedule: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#D8B4FE', flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryScheduleText: { flex: 1, color: THEME.colors.text, fontSize: 12, fontWeight: '700' },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.text,
    marginLeft: 10,
  },
  infoCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  addressText: {
    fontSize: 14,
    color: THEME.colors.text,
    lineHeight: 22,
  },
  coordinateRow: {
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coordinateCopy: {
    flex: 1,
    paddingRight: 10,
  },
  coordinateLabel: {
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coordinateValue: {
    marginTop: 3,
    color: THEME.colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  feedbackHelp: { marginTop: -6, marginBottom: 11, color: THEME.colors.textSecondary, fontSize: 12 },
  feedbackCard: { marginBottom: 12, padding: 15, borderRadius: 16, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: THEME.colors.surface },
  feedbackBookingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  feedbackBookingIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3E8FF' },
  feedbackBookingCopy: { flex: 1, marginLeft: 10 },
  feedbackBookingTitle: { color: THEME.colors.text, fontSize: 15, fontWeight: '800' },
  feedbackBookingId: { marginTop: 2, color: THEME.colors.textMuted, fontSize: 10 },
  feedbackSide: { paddingVertical: 4 },
  feedbackSideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  feedbackSideLabel: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' },
  feedbackStars: { flexDirection: 'row', gap: 2 },
  feedbackChoices: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  feedbackChoice: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#F3E8FF' },
  feedbackChoiceText: { color: THEME.colors.primary, fontSize: 10, fontWeight: '700' },
  feedbackComment: { marginTop: 9, color: THEME.colors.text, fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  feedbackEmpty: { marginTop: 5, color: THEME.colors.textMuted, fontSize: 11 },
  feedbackDivider: { height: 1, marginVertical: 10, backgroundColor: THEME.colors.divider },
  feedbackError: { paddingVertical: 9, color: THEME.colors.error, fontSize: 12 },
  addFeedbackButton: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: THEME.colors.primary },
  addFeedbackButtonText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  feedbackDialog: { width: '100%', maxWidth: 520, maxHeight: '90%', padding: 22, gap: 12, borderRadius: 20, backgroundColor: THEME.colors.surface },
  feedbackDialogTitle: { color: THEME.colors.text, fontSize: 20, fontWeight: '800' },
  feedbackDialogDescription: { color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  feedbackFieldLabel: { marginTop: 3, color: THEME.colors.text, fontSize: 12, fontWeight: '800' },
  feedbackRatingPicker: { flexDirection: 'row', gap: 7 },
  feedbackRatingButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: THEME.colors.surface },
  feedbackRatingButtonActive: { borderColor: THEME.colors.primary, backgroundColor: THEME.colors.primary },
  feedbackRatingText: { color: THEME.colors.primary, fontSize: 13, fontWeight: '800' },
  feedbackRatingTextActive: { color: '#FFF' },
  feedbackOptionPicker: { maxHeight: 180, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  feedbackOptionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 9, backgroundColor: THEME.colors.surface },
  feedbackOptionButtonActive: { borderColor: THEME.colors.primary, backgroundColor: '#FAF5FF' },
  feedbackOptionButtonText: { color: THEME.colors.text, fontSize: 11, fontWeight: '600' },
  feedbackCommentInput: { minHeight: 86, maxHeight: 140, padding: 12, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, color: THEME.colors.text, fontSize: 13, textAlignVertical: 'top' },
  feedbackCharacterCount: { marginTop: -8, alignSelf: 'flex-end', color: THEME.colors.textMuted, fontSize: 10 },
  feedbackDialogActions: { flexDirection: 'row', gap: 10, marginTop: 3 },
  feedbackCancelButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#F3F4F6' },
  feedbackCancelButtonText: { color: THEME.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  feedbackSubmitButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: THEME.colors.primary },
  feedbackSubmitButtonDisabled: { opacity: 0.5 },
  feedbackSubmitButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  spacer: {
    height: 120,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  settleButton: {
    backgroundColor: THEME.colors.settled,
  },
  cancelButton: {
    backgroundColor: THEME.colors.cancelled,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  disabledButtonText: {
    color: '#AAA',
  },
  mapActionsInline: {
  flexDirection: 'row',
  marginTop: 12,
  gap: 10,
},

mapButtonInline: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderRadius: 10,
  backgroundColor: THEME.colors.primary,
  gap: 6,
},

mapButtonText: {
  color: '#FFF',
  fontSize: 13,
  fontWeight: '600',
},
shareButton: {
  backgroundColor: THEME.colors.textSecondary,
},
headerActions: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10
},

calendarIcon: {
  padding: 4,
  opacity: 0.7
},

expertChipActive: {
  backgroundColor: THEME.colors.primary,
},

expertText: {
  fontSize: 13,
  color: THEME.colors.text,
  fontWeight: '600',
},

expertTextActive: {
  color: '#FFF',
},
eligibilityNote: {
  marginBottom: 14,
  padding: 10,
  borderRadius: 10,
  backgroundColor: '#FAF5FF',
  flexDirection: 'row',
  alignItems: 'center',
  gap: 7,
},
eligibilityNoteText: {
  flex: 1,
  color: THEME.colors.textSecondary,
  fontSize: 11,
  lineHeight: 16,
},
noEligibleExperts: {
  paddingVertical: 10,
  color: THEME.colors.textMuted,
  fontSize: 13,
  lineHeight: 19,
},
assignedWrapper: {
  marginBottom: 16,
  paddingBottom: 14,
  borderBottomWidth: 1,
  borderBottomColor: '#F1F1F1',
},


assignedLabel: {
  fontSize: 12,
  color: THEME.colors.textMuted,
  marginBottom: 6,
},

expertList: {
  flexDirection: 'row',
  alignItems: 'center',
},

expertChip: {
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 24,
  backgroundColor: '#F1F5F9',
  marginRight: 12,
  minHeight: 40,
  justifyContent: 'center',
},
assignedExpertCard: {
  backgroundColor: THEME.colors.primary,
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 16,
},

assignedExpertName: {
  color: THEME.colors.text,
  fontSize: 15,
  fontWeight: '700',
},
assignedExpertSummary: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 10,
},
assignedExpertAvatar: {
  width: 42,
  height: 42,
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 21,
  backgroundColor: '#F3E8FF',
},
assignedExpertCopy: {
  flex: 1,
  marginLeft: 11,
},
assignedExpertLabel: {
  marginBottom: 2,
  color: THEME.colors.textMuted,
  fontSize: 11,
  fontWeight: '600',
},
serviceTrackingCard: {
  backgroundColor: '#ffffff',
  borderWidth: 1,
  borderColor: '#ffffff',
  borderRadius: 16,
  padding: 16,
},

otpValue: {
  fontSize: 15,
  fontWeight: '700',
  color: THEME.colors.primary,
},

remainingValue: {
  fontSize: 16,
  fontWeight: '700',
  color: '#F97316',
},
statusContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
},

timerBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  height: 22,
  paddingHorizontal: 12,
  backgroundColor: '#F97316',
  borderRadius: 16,
  marginRight: 4,
},

timerBadgeText: {
  color: '#FFF',
  fontSize: 12,
  fontWeight: '700',
  marginLeft: 4,
},
statusBadgeWrapper: {
  height: 32,
  justifyContent: 'center',
},
});
