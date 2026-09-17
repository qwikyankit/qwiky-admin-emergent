import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import StatusBadge from './StatusBadge';
import { formatIndiaDate, formatIndiaDateTime, formatTime12Hour } from '../utils/helpers';
import THEME from '../constants/theme';

const BookingCard = ({ booking, user, onPress, onCopy }) => {
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
  const address =
    booking?.bookingAddress ||
    user?.address ||
    user?.addresses?.find(item => item.isDefault) ||
    user?.addresses?.[0];
  const customerName = user?.name || user?.userName || booking?.userName;
  const phoneNumber =
    user?.mobileNumber || user?.phoneNumber || user?.phone || booking?.phone;
  const countryCode = user?.countryCode || booking?.countryCode || '91';
  const displayPhone = phoneNumber
    ? `+${String(countryCode).replace(/^\+/, '')} ${phoneNumber}`
    : '';
  const addressText = address
    ? [
        address.addressLine1 || address.line1,
        address.addressLine2 || address.line2,
        address.locality,
        [address.city, address.state, address.pincode || address.pinCode]
          .filter(Boolean)
          .join(', '),
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const hasCoordinates =
    address?.latitude !== undefined &&
    address?.latitude !== null &&
    address?.longitude !== undefined &&
    address?.longitude !== null;
  const coordinates = hasCoordinates ? `${address.latitude}, ${address.longitude}` : '';

  const stopCardPress = event => event?.stopPropagation?.();

  const copyValue = async (event, value, successMessage) => {
    stopCardPress(event);
    if (value) {
      await Clipboard.setStringAsync(value);
      onCopy?.(successMessage);
    }
  };

  const callCustomer = event => {
    stopCardPress(event);
    if (phoneNumber) Linking.openURL(`tel:${phoneNumber}`);
  };

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

      <View style={styles.detailsPanel}>
        <View style={styles.scheduleRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="calendar-outline" size={17} color={THEME.colors.primary} />
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

        {(customerName || displayPhone || addressText || coordinates) && (
          <View style={styles.customerSection}>
            <View style={styles.customerHeader}>
              <View style={styles.detailIcon}>
                <Ionicons name="person-outline" size={17} color={THEME.colors.primary} />
              </View>
              <Text style={styles.customerTitle}>{customerName || 'Customer'}</Text>
            </View>

            {!!displayPhone && (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={14} color={THEME.colors.textMuted} />
                <TouchableOpacity style={styles.detailValue} onPress={callCustomer}>
                  <Text style={styles.phoneText}>{displayPhone}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={event => copyValue(event, displayPhone, 'Mobile number copied')}
                  accessibilityLabel="Copy customer phone number"
                >
                  <Ionicons name="copy-outline" size={15} color={THEME.colors.primary} />
                </TouchableOpacity>
              </View>
            )}

            {!!addressText && (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={15} color={THEME.colors.textMuted} />
                <Text style={styles.addressText} numberOfLines={2}>{addressText}</Text>
              </View>
            )}

            {!!coordinates && (
              <View style={styles.detailRow}>
                <Ionicons name="navigate-outline" size={14} color={THEME.colors.textMuted} />
                <Text style={styles.coordinateText} numberOfLines={1}>{coordinates}</Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={event => copyValue(event, coordinates, 'Coordinates copied')}
                  accessibilityLabel="Copy booking coordinates"
                >
                  <Ionicons name="copy-outline" size={15} color={THEME.colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
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
  detailsPanel: { marginTop: 12, paddingHorizontal: 11, borderRadius: 13, backgroundColor: '#F8F7FC', borderWidth: 1, borderColor: '#F0EDF5' },
  scheduleRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center' },
  detailIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  scheduleCopy: { flex: 1, marginLeft: 10 },
  slotDate: { color: THEME.colors.text, fontSize: 12, fontWeight: '800' },
  slotTime: { marginTop: 3, color: THEME.colors.primary, fontSize: 12, fontWeight: '700' },
  customerSection: { paddingTop: 9, paddingBottom: 8, borderTopWidth: 1, borderTopColor: '#E9E5F0' },
  customerHeader: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 2 },
  customerTitle: { flex: 1, color: THEME.colors.text, fontSize: 13, fontWeight: '800' },
  detailRow: { minHeight: 27, marginLeft: 7, paddingLeft: 34, flexDirection: 'row', alignItems: 'center', gap: 7 },
  detailValue: { flex: 1 },
  phoneText: { color: THEME.colors.primary, fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' },
  addressText: { flex: 1, color: THEME.colors.textSecondary, fontSize: 11, lineHeight: 16 },
  coordinateText: { flex: 1, color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  copyButton: { width: 27, height: 27, borderRadius: 8, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  createdMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  createdText: { flex: 1, color: THEME.colors.textMuted, fontSize: 10, fontWeight: '600' },
  detailsAction: { flexDirection: 'row', alignItems: 'center' },
  detailsText: { marginRight: 7, color: THEME.colors.primary, fontSize: 11, fontWeight: '800' },
  arrow: { width: 27, height: 27, borderRadius: 9, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
});

export default BookingCard;
