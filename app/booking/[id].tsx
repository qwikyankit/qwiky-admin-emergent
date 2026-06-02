import React, { useState, useEffect } from 'react';
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
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import StatusBadge from '../../components/StatusBadge';
import ConfirmationModal from '../../components/ConfirmationModal';
import Toast from '../../components/Toast';
import { fetchUserDetails, cancelBooking, settleBooking, getErrorMessage, fetchHoodExperts, assignExpert } from '../../services/api';
import { createCalendarEvent, getRemainingTime, getServiceEndTime } from '../../utils/helpers';
import THEME from '../../constants/theme';

export default function BookingDetail() {
  const router = useRouter();
  const { id, booking: bookingParam } = useLocalSearchParams();
  
  const [booking, setBooking] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    type: 'settle' | 'cancel' | null;
  }>({ visible: false, type: null });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as const });
  const [experts, setExperts] = useState([]);
const [selectedExpert, setSelectedExpert] = useState(null);
const [loadingExperts, setLoadingExperts] = useState(false);
const [assigning, setAssigning] = useState(false);
const [showReassign, setShowReassign] = useState(false);
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
    if (bookingParam) {
      try {
        const parsed = JSON.parse(bookingParam as string);
        setBooking(parsed);
        if (parsed.userId) {
          loadUserDetails(parsed.userId);
        } else {
          setLoadingUser(false);
        }
      } catch (e) {
        console.error('Failed to parse booking:', e);
        setLoadingUser(false);
      }
    }
  }, [bookingParam]);


useEffect(() => {
  if (booking?.hoodId) {
    loadExperts(booking.hoodId);
  }
   if (booking?.assignedExpert) {
    setSelectedExpert({
      id: booking.assignedExpert.expertId,
      name: booking.assignedExpert.expertName
    });
  }
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

    const data = await fetchHoodExperts(hoodId);

    const normalized = (data || [])
      // ✅ Only ACTIVE experts
      .filter((item) => item.status === 'ACTIVE')
      .map((item, index) => ({
        id: item.id || item.userId || item.expertUserId,
        name:
          item.name ||
          item.fullName ||
          item.userName ||
          `Expert ${index + 1}`,
      }));

    // ✅ Remove already assigned expert
    const unique = normalized.filter(
      (e) => e.id !== booking?.assignedExpert?.expertId
    );

    setExperts(unique);

  } catch (err) {
    console.error('Failed to fetch experts', err);
    showToast('Failed to load experts', 'error');
  } finally {
    setLoadingExperts(false);
  }
};
  
  const handleAssignExpert = async (expert) => {
  if (!booking?.bookingId || !expert?.id) return;

  // 🔥 Already assigned → reassign flow
  if (selectedExpert?.id === expert.id) return; // already selected

if (selectedExpert && selectedExpert.id !== expert.id) {
  setShowReassign(true);
  return;
}

  try {
    setAssigning(true);

    await assignExpert(booking.bookingId, expert.id);

    setSelectedExpert(expert);

    showToast(`${expert.name} assigned`, 'success');

  } catch (err) {
    showToast(getErrorMessage(err), 'error');
  } finally {
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

  const handleSettle = async () => {
    if (!booking?.bookingId) return;
    
    try {
      setActionLoading(true);
      await settleBooking(booking.bookingId);
      setBooking({ ...booking, status: 'SETTLED' });
      showToast('Booking settled successfully!', 'success');
    } catch (err: any) {
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
      await cancelBooking(booking.bookingId);
      setBooking({ ...booking, status: 'CANCELLED' });
      showToast('Booking cancelled successfully!', 'success');
    } catch (err: any) {
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

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, type });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatAmount = (amount?: number) => {
    if (amount === undefined || amount === null) return '₹0';
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const getAmount = () => {
    return booking?.priceSummary?.grandTotal || 
           booking?.amount || 
           booking?.totalAmount || 
           booking?.services?.[0]?.totalAmount ||
           0;
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

  const getGoogleMapLink = () => {
  const addr = booking?.bookingAddress;
  if (!addr?.latitude || !addr?.longitude) return '';

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
<ConfirmationModal
  visible={showReassign}
  title="Reassign Expert?"
  message="This booking already has an assigned expert. Do you want to reassign?"
  confirmText="Reassign"
  confirmColor={THEME.colors.primary}
  icon="swap-horizontal"
  onConfirm={() => {
    setShowReassign(false);
    showToast('Reassign flow will be enabled soon', 'info');
  }}
  onCancel={() => setShowReassign(false)}
/>
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
        {/* Booking Info Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt-outline" size={22} color={THEME.colors.primary} />
            <Text style={styles.sectionTitle}>Booking Information</Text>
          </View>

          <View style={styles.infoCard}>
            <InfoRow label="Created" value={formatDate(booking.createdAt)} />
            <InfoRow label="Total Amount" value={formatAmount(getAmount())} highlight />
            {getServiceName() && (
              <InfoRow label="Service" value={getServiceName()} />
            )}
            {booking.services?.[0]?.slotStart && (
              <InfoRow label="Slot Time" value={formatDate(booking.services[0].slotStart)} />
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
        
{/* ✅ Assign Expert Section */}
{booking?.status?.toUpperCase() === 'CONFIRMED' && (
<View style={styles.section}>
  <View style={styles.sectionHeader}>
    <Ionicons
      name="people-outline"
      size={22}
      color={THEME.colors.primary}
    />
    <Text style={styles.sectionTitle}>
      Assign Expert {experts.length ? `(${experts.length})` : ''}
    </Text>
  </View>
<View style={styles.infoCard}>

  {loadingExperts ? (
    <ActivityIndicator size="small" color={THEME.colors.primary} />
  ) : experts.length === 0 ? (
    <Text style={{ color: THEME.colors.textMuted }}>
      No experts available
    </Text>
  ) : (
    <>
      {/* ✅ Assigned Expert FIRST */}
      {selectedExpert && (
        <View style={styles.assignedWrapper}>
          <Text style={styles.assignedLabel}>Assigned Expert</Text>

          <View style={styles.assignedExpertCard}>
  <Text style={styles.assignedExpertName}>
    {selectedExpert.name}
  </Text>
</View>
        </View>
      )}

      {/* ✅ Remaining Experts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.expertList}
      >
        {experts
          .filter(e => e.id !== selectedExpert?.id)
          .map((expert, index) => {

            const displayName =
              expert.name || `Expert ${index + 1}`;

            return (
              <TouchableOpacity
                key={expert.id || index}
                onPress={() => handleAssignExpert(expert)}
                style={[
                  styles.expertChip,
                  assigning && { opacity: 0.6 }
                ]}
                disabled={assigning}
              >
                <Text style={styles.expertText}>
                  {displayName}
                </Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </>
  )}

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
                <TouchableOpacity onPress={() => handleCallUser(getUserPhone())}>
                  <InfoRow
                    label="Phone"
                    value={getUserPhone()}
                    icon="call"
                    actionable={getUserPhone() !== 'N/A'}
                  />
                </TouchableOpacity>
                <InfoRow
                  label="Email"
                  value={user?.email || booking.email || 'N/A'}
                  icon="mail"
                />
                <InfoRow
                  label="User ID"
                  value={booking.userId || 'N/A'}
                  icon="finger-print"
                  copyable
                />
              </>
            )}
          </View>
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
              <InfoRow
                label="Amount Paid"
                value={formatAmount(booking.paymentTransactionResponses[0].amount)}
                highlight
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
  color: '#FFF',
  fontSize: 15,
  fontWeight: '700',
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
