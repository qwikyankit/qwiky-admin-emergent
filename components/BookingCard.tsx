import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';
import { createCalendarEvent } from '../utils/helpers';
import THEME from '../constants/theme';

const BookingCard = ({ booking, onPress }) => {

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);

      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

    } catch {
      return dateString;
    }
  };

  const formatAmount = (amount) => {
    if (amount === undefined || amount === null) return '₹0';

    return `₹${Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2
    })}`;
  };

  const formatSlotTime = (dateString) => {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);

    return date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

  } catch {
    return dateString;
  }
};

  const getAmount = () => {
    return (
      booking?.priceSummary?.grandTotal ||
      booking?.amount ||
      booking?.totalAmount ||
      booking?.services?.[0]?.totalAmount ||
      0
    );
  };

  const getServiceName = () => {
    if (booking?.services && booking.services.length > 0) {
      return (
        booking.services[0]?.productName ||
        booking.services[0]?.serviceName
      );
    }

    return booking?.serviceType || booking?.serviceName;
  };

  const handleAddToCalendar = async (e) => {

    e.stopPropagation();

    await createCalendarEvent({
      booking,

      getAddress: () => {
        if (!booking?.bookingAddress) return '';

        const addr = booking.bookingAddress;

        return `${addr?.addressLine1 || ''}, ${addr?.locality || ''}, ${addr?.city || ''}`;
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
        0,

      getServiceRecordConsent: () =>
        booking?.serviceRecordConsent?.agreed ? 'true' : 'false'
    });
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={`Booking ${booking?.bookingCode || booking?.bookingId}`}
      accessibilityRole="button"
    >

      <View style={styles.header}>

        <View style={styles.idContainer}>
          <Ionicons
            name="receipt-outline"
            size={18}
            color={THEME.colors.primary}
          />

          <Text style={styles.bookingCode}>
            {booking?.bookingCode || 'N/A'}
          </Text>
        </View>

        <View style={styles.headerActions}>

          {booking?.status?.toUpperCase() === 'CONFIRMED' && (
            <TouchableOpacity
              onPress={handleAddToCalendar}
              style={styles.calendarIcon}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={THEME.colors.textMuted}
              />
            </TouchableOpacity>
          )}

          <StatusBadge status={booking?.status} />

        </View>

      </View>

      <View style={styles.divider} />

      <View style={styles.details}>

        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={THEME.colors.textMuted}
            />
            <Text style={styles.detailLabel}>Date</Text>
          </View>

          <Text style={styles.detailValue}>
            {formatDate(booking?.createdAt || booking?.bookingDate)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailItem}>
            <Ionicons
              name="cash-outline"
              size={16}
              color={THEME.colors.textMuted}
            />
            <Text style={styles.detailLabel}>Amount</Text>
          </View>

          <Text style={styles.amountValue}>
            {formatAmount(getAmount())}
          </Text>
        </View>

        {getServiceName() && (
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons
                name="briefcase-outline"
                size={16}
                color={THEME.colors.textMuted}
              />
              <Text style={styles.detailLabel}>Service</Text>
            </View>

            <Text style={styles.detailValue}>
              {getServiceName()}
            </Text>
          </View>
        )}

      {booking?.services?.[0]?.slotStart && (
  <View style={styles.detailRow}>
    <View style={styles.detailItem}>
      <Ionicons
        name="time-outline"
        size={16}
        color={THEME.colors.textMuted}
      />
      <Text style={styles.detailLabel}>Slot</Text>
    </View>

    <Text style={styles.detailValue}>
      {formatSlotTime(booking.services[0].slotStart)} - {formatSlotTime(booking.services[0].slotEnd)}
    </Text>
  </View>
)}

      </View>

      <View style={styles.footer}>
        <Text style={styles.viewDetails}>View Details</Text>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={THEME.colors.primary}
        />
      </View>

    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({

  card: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    marginHorizontal: THEME.spacing.lg,
    marginVertical: THEME.spacing.sm,

    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8
      },
      android: {
        elevation: 3
      }
    })
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12
  },

  bookingCode: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
    marginLeft: 8
  },

  divider: {
    height: 1,
    backgroundColor: THEME.colors.divider,
    marginVertical: 12
  },

  details: {
    gap: 10
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  detailItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },

  detailLabel: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginLeft: 6
  },

  detailValue: {
    fontSize: 13,
    color: THEME.colors.text,
    fontWeight: '500'
  },

  amountValue: {
    fontSize: 14,
    color: THEME.colors.settled,
    fontWeight: '700'
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.divider
  },

  viewDetails: {
    fontSize: 14,
    color: THEME.colors.primary,
    fontWeight: '600',
    marginRight: 4
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },

  calendarIcon: {
    padding: 4,
    opacity: 0.7
  }

});

export default BookingCard;