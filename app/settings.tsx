import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Modal,
  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from '../components/Toast';
import { getToken, setToken, resetToken, fetchHoodDetails, updateHoodOperatingHours, fetchHoodItems, updateHoodItem } from '../services/api';
import THEME from '../constants/theme';


export default function Settings() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState('');
  const [currentToken, setCurrentToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as const });
  const [operatingHours, setOperatingHours] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [timeType, setTimeType] = useState(null); // 'open' | 'close'
  const [hoodItems, setHoodItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [priceModalVisible, setPriceModalVisible] =
  useState(false);
  const [selectedItem, setSelectedItem] =
  useState(null);
  const [newOfferPrice, setNewOfferPrice] =
  useState('');
  const { hoodId, hoodName } = useLocalSearchParams();

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    loadCurrentToken();
  }, []);

  useEffect(() => {
    if (hoodId) {
      loadHoodOperatingHours();
      loadHoodItems();
    }
  }, [hoodId]);


  const timeStringToDate = (timeStr) => {
  const [hours, minutes] = timeStr.split(':');
  const date = new Date();
  date.setHours(parseInt(hours));
  date.setMinutes(parseInt(minutes));
  date.setSeconds(0);
  return date;
};

const dateToTimeString = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}:00`;
};

const openPicker = (index, type) => {
  setSelectedIndex(index);
  setTimeType(type);
  setShowPicker(true);
};

const loadCurrentToken = async () => {
    const token = await getToken();
    setCurrentToken(token);
    setTokenInput(token);
  };

const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

const loadHoodOperatingHours = async () => {
  try {
    const hood = await fetchHoodDetails(hoodId as string);
    if (hood?.hoodOperatingHours) {
      // Sort by dayOfWeek (1 = Monday)
      const sortedHours = hood.hoodOperatingHours
        .map(h => ({
          dayOfWeek: h.dayOfWeek,
          isClosed: h.isClosed,
          openTime: h.openTime,
          closeTime: h.closeTime
        }))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

      setOperatingHours(sortedHours);
    }

  } catch (err) {
    showToast('Failed to load operating hours', 'error');
  }
};

const handleUpdateOperatingHours = async () => {
  try {
    setLoading(true);
    await updateHoodOperatingHours(operatingHours, hoodId as string);
    showToast('Operating hours updated successfully!', 'success');
  } catch (err) {
    showToast('Failed to update operating hours', 'error');
  } finally {
    setLoading(false);
  }
}

const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      showToast('Please enter a valid token', 'error');
      return;
    }

    try {
      setLoading(true);
      await setToken(tokenInput.trim());
      setCurrentToken(tokenInput.trim());
      showToast('Token saved successfully!', 'success');
    } catch (err) {
      showToast('Failed to save token', 'error');
    } finally {
      setLoading(false);
    }
  };

const handleResetToken = () => {
    Alert.alert(
      'Reset Token',
      'Are you sure you want to reset to the default token?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetToken();
              await loadCurrentToken();
              showToast('Token reset to default', 'success');
            } catch (err) {
              showToast('Failed to reset token', 'error');
            }
          },
        },
      ]
    );
  };

const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, type });
  };

const maskToken = (token: string) => {
    if (!token) return '';
    if (token.length <= 20) return token;
    return `${token.substring(0, 20)}...${token.substring(token.length - 10)}`;
  };

const loadHoodItems = async () => {
  try {
    setLoadingItems(true);
    const data =
      await fetchHoodItems(
        hoodId as string,
      );

    setHoodItems(
  [...(data || [])]
);
  } catch (err) {
    showToast(
      'Failed to load hood items',
      'error',
    );
  } finally {
    setLoadingItems(false);
  }
};

const handleToggleAvailability = async (item) => {
  try {
    await updateHoodItem(
      item.id,
      {
        hoodId: item.hoodId,
        itemId: item.itemId,
        isAvailable: !item.isAvailable,
        offerPrice:
          item.offerPrice ??
          item.itemDefaultPrice,
      },
    );
    await loadHoodItems();
  } catch (err) {
    console.error('toggle failed', err);
  }
};

const openPriceModal = (
  item,
) => {
  setSelectedItem(item);
 setNewOfferPrice(
  String(
    item.offerPrice ??
    item.itemDefaultPrice ??
    '',
  ),
);
  setPriceModalVisible(true);
};

const confirmPriceUpdate = async () => {
  try {
    if (!selectedItem?.id) {
      showToast(
        'Invalid service selected',
        'error',
      );
      return;
    }

    const price = Number(newOfferPrice);

    await updateHoodItem(
      selectedItem.id,
      {
        hoodId: selectedItem.hoodId,
        itemId: selectedItem.itemId,
        isAvailable:
          selectedItem.isAvailable,
        offerPrice: price,
      },
    );

    showToast(
      'Price updated successfully',
      'success',
    );

    closePriceModal();

    await loadHoodItems();
  } catch (err) {
    console.error(
      'Price update failed:',
      err,
    );

    showToast(
      'Failed to update price',
      'error',
    );
  }
};

const closePriceModal = () => {
  setPriceModalVisible(false);
  setSelectedItem(null);
  setNewOfferPrice('');
};

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
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
        <Text style={styles.headerTitle}>
    {hoodName ? `${hoodName} Settings` : 'Settings'}
  </Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Operating Hours Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={22} color={THEME.colors.primary} />
              <Text style={styles.sectionTitle}>Operating Hours</Text>
            </View>

            <View style={styles.infoCard}>
              {operatingHours.map((day, index) => (
                <View key={day.dayOfWeek} style={styles.hourRow}>
                  
                  <Text style={styles.dayLabel}>
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][day.dayOfWeek - 1]}
                  </Text>

                  {day.isClosed ? (
                    <Text style={styles.closedDayText}>Closed</Text>
                  ) : (
                    <View style={styles.timeContainer}>
                      {Platform.OS === 'web' ? (
                        <>
                          <input
                            type="time"
                            value={day.openTime ? day.openTime.slice(0, 5) : ''}
                            onChange={(e) => {
                              const updated = [...operatingHours];
                              updated[index].openTime = e.target.value + ':00';
                              setOperatingHours(updated);
                            }}
                          />
                          <Text style={styles.timeDash}>-</Text>
                          <input
                            type="time"
                            value={day.closeTime ? day.closeTime.slice(0, 5) : ''}
                            onChange={(e) => {
                              const updated = [...operatingHours];
                              updated[index].closeTime = e.target.value + ':00';
                              setOperatingHours(updated);
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <TouchableOpacity style={styles.timeBox} onPress={() => openPicker(index, 'open')}>
                            <Text style={styles.timeText}>{day.openTime.slice(0, 5)}</Text>
                          </TouchableOpacity>
                          <Text style={styles.timeDash}>-</Text>
                          <TouchableOpacity style={styles.timeBox} onPress={() => openPicker(index, 'close')}>
                            <Text style={styles.timeText}>{day.closeTime.slice(0, 5)}</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                  <View style={styles.switchContainer}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      disabled={loading}
                      onPress={async () => {
                        const previousState = operatingHours[index];

                        const updatedDay = {
                          ...previousState,
                          isClosed: !previousState.isClosed,
                        };

                        const updatedHours = [...operatingHours];
                        updatedHours[index] = updatedDay;
                        setOperatingHours(updatedHours);

                        try {
                          setLoading(true);
                          await updateHoodOperatingHours([updatedDay], hoodId as string);

                          showToast(
                            updatedDay.isClosed
                              ? 'Hood closed successfully'
                              : 'Hood opened successfully',
                            'success'
                          );
                        } catch (err) {
                          const reverted = [...operatingHours];
                          reverted[index] = previousState;
                          setOperatingHours(reverted);
                          showToast('Failed to update hood status', 'error');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      style={[
                        styles.switchTrack,
                        day.isClosed ? styles.switchTrackInactive : styles.switchTrackActive,
                        loading && { opacity: 0.6 }
                      ]}
                    >
                      <View
                        style={[
                          styles.switchThumb,
                          day.isClosed
                            ? styles.switchThumbLeft
                            : styles.switchThumbRight,
                        ]}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={[styles.button, styles.saveButton, { marginTop: 16 }]}
                onPress={handleUpdateOperatingHours}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Updating...' : 'Update Hours'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
<View style={styles.section}>

  <View style={styles.sectionHeader}>
    <Ionicons
      name="pricetag-outline"
      size={22}
      color={THEME.colors.primary}
    />

    <Text style={styles.sectionTitle}>
      Hood Items
    </Text>
  </View>
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{
    paddingVertical: 8,
  }}
>
  {hoodItems.map((item) => {
   const effectivePrice =
  item.offerPrice ??
  item.itemDefaultPrice;

const discount =
  item.offerPrice
    ? item.itemDefaultPrice - item.offerPrice
    : 0;

    return (
      <View
        key={item.id}
        style={styles.serviceCard}
      >
 <View style={styles.cardHeader}>
  <TouchableOpacity
    style={[
      styles.serviceToggle,
      item.isAvailable
        ? styles.serviceToggleOn
        : styles.serviceToggleOff,
    ]}
    onPress={() =>
      handleToggleAvailability(item)
    }
  >
    <View
      style={[
        styles.serviceToggleThumb,
        item.isAvailable
          ? styles.serviceToggleThumbRight
          : styles.serviceToggleThumbLeft,
      ]}
    />
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => openPriceModal(item)}
  >
    <Ionicons
      name="create-outline"
      size={20}
      color={THEME.colors.primary}
    />
  </TouchableOpacity>
</View>
        

        <Text style={styles.serviceTitle}>
          {item.productName}
        </Text>

      <View style={styles.priceRow}>
        
  <Text style={styles.offerPrice}>
    ₹{effectivePrice}
  </Text>

  {item.offerPrice && (
    <Text style={styles.strikePrice}>
      ₹{item.itemDefaultPrice}
    </Text>
  )}
</View>
{discount > 0 && (
  <View style={styles.discountBadge}>
    <Text style={styles.discountText}>
      Save ₹{discount}
    </Text>
  </View>
)}
</View>
    );
  })}
</ScrollView>
</View>

          {/* Token Management Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="key-outline" size={22} color={THEME.colors.primary} />
              <Text style={styles.sectionTitle}>API Token</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Current Token</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                {maskToken(currentToken)}
              </Text>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Update Token</Text>
              <Text style={styles.inputDescription}>
                Paste your new Bearer token below when the current one expires (60 days validity).
              </Text>
              <TextInput
                style={styles.tokenInput}
                placeholder="Paste your Bearer token here..."
                placeholderTextColor={THEME.colors.textMuted}
                value={tokenInput}
                onChangeText={setTokenInput}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.button, styles.resetButton]}
                  onPress={handleResetToken}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh" size={18} color={THEME.colors.textSecondary} />
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.saveButton]}
                  onPress={handleSaveToken}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark" size={18} color="#FFF" />
                  <Text style={styles.saveButtonText}>
                    {loading ? 'Saving...' : 'Save Token'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Notifications Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="notifications-outline" size={22} color={THEME.colors.primary} />
              <Text style={styles.sectionTitle}>Notifications</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.notificationRow}>
                <View style={styles.notificationInfo}>
                  <Text style={styles.notificationTitle}>New Booking Alerts</Text>
                  <Text style={styles.notificationDesc}>App checks for new bookings every 30 seconds</Text>
                </View>
                <View style={styles.enabledBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={THEME.colors.settled} />
                  <Text style={styles.enabledText}>Active</Text>
                </View>
              </View>
            </View>
          </View>

          {/* App Info Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="information-circle-outline" size={22} color={THEME.colors.primary} />
              <Text style={styles.sectionTitle}>About</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>App Name</Text>
                <Text style={styles.aboutValue}>Qwiky Admin</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Version</Text>
                <Text style={styles.aboutValue}>1.0.0</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Platform</Text>
                <Text style={styles.aboutValue}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
              </View>
              <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.aboutLabel}>Purpose</Text>
                <Text style={styles.aboutValue}>Internal Booking Management</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {showPicker && Platform.OS !== 'web' && selectedIndex !== null && (
  <DateTimePicker
    value={timeStringToDate(
      timeType === 'open'
        ? operatingHours[selectedIndex].openTime
        : operatingHours[selectedIndex].closeTime
    )}
    mode="time"
    is24Hour={true}
    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
    onChange={(event, selectedDate) => {
      if (Platform.OS === 'android') {
        setShowPicker(false);
      }

      if (selectedDate) {
        const updated = [...operatingHours];
        const formatted = dateToTimeString(selectedDate);

        if (timeType === 'open') {
          updated[selectedIndex].openTime = formatted;
        } else {
          updated[selectedIndex].closeTime = formatted;
        }

        setOperatingHours(updated);
      }
    }}
  />
)}
<Modal
  visible={priceModalVisible}
  transparent
  animationType="slide"
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>

      <Text style={styles.modalTitle}>
        Update Offer Price
      </Text>

    <Text style={{ fontSize: 16, fontWeight: '600' }}>
  {selectedItem?.productName}
</Text>

<Text
  style={{
    marginTop: 8,
    color: '#666',
  }}
>
  Current Price:
  ₹{
    selectedItem?.offerPrice ??
    selectedItem?.itemDefaultPrice
  }
</Text>

<Text
  style={{
    color: '#999',
    marginBottom: 16,
  }}
>

  ₹{selectedItem?.itemDefaultPrice}
</Text>

      <TextInput
        keyboardType="numeric"
        value={newOfferPrice}
        onChangeText={setNewOfferPrice}
        style={styles.priceInput}
      />

      <View style={styles.modalActions}>
     <TouchableOpacity
  style={{
    paddingVertical: 10,
    paddingHorizontal: 18,
  }}
    onPress={closePriceModal}
>
  <Text
    style={{
      color: '#666',
      fontWeight: '600',
    }}
  >
    Cancel
  </Text>
</TouchableOpacity>

<TouchableOpacity
  style={{
    backgroundColor: THEME.colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
  }}
  onPress={confirmPriceUpdate}
>
  <Text
    style={{
      color: '#FFF',
      fontWeight: '700',
    }}
  >
    Update
  </Text>
</TouchableOpacity>
      </View>

    </View>
  </View>
</Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
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
    marginBottom: 12,
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
  infoLabel: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 13,
    color: THEME.colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputCard: {
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
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  inputDescription: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  tokenInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    color: THEME.colors.text,
    minHeight: 100,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  resetButton: {
    backgroundColor: '#F5F5F5',
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  saveButton: {
    backgroundColor: THEME.colors.primary,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  notificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  notificationDesc: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
  enabledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.settledBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  enabledText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.settled,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  aboutLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  aboutValue: {
    fontSize: 14,
    color: THEME.colors.text,
    fontWeight: '500',
  },
hourRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 14,
},
dayLabel: {
  width: 45,
  fontSize: 14,
  fontWeight: '600',
  color: THEME.colors.text,
},
timeDash: {
  marginHorizontal: 6,
},
closedDayText: {
  flex: 1,
  textAlign: 'center',
  fontWeight: '600',
  color: THEME.colors.cancelled,
},
  timeContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  timeBox: { backgroundColor: '#F2F4F7', padding: 8, borderRadius: 10, minWidth: 70, alignItems: 'center' },
  timeText: { fontWeight: '600' },
  switchContainer: {
  marginLeft: 12,
},
  switchTrack: {
    width: 50,
    height: 28,
    borderRadius: 20,
    padding: 3,
    justifyContent: 'center',
  },

  switchTrackActive: {
    backgroundColor: '#2E7D32', // Green (Open)
  },

  switchTrackInactive: {
    backgroundColor: '#C62828', // Red (Closed)
  },

  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },

  switchThumbRight: {
    alignSelf: 'flex-end',
  },

  switchThumbLeft: {
    alignSelf: 'flex-start',
  },
  serviceCard: {
  width: 220,
  backgroundColor: '#FFF',
  borderRadius: 16,
  padding: 16,
  marginRight: 12,
  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 3,
  minHeight: 200
},

discountBadge: {
  alignSelf: 'center',
  marginTop: 10,
  backgroundColor: '#F3E8FF',
  borderRadius: 999,
  paddingHorizontal: 14,
  paddingVertical: 6,
},
discountText: {
  color: THEME.colors.primary,
  fontWeight: '700',
  fontSize: 13,
},
serviceTitle: {
  fontSize: 24,
  fontWeight: '700',
  textAlign: 'center',
  marginTop: 18,
  color: THEME.colors.primary,
},

priceRow: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 16,
},

offerPrice: {
  fontSize: 34,
  fontWeight: '800',
  color: '#111',
},
strikePrice: {
  marginLeft: 8,
  textDecorationLine: 'line-through',
  color: '#9CA3AF',
  fontSize: 22,
  fontWeight: '500',
},
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},

modalContent: {
  width: '90%',
  maxWidth: 420,
  backgroundColor: '#FFF',
  borderRadius: 20,
  padding: 24,
},

modalTitle: {
  fontSize: 20,
  fontWeight: '700',
  marginBottom: 16,
  color: THEME.colors.text,
},

priceInput: {
  borderWidth: 1,
  borderColor: '#DDD',
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
  marginTop: 16,
  marginBottom: 20,
  fontSize: 18,
},

modalActions: {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  gap: 12,
},
cardHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

serviceToggle: {
  width: 42,
  height: 24,
  borderRadius: 12,
  padding: 2,
},

serviceToggleOn: {
  backgroundColor: '#22C55E',
},

serviceToggleOff: {
  backgroundColor: '#D1D5DB',
},

serviceToggleThumb: {
  width: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: '#FFF',
},

serviceToggleThumbRight: {
  alignSelf: 'flex-end',
},

serviceToggleThumbLeft: {
  alignSelf: 'flex-start',
},
});

