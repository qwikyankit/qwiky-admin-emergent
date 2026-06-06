import React from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../constants/theme';

const OperatingHoursSection = ({
  operatingHours,
  setOperatingHours,
  loading,
  handleUpdateOperatingHours,
  handleToggleOperatingDay,
  openPicker,
 }) => {
  return (
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
                   onPress={() =>
  handleToggleOperatingDay(index)
}
                      style={[
                        styles.switchTrack,
                        day.isClosed ? styles.switchTrackInactive : styles.switchTrackActive,
                       
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
              >
                <Text style={styles.saveButtonText}>
                  {loading ? 'Updating...' : 'Update Hours'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
  )}

export default OperatingHoursSection;

const styles = StyleSheet.create({
    infoCard: {
  backgroundColor: '#FFF',
  borderRadius: 20,
padding: 20,
  borderWidth: 1,
  borderColor: '#F1F1F1',
  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
},
section: {
  marginBottom: 24,
},

sectionHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
},

sectionTitle: {
  fontSize: 20,
  fontWeight: '700',
  marginLeft: 10,
},

hourRow: {
  flexDirection: 'row',
  alignItems: 'center',
  minHeight: 40,
},
dayLabel: {
  width: 70,
  fontSize: 16,
  fontWeight: '700',
  color: '#111827',
},
timeDash: {
  marginHorizontal: 6,
},
closedDayText: {
  flex: 1,
  textAlign: 'center',
fontWeight: '700',
  color: THEME.colors.cancelled,
},
  timeContainer: {  
flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
 },
timeBox: {
  width: 140,
  height: 42,

  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 10,

  backgroundColor: '#FFF',

  justifyContent: 'center',
  alignItems: 'center',
},
timeText: {
  fontSize: 15,
  fontWeight: '600',
  color: '#111827',
},
  switchContainer: {
  width: 90,
  alignItems: 'center',
},
  switchTrack: {
    width: 50,
    height: 28,
    borderRadius: 20,
    padding: 3,
    justifyContent: 'center',
    marginLeft: 'auto'
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
button: {
 height: 48,
  borderRadius: 12,
  justifyContent: 'center',
  alignItems: 'center',
},

saveButton: {
  backgroundColor: THEME.colors.primary,
},

saveButtonText: {
 color: '#FFF',
  fontSize: 15,
  fontWeight: '700',
},
});