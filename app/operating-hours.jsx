import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from '../components/Toast';
import THEME from '../constants/theme';
import { formatTime12Hour } from '../utils/helpers';
import {
  fetchHoodDetails,
  getErrorMessage,
  updateHoodOperatingHours,
} from '../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const toDate = value => {
  const [hours, minutes] = (value || '09:00:00').split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const toTime = date =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;

export default function OperatingHours() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hoodId = Array.isArray(params.hoodId) ? params.hoodId[0] : params.hoodId;
  const hoodName = Array.isArray(params.hoodName) ? params.hoodName[0] : params.hoodName;
  const [hours, setHours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const returnToSettings = () =>
    router.replace({
      pathname: '/settings',
      params: { hoodId, hoodName },
    });

  const showToast = (message, type = 'info') =>
    setToast({ visible: true, message, type });

  const loadHours = useCallback(async () => {
    if (!hoodId) return;
    try {
      setLoading(true);
      const hood = await fetchHoodDetails(hoodId);
      setHours(
        [...(hood?.hoodOperatingHours || [])]
          .map(day => ({
            dayOfWeek: day.dayOfWeek,
            isClosed: Boolean(day.isClosed),
            openTime: day.openTime || '09:00:00',
            closeTime: day.closeTime || '18:00:00',
          }))
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      );
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [hoodId]);

  useEffect(() => {
    loadHours();
  }, [loadHours]);

  const updateDay = (index, changes) => {
    setHours(current =>
      current.map((day, dayIndex) =>
        dayIndex === index ? { ...day, ...changes } : day,
      ),
    );
  };

  const toggleDay = async index => {
    const previousDay = hours[index];
    const updatedDay = {
      ...previousDay,
      isClosed: !previousDay.isClosed,
      openTime: previousDay.isClosed ? previousDay.openTime || '09:00:00' : previousDay.openTime,
      closeTime: previousDay.isClosed ? previousDay.closeTime || '18:00:00' : previousDay.closeTime,
    };
    updateDay(index, updatedDay);
    try {
      setSaving(true);
      await updateHoodOperatingHours([updatedDay], hoodId);
      showToast(updatedDay.isClosed ? 'Day closed' : 'Day opened', 'success');
    } catch (error) {
      updateDay(index, previousDay);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    const invalidDay = hours.find(
      day => !day.isClosed && (!day.openTime || !day.closeTime || day.openTime >= day.closeTime),
    );
    if (invalidDay) {
      showToast(`${DAYS[invalidDay.dayOfWeek - 1]} has invalid operating hours`, 'error');
      return;
    }
    try {
      setSaving(true);
      await updateHoodOperatingHours(hours, hoodId);
      showToast('Operating hours updated successfully', 'success');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(current => ({ ...current, visible: false }))}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={returnToSettings} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Operating Hours</Text>
          <Text style={styles.subtitle}>{hoodName || 'Selected hood'}</Text>
        </View>
        <TouchableOpacity disabled={saving} onPress={saveAll} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={THEME.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.pageHelp}>
            Open or close each day and adjust the default service window directly on its card.
          </Text>
          {hours.map((day, index) => (
            <View key={day.dayOfWeek} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.dayName}>{DAYS[day.dayOfWeek - 1]}</Text>
                  <Text style={[styles.dayStatus, day.isClosed && styles.closedText]}>
                    {day.isClosed
                      ? 'Closed'
                      : `${formatTime12Hour(day.openTime)} – ${formatTime12Hour(day.closeTime)}`}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !day.isClosed }}
                  disabled={saving}
                  onPress={() => toggleDay(index)}
                  style={[styles.switchTrack, day.isClosed ? styles.closedTrack : styles.openTrack]}
                >
                  <View style={[styles.switchThumb, day.isClosed ? styles.thumbLeft : styles.thumbRight]} />
                </TouchableOpacity>
              </View>

              {!day.isClosed && (
                <View style={styles.timeRow}>
                  {['openTime', 'closeTime'].map((field, fieldIndex) => (
                    <React.Fragment key={field}>
                      {Platform.OS === 'web' ? (
                        <input
                          type="time"
                          value={day[field].slice(0, 5)}
                          onChange={event => updateDay(index, { [field]: `${event.target.value}:00` })}
                          style={styles.webTimeInput}
                        />
                      ) : (
                        <TouchableOpacity style={styles.timeButton} onPress={() => setPicker({ index, field })}>
                          <Ionicons name="time-outline" size={17} color={THEME.colors.primary} />
                          <Text style={styles.timeText}>{formatTime12Hour(day[field])}</Text>
                        </TouchableOpacity>
                      )}
                      {fieldIndex === 0 && <Text style={styles.toText}>to</Text>}
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {picker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={toDate(hours[picker.index][picker.field])}
          mode="time"
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            if (date) updateDay(picker.index, { [picker.field]: toTime(date) });
            setPicker(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  iconButton: { padding: 8 },
  headerCopy: { flex: 1, marginLeft: 4 },
  title: { fontSize: 20, fontWeight: '800', color: THEME.colors.text },
  subtitle: { marginTop: 2, fontSize: 13, color: THEME.colors.textSecondary },
  saveButton: { minWidth: 68, minHeight: 40, paddingHorizontal: 14, borderRadius: 11, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#FFF', fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  pageHelp: { marginBottom: 14, color: THEME.colors.textSecondary, lineHeight: 20 },
  card: { marginBottom: 11, padding: 16, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayName: { fontSize: 17, fontWeight: '800', color: THEME.colors.text },
  dayStatus: { marginTop: 4, color: '#166534', fontWeight: '600' },
  closedText: { color: '#B91C1C' },
  switchTrack: { width: 48, height: 28, padding: 3, borderRadius: 14, justifyContent: 'center' },
  openTrack: { backgroundColor: '#22C55E' },
  closedTrack: { backgroundColor: '#FCA5A5' },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', elevation: 2 },
  thumbLeft: { alignSelf: 'flex-start' },
  thumbRight: { alignSelf: 'flex-end' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  timeButton: { flex: 1, height: 44, borderRadius: 11, borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  timeText: { color: THEME.colors.text, fontWeight: '700' },
  toText: { color: THEME.colors.textSecondary },
  webTimeInput: { flex: 1, height: 44, borderWidth: 1, borderStyle: 'solid', borderColor: '#EFEFEF', borderRadius: 11, paddingLeft: 10, paddingRight: 10 },
});
