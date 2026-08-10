import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';
import { formatIndiaDate, formatIndiaDateTime, formatTime12Hour } from '../utils/helpers';
import THEME from '../constants/theme';

const BookingCard = ({ booking, onPress }) => {
  const service = booking?.services?.[0];
  const slotStart = service?.slotStart;
  const slotEnd = service?.slotEnd;
  const amount =
    booking?.priceSummary?.grandTotal ??
    booking?.amount ??
    booking?.totalAmount ??
    service?.totalAmount ??
    0;
  const serviceName =
    service?.productName ||
    service?.serviceName ||
    booking?.serviceType ||
    booking?.serviceName ||
    'Service booking';
  const formatAmount = value =>
    `₹${Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const formatCreatedAt = value => {
    if (!value) return null;
    return formatIndiaDateTime(value);
  };

  const createdAt = formatCreatedAt(booking?.createdAt);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.78}
      accessibilityRole="button"
      accessibilityLabel={`Booking ${booking?.bookingCode || booking?.bookingId}`}
    >
      <View style={styles.accent} />
      <View style={styles.header}>
        <View style={styles.codeArea}>
          <View style={styles.receiptIcon}>
            <Ionicons name="receipt-outline" size={19} color={THEME.colors.primary} />
          </View>
          <View style={styles.codeCopy}>
            <Text style={styles.bookingCode}>{booking?.bookingCode || 'Booking'}</Text>
          </View>
        </View>
        <StatusBadge status={booking?.status} />
      </View>

      <View style={styles.serviceArea}>
        <View style={styles.serviceCopy}>
          <Text style={styles.serviceLabel}>Service</Text>
          <Text style={styles.serviceName} numberOfLines={2}>{serviceName}</Text>
        </View>
        <Text style={styles.amount}>{formatAmount(amount)}</Text>
      </View>

      <View style={styles.scheduleCard}>
        <View style={styles.scheduleIcon}>
          <Ionicons name="calendar-outline" size={19} color={THEME.colors.primary} />
        </View>
        <View style={styles.scheduleCopy}>
          <Text style={styles.slotDate}>{slotStart ? formatIndiaDate(slotStart) : 'Schedule unavailable'}</Text>
          <Text style={styles.slotTime}>
            {slotStart
              ? `${formatTime12Hour(slotStart)} – ${formatTime12Hour(slotEnd)}`
              : 'Time unavailable'}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.createdMeta}>
          <Ionicons name="time-outline" size={14} color={THEME.colors.textMuted} />
          <Text style={styles.createdText}>
            {createdAt ? `Created ${createdAt}` : 'Creation date unavailable'}
          </Text>
        </View>
        <View style={styles.detailsAction}>
          <Text style={styles.detailsText}>View details</Text>
          <View style={styles.arrow}>
            <Ionicons name="arrow-forward" size={17} color="#FFF" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 7,
    padding: 16,
    borderRadius: 19,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  accent: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: THEME.colors.primary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeArea: { flex: 1, marginRight: 10, flexDirection: 'row', alignItems: 'center' },
  receiptIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  codeCopy: { flex: 1, marginLeft: 10 },
  bookingCode: { color: THEME.colors.text, fontSize: 15, fontWeight: '800' },
  serviceArea: { marginTop: 15, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  serviceCopy: { flex: 1, paddingRight: 12 },
  serviceLabel: { color: THEME.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  serviceName: { marginTop: 4, color: THEME.colors.text, fontSize: 17, fontWeight: '800' },
  amount: { color: THEME.colors.settled, fontSize: 19, fontWeight: '900' },
  scheduleCard: { minHeight: 63, marginTop: 14, padding: 11, borderRadius: 13, backgroundColor: '#F8F7FC', flexDirection: 'row', alignItems: 'center' },
  scheduleIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  scheduleCopy: { flex: 1, marginLeft: 10 },
  slotDate: { color: THEME.colors.text, fontSize: 12, fontWeight: '800' },
  slotTime: { marginTop: 3, color: THEME.colors.primary, fontSize: 12, fontWeight: '700' },
  footer: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  createdMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  createdText: { flex: 1, color: THEME.colors.textMuted, fontSize: 10, fontWeight: '600' },
  detailsAction: { flexDirection: 'row', alignItems: 'center' },
  detailsText: { marginRight: 7, color: THEME.colors.primary, fontSize: 11, fontWeight: '800' },
  arrow: { width: 27, height: 27, borderRadius: 9, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
});

export default BookingCard;
