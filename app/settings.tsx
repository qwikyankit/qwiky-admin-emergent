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
import THEME from '../constants/theme';
import OperatingHoursSection from '../components/OperatingHoursSection';
import HoodItemsSection from '../components/HoodItemsSection';
import HoodExpertsSection from '../components/HoodExpertsSection';
import {
  getToken,
  setToken,
  resetToken,
  fetchHoodDetails,
  updateHoodOperatingHours,
  fetchHoodItems,
  updateHoodItem,
  fetchHoodExperts,
  fetchHoods,
  createHoodUser,
  deleteHoodUser,
  updateHoodUserStatus,
  getErrorMessage,
} from '../services/api';

export default function Settings() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState('');
  const [currentToken, setCurrentToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
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
  const [hoodUsers, setHoodUsers] =
  useState([]);
  const [allHoods, setAllHoods] =
  useState([]);
  const [
  selectedTargetHoods,
  setSelectedTargetHoods,
] = useState({});
const [hoodModalVisible, setHoodModalVisible] =
  useState(false);

const [selectedUser, setSelectedUser] =
  useState(null);
  const [
  deleteModalVisible,
  setDeleteModalVisible,
] = useState(false);

const [
  selectedDeleteUser,
  setSelectedDeleteUser,
] = useState(null);
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
      loadHoodUsers();
      loadAllHoods();
    }
  }, [hoodId]);

  const loadHoodUsers = async () => {
  try {
    const data =
      await fetchHoodExperts(
        hoodId,
      );

    setHoodUsers(
      data || [],
    );
  } catch {
    showToast(
      'Failed to load experts',
      'error',
    );
  }
};

const loadAllHoods = async () => {
  try {
    const data =
      await fetchHoods();

    setAllHoods(
      data || [],
    );
  } catch {
    showToast(
      'Failed to load hoods',
      'error',
    );
  }
};


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
    const hood = await fetchHoodDetails(hoodId);
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
    await updateHoodOperatingHours(operatingHours, hoodId);
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

const showToast = (message, type) => {
    setToast({ visible: true, message, type });
  };

const maskToken = (token) => {
    if (!token) return '';
    if (token.length <= 20) return token;
    return `${token.substring(0, 20)}...${token.substring(token.length - 10)}`;
  };

const loadHoodItems = async () => {
  try {
    setLoadingItems(true);
    const data =
      await fetchHoodItems(
        hoodId,
      );
  setHoodItems([...(data || [])].sort(
    (a, b) =>
      (a.sequenceNumber || 999) -
      (b.sequenceNumber || 999)
  ));

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
    item.offerPrice ??
    item.itemDefaultPrice ??
    '',
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

const handleToggleOperatingDay = async (index) => {
  const previousDay = operatingHours[index];

  const updatedDay = {
    ...previousDay,
    isClosed: !previousDay.isClosed,
  };

  const updatedHours = [...operatingHours];
  updatedHours[index] = updatedDay;

  // Optimistic update
  setOperatingHours(updatedHours);

  try {
    setLoading(true);

    await updateHoodOperatingHours(
      [updatedDay],
      hoodId,
    );

    showToast(
      updatedDay.isClosed
        ? 'Day closed successfully'
        : 'Day opened successfully',
      'success',
    );
  } catch (err) {
    // rollback
    const reverted = [...operatingHours];
    reverted[index] = previousDay;

    setOperatingHours(reverted);

    showToast(
      'Failed to update operating hours',
      'error',
    );
  } finally {
    setLoading(false);
  }
};


const handleToggleExpertStatus = async (
  user,
) => {
  try {
    setLoading(true);

    const nextStatus =
      user.status === 'ACTIVE'
        ? 'INACTIVE'
        : 'ACTIVE';

    await updateHoodUserStatus(
      user.hoodId,
      user.userId,
      nextStatus,
    );

    await loadHoodUsers();

    showToast(
      `Expert ${nextStatus.toLowerCase()} successfully`,
      'success',
    );
  } catch (error) {
    showToast(
      getErrorMessage(error),
      'error',
    );
  } finally {
    setLoading(false);
  }
};

const handleTransferExpert = async (
  user,
) => {
  try {
    const targetHoodId =
      selectedTargetHoods[
        user.userId
      ];

    if (!targetHoodId) {
      showToast(
        'Please select target hood',
        'error',
      );
      return;
    }

    setLoading(true);

    await deleteHoodUser(
      user.hoodId,
      user.userId,
    );

    await createHoodUser({
      hoodId: targetHoodId,
      userId: user.userId,
      role: user.role,
      status: user.status,
    });

    setSelectedTargetHoods(prev => {
  const updated = { ...prev };
  delete updated[user.userId];
  return updated;
});

    showToast(
      'Expert transferred successfully',
      'success',
    );

    await Promise.all([
  loadHoodUsers(),
  loadAllHoods(),
]);
  } catch (error) {
    showToast(
      getErrorMessage(error),
      'error',
    );
  } finally {
    setLoading(false);
  }
};

const confirmDeleteExpert = async (
  user,
) => {
   console.log(
    'Deleting...',
    user.hoodId,
    user.userId,
  );
  try {
    setLoading(true);

    await deleteHoodUser(
      user.hoodId,
      user.userId,
    );

    await loadHoodUsers();

    showToast(
      'Expert removed successfully',
      'success',
    );
  } catch (error) {
    showToast(
      getErrorMessage(error),
      'error',
    );
  } finally {
    setLoading(false);
  }
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
      <OperatingHoursSection
  operatingHours={operatingHours}
  setOperatingHours={setOperatingHours}
  loading={loading}
  handleUpdateOperatingHours={handleUpdateOperatingHours}
  handleToggleOperatingDay={
    handleToggleOperatingDay
  }
  openPicker={openPicker}
/>

<HoodItemsSection
  hoodItems={hoodItems}
  handleToggleAvailability={
    handleToggleAvailability
  }
  openPriceModal={openPriceModal}
/>


<HoodExpertsSection
  hoodUsers={hoodUsers}
  allHoods={allHoods}
  selectedTargetHoods={selectedTargetHoods}
  handleTransferExpert={
    handleTransferExpert
  }
  handleToggleExpertStatus={
    handleToggleExpertStatus
  }
  setSelectedUser={setSelectedUser}
  setHoodModalVisible={
    setHoodModalVisible
  }
  handleDeleteExpert={(user) => {
  setSelectedDeleteUser(user);
  setDeleteModalVisible(true);
}}
/>

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
  visible={hoodModalVisible}
  transparent
  animationType="slide"
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>

      <Text style={styles.modalTitle}>
        Select Target Hood
      </Text>

      <ScrollView
        style={{ maxHeight: 300 }}
      >
        {allHoods
          .filter(
            hood =>
              hood.id !== selectedUser?.hoodId
          )
          .map((hood) => (
            <TouchableOpacity
              key={hood.id}
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#EEE',
              }}
              onPress={() => {
                setSelectedTargetHoods({
                  ...selectedTargetHoods,
                  [selectedUser.userId]:
                    hood.id,
                });

                setHoodModalVisible(
                  false,
                );
              }}
            >
              <Text>
                {hood.name}
              </Text>
            </TouchableOpacity>
          ))}
      </ScrollView>

      <TouchableOpacity
        onPress={() =>
          setHoodModalVisible(false)
        }
        style={{
          marginTop: 16,
          alignItems: 'center',
        }}
      >
        <Text>Close</Text>
      </TouchableOpacity>

    </View>
  </View>
</Modal>
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
<Modal
  visible={deleteModalVisible}
  transparent
  animationType="fade"
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>
        Delete Expert
      </Text>

      <Text
        style={{
          color: '#666',
          marginBottom: 20,
          lineHeight: 22,
        }}
      >
        Are you sure you want to remove{' '}
        <Text style={{ fontWeight: '700' }}>
          {selectedDeleteUser?.userName}
        </Text>
        {' '}from this hood?
      </Text>

      <View style={styles.modalActions}>
        <TouchableOpacity
          onPress={() => {
            setDeleteModalVisible(false);
            setSelectedDeleteUser(null);
          }}
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
          onPress={async () => {
            setDeleteModalVisible(false);

            await confirmDeleteExpert(
              selectedDeleteUser,
            );

            setSelectedDeleteUser(null);
          }}
        >
          <Text
            style={{
              color: '#DC2626',
              fontWeight: '700',
            }}
          >
            Delete
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
});

