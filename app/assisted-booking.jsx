import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Animated,
  Switch,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import THEME from '../constants/theme';
import {
  validateUserByMobile,
  fetchHoodItems,
  fetchSlots,
  createAssistedBooking,
} from '../services/api';

export default function AssistedBooking() {
  const router = useRouter();
  const { hoodId } = useLocalSearchParams();

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const progressAnim = useRef(new Animated.Value(0)).current;

  const [loading, setLoading] = useState(false);

  const [mobile, setMobile] = useState('');
  const [user, setUser] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);

  const [newUser, setNewUser] = useState({ name: '', email: '' });

  const [items, setItems] = useState([]);

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [isCash, setIsCash] = useState(true);
  
   

    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedSession, setSelectedSession] = useState(0);
    const [availableSlots, setAvailableSlots] = useState({
        Morning: [],
        Afternoon: [],
        Evening: [],
        });
    const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
     const sessions = ['Morning', 'Afternoon', 'Evening'];

     useEffect(() => {
  if (selectedItem) {
    loadSlots(selectedItem.id, selectedDate);
  }
}, [selectedDate]);

const handleSelectService = (item) => {
  setSelectedItem(item);
  setSelectedTimeSlot(null);

  if (selectedDate) {
    loadSlots(item.id, selectedDate);
  }
};


  const goToStep = (nextStep) => {
    Animated.timing(progressAnim, {
      toValue: (nextStep - 1) / totalSteps,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setStep(nextStep);
  };

  // 1️⃣ Validate User
 const validateUser = async () => {
  if (!mobile || mobile.length !== 10) {
    return Alert.alert('Validation', 'Enter valid 10 digit mobile number');
  }

  try {
    setLoading(true);

    const res = await validateUserByMobile(mobile);

    if (res && res.id) {
      setUser(res);
      setAddresses(res.addresses || []);
    } else {
      setUser(null);
    }

    goToStep(2);

  } catch (error) {
    Alert.alert('Error', 'Failed to validate user. Please try again.');
    return;   // 🔥 STOP FLOW
  } finally {
    setLoading(false);
  }
};

  // 2️⃣ Fetch Items
  const loadItems = async () => {

  if (user && !selectedAddress) {
    return Alert.alert('Select Address', 'Please select an address to continue.');
  }

  if (!user && (!newUser.name || !newUser.email)) {
    return Alert.alert('Enter Details', 'Please enter user details.');
  }

  try {
    setLoading(true);

    const res = await fetchHoodItems(hoodId);

    if (!res || !res.length) {
      Alert.alert('No Services', 'No services available for this hood.');
      return;
    }

    setItems(res);
    goToStep(3);

  } catch (error) {
    Alert.alert('Error', 'Failed to fetch services.');
    return;   // 🔥 STOP
  } finally {
    setLoading(false);
  }
};

  // 3️⃣ Fetch Slots
const loadSlots = async (hoodItemId, dateObj) => {
  try {
    setLoading(true);

    const dateStr = dateObj.toISOString().split('T')[0];
    const res = await fetchSlots(hoodItemId, dateStr);

    const rawSlots = res?.slots || [];

    // Only available
    const available = rawSlots.filter(s => s.available);

    const grouped = {
      Morning: [],
      Afternoon: [],
      Evening: [],
    };

    available.forEach(slot => {
      const hour = new Date(slot.start).getHours();

      if (hour < 12) grouped.Morning.push(slot);
      else if (hour < 17) grouped.Afternoon.push(slot);
      else grouped.Evening.push(slot);
    });

    setAvailableSlots(grouped);

  } catch {
    Alert.alert('Error', 'Failed to fetch slots');
  } finally {
    setLoading(false);
  }
};
  // 4️⃣ Confirm Booking
 const confirmBooking = async () => {

  if (!selectedTimeSlot) {
    return Alert.alert('Select Slot', 'Slot is required.');
  }

  try {
    setLoading(true);

    const body = {
      hoodItemId: selectedItem.id,
      itemQuantity: 1,
      slotStart: selectedSlot.start,
      paymentMode: isCash ? 'CASH' : 'ONLINE',
    };

    if (user) {
      body.userId = user.id;
      body.addressId = selectedAddress;
    } else {
      body.userRequest = {
        mobileNumber: mobile,
        countryCode: '91',
        name: newUser.name,
        email: newUser.email,
        roles: ['CUSTOMER'],
        createdBy: 'ADMIN',
        status: 'INACTIVE',
      };
    }

    await createAssistedBooking(body);

    Alert.alert('Success', 'Booking Created Successfully', [
      { text: 'OK', onPress: () => router.replace('/') }
    ]);

  } catch (error) {
    Alert.alert('Booking Failed', 'Could not create booking. Try again.');
    return;   // 🔥 STOP
  } finally {
    setLoading(false);
  }
};


const handleBack = () => {
  if (step === 1) {
    router.back();
  } else {
    goToStep(step - 1);
  }
};

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <ScrollView style={styles.container}>
        <View style={styles.topHeader}>
        <TouchableOpacity
            onPress={() =>
            Alert.alert(
                'Discard Booking?',
                'Are you sure you want to exit this flow?',
                [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Exit', onPress: () => router.back() },
                ]
            )
            }
        >
            <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
       
        </View>
      {/* 🔥 Animated Stepper */}
      <View style={styles.progressBarBackground}>
        <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
      </View>
       <TouchableOpacity onPress={handleBack}>
            <Text style={{ marginBottom: 10, color: THEME.colors.primary }}>
                ← Back
            </Text>
            </TouchableOpacity>

      {/* STEP 1 */}
      {step === 1 && (
        <>
          <Text style={styles.title}>Enter Mobile</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="Mobile Number"
            value={mobile}
            onChangeText={setMobile}
          />
          <TouchableOpacity
            disabled={loading}
            style={[
                styles.primaryBtn,
                loading && { opacity: 0.6 }
            ]}
            onPress={validateUser}
        >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>Next</Text>}
          </TouchableOpacity>
        </>
      )}
    

      {/* STEP 2 */}
        {step === 2 && (
        <>
            {user ? (
            <>
                <Text style={styles.title}>Select Address</Text>

               {addresses.map((addr) => {
                const isSelected = selectedAddress === addr.id;

                const formattedAddress = `${addr.line1}${
                    addr.line2 ? `, ${addr.line2}` : ''
                }, ${addr.city}, ${addr.state}`;

                return (
                    <TouchableOpacity
                    key={addr.id}
                    style={[
                        styles.radioRow,
                        isSelected && styles.radioRowSelected,
                    ]}
                    onPress={() => setSelectedAddress(addr.id)}
                    >
                    {/* Radio Icon */}
                    <View style={styles.radioOuter}>
                        {isSelected && <View style={styles.radioInner} />}
                    </View>

                    {/* Address Text */}
                    <View style={{ flex: 1 }}>
                        <Text style={styles.addressText}>
                        {formattedAddress}
                        </Text>
                    </View>
                    </TouchableOpacity>
                );
            })}
            </>
            ) : (
            <>
                <Text style={styles.title}>Create User</Text>

                <TextInput
                style={styles.input}
                placeholder="Name"
                onChangeText={(v) =>
                    setNewUser({ ...newUser, name: v })
                }
                />

                <TextInput
                style={styles.input}
                placeholder="Email"
                onChangeText={(v) =>
                    setNewUser({ ...newUser, email: v })
                }
                />
            </>
            )}

            <TouchableOpacity
            style={styles.primaryBtn}
            onPress={loadItems}
            >
            <Text style={styles.btnText}>Next</Text>
            </TouchableOpacity>
        </>
        )}

      {/* STEP 3 */}
        {step === 3 && (
        <>
            <Text style={styles.title}>Select Date</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[...Array(7)].map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);

                const isSelected =
                date.toDateString() === selectedDate.toDateString();

                return (
                <TouchableOpacity
                    key={i}
                    style={[
                    styles.dateCard,
                    isSelected && styles.selectedCard,
                    ]}
                    onPress={() => {
                    setSelectedDate(date);
                    setSelectedItem(null);
                    setSelectedTimeSlot(null);
                    setAvailableSlots({
                        Morning: [],
                        Afternoon: [],
                        Evening: [],
                    });
                    }}
                >
                    <Text style={styles.dateDay}>
                    {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </Text>
                    <Text style={styles.dateDate}>
                    {date.getDate()}
                    </Text>
                </TouchableOpacity>
                );
            })}
            </ScrollView>

            {selectedDate && (
            <>
                <Text style={styles.title}>Select Service</Text>

                {items.map(item => (
                <TouchableOpacity
                    key={item.id}
                    style={[
                    styles.option,
                    selectedItem?.id === item.id && styles.selected,
                    ]}
                    onPress={() => handleSelectService(item)}
                >
                    <Text>
                    {item.productName} ₹{item.effectivePrice}
                    </Text>
                </TouchableOpacity>
                ))}
            </>
            )}

            {selectedItem && (
            <>
                <Text style={styles.title}>Select Session</Text>

                <View style={styles.sessionRow}>
                {sessions.map((session, idx) => (
                    <TouchableOpacity
                    key={idx}
                    style={[
                        styles.sessionTab,
                        selectedSession === idx && styles.sessionSelected,
                    ]}
                    onPress={() => setSelectedSession(idx)}
                    >
                    <Text>{session}</Text>
                    </TouchableOpacity>
                ))}
                </View>

                <Text style={styles.title}>Available Slots</Text>

                {availableSlots[sessions[selectedSession]]?.length > 0 ? (
                <View style={styles.slotGrid}>
                    {availableSlots[sessions[selectedSession]].map(slot => (
                    <TouchableOpacity
                        key={slot.start}
                        style={[
                        styles.slotCard,
                        selectedTimeSlot?.start === slot.start && styles.selected,
                        ]}
                        onPress={() => setSelectedTimeSlot(slot)}
                    >
                        <Text>
                        {new Date(slot.start).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                        </Text>
                    </TouchableOpacity>
                    ))}
                </View>
                ) : (
                <Text style={{ marginVertical: 10 }}>
                    No slots available
                </Text>
                )}
            </>
            )}

            <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
                if (!selectedTimeSlot)
                return Alert.alert('Select Slot first');
                goToStep(4);
            }}
            >
            <Text style={styles.btnText}>Review</Text>
            </TouchableOpacity>
        </>
        )}

      {/* STEP 4 */}
        {step === 4 && (
        <>
            <Text style={styles.title}>Select Date</Text>

            {/* Date Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[...Array(7)].map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + i);

                const isSelected =
                date.toDateString() === selectedDate.toDateString();

                return (
                <TouchableOpacity
                    key={i}
                    style={[
                    styles.dateCard,
                    isSelected && styles.selectedCard,
                    ]}
                    onPress={() => setSelectedDate(date)}
                >
                    <Text style={styles.dateDay}>
                    {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </Text>
                    <Text style={styles.dateDate}>
                    {date.getDate()}
                    </Text>
                </TouchableOpacity>
                );
            })}
            </ScrollView>

            <Text style={styles.title}>Select Service</Text>

            {items.map(item => (
            <TouchableOpacity
                key={item.id}
                style={[
                styles.option,
                selectedItem?.id === item.id && styles.selected,
                ]}
                onPress={() => handleSelectService(item)}
            >
                <Text>{item.productName} ₹{item.effectivePrice}</Text>
            </TouchableOpacity>
            ))}

            {selectedItem && (
            <>
                <Text style={styles.title}>Select Session</Text>

                <View style={styles.sessionRow}>
                {sessions.map((session, idx) => (
                    <TouchableOpacity
                    key={idx}
                    style={[
                        styles.sessionTab,
                        selectedSession === idx && styles.sessionSelected,
                    ]}
                    onPress={() => setSelectedSession(idx)}
                    >
                    <Text>{session}</Text>
                    </TouchableOpacity>
                ))}
                </View>

                <Text style={styles.title}>Available Slots</Text>

                {availableSlots[sessions[selectedSession]]?.length > 0 ? (
                <View style={styles.slotGrid}>
                    {availableSlots[sessions[selectedSession]].map(slot => (
                    <TouchableOpacity
                        key={slot.start}
                        style={[
                        styles.slotCard,
                        selectedTimeSlot?.start === slot.start && styles.selected,
                        ]}
                        onPress={() => setSelectedTimeSlot(slot)}
                    >
                        <Text>
                        {new Date(slot.start).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                        </Text>
                    </TouchableOpacity>
                    ))}
                </View>
                ) : (
                <Text style={{ marginVertical: 10 }}>
                    No slots available for this session
                </Text>
                )}
            </>
            )}

            <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
                if (!selectedTimeSlot)
                return Alert.alert('Select Slot first');

                goToStep(5);
            }}
            >
            <Text style={styles.btnText}>Review</Text>
            </TouchableOpacity>
        </>
        )}

      {/* STEP 5 → Review */}
      {step === 5 && (
        <>
          <Text style={styles.title}>Review Booking</Text>

          <Text>Mobile: {mobile}</Text>
          <Text>Service: {selectedItem?.productName}</Text>
          <Text>Date: {selectedDate.toDateString()}</Text>
          <Text>
            Time: {selectedSlot && new Date(selectedSlot.start).toLocaleTimeString()}
          </Text>

          <View style={styles.cashRow}>
            <Text>Mark as CASH</Text>
            <Switch value={isCash} onValueChange={setIsCash} />
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={confirmBooking}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.btnText}>Confirm Booking</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#FFF' },
  title: { fontSize: 18, fontWeight: '700', marginVertical: 12 },

  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },

  primaryBtn: {
    backgroundColor: THEME.colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },

  btnText: { color: '#FFF', fontWeight: '600' },

  option: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 8,
  },

  selected: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#EEF2FF',
  },

  progressBarBackground: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    marginBottom: 20,
  },

  progressBar: {
    height: 6,
    backgroundColor: THEME.colors.primary,
    borderRadius: 10,
  },

  cashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
  },
  radioRow: {
  flexDirection: 'row',
  alignItems: 'center',
  padding: 14,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 14,
  marginBottom: 10,
  backgroundColor: '#FFF',
},

radioRowSelected: {
  borderColor: THEME.colors.primary,
  backgroundColor: '#EEF2FF',
},

radioOuter: {
  width: 22,
  height: 22,
  borderRadius: 11,
  borderWidth: 2,
  borderColor: THEME.colors.primary,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
},

radioInner: {
  width: 10,
  height: 10,
  borderRadius: 5,
  backgroundColor: THEME.colors.primary,
},

addressText: {
  fontSize: 14,
  fontWeight: '500',
  lineHeight: 20,
},
dateCard: {
  padding: 12,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 12,
  marginRight: 10,
  alignItems: 'center',
  width: 70,
},

selectedCard: {
  backgroundColor: '#EEF2FF',
  borderColor: THEME.colors.primary,
},

dateDay: {
  fontSize: 12,
  color: '#6B7280',
},

dateDate: {
  fontSize: 16,
  fontWeight: '700',
},

sessionRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  marginVertical: 10,
},

sessionTab: {
  flex: 1,
  padding: 10,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 10,
  alignItems: 'center',
  marginHorizontal: 4,
},

sessionSelected: {
  backgroundColor: '#EEF2FF',
  borderColor: THEME.colors.primary,
},

slotGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
},

slotCard: {
  width: '30%',
  padding: 10,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 10,
  alignItems: 'center',
  marginVertical: 6,
},
topHeader: {
  flexDirection: 'row',
  justifyContent: 'flex-end',
  marginBottom: 10,
},

closeBtn: {
  fontSize: 26,
  fontWeight: '700',
  color: THEME.colors.primary,
},
});