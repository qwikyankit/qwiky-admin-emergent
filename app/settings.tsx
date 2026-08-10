import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from '../components/Toast';
import THEME from '../constants/theme';
import { formatTime12Hour } from '../utils/helpers';
import {
  fetchHoodDetails,
  fetchHoodExperts,
  fetchHoodItems,
  getErrorMessage,
  updateHoodOperatingHours,
} from '../services/api';

const SECTIONS = [
  {
    route: '/hood-items',
    icon: 'pricetags-outline',
    title: 'Hood Items',
    description: 'Manage availability and pricing. Item creation can live here next.',
    accent: '#FFF7E6',
  },
  {
    route: '/experts',
    icon: 'people-outline',
    title: 'Experts',
    description: 'Add experts, update shifts and expertise, or transfer them.',
    accent: '#F3E8FF',
  },
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Settings() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hoodId = Array.isArray(params.hoodId) ? params.hoodId[0] : params.hoodId;
  const hoodName = Array.isArray(params.hoodName) ? params.hoodName[0] : params.hoodName;
  const [todayHours, setTodayHours] = useState(null);
  const [sectionStats, setSectionStats] = useState<any>(null);
  const [updatingHours, setUpdatingHours] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
  const todayDayOfWeek = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }, []);

  useEffect(() => {
    if (!hoodId) return;
    Promise.all([
      fetchHoodDetails(hoodId),
      fetchHoodExperts(hoodId),
      fetchHoodItems(hoodId),
    ])
      .then(([hood, experts, items]) => {
        const day = hood?.hoodOperatingHours?.find(
          item => item.dayOfWeek === todayDayOfWeek,
        );
        setTodayHours(day || null);
        const expertList = experts || [];
        const itemList = items || [];
        const activeExperts = expertList.filter(
          expert => String(expert.status || '').toUpperCase() === 'ACTIVE',
        ).length;
        const categoryIds = new Set(
          expertList.flatMap(expert =>
            (expert.expertises || expert.expertiseList || expert.hoodUserExpertises || [])
              .map(expertise => expertise.categoryId)
              .filter(Boolean),
          ),
        );
        setSectionStats({
          experts: {
            total: expertList.length,
            active: activeExperts,
            inactive: expertList.length - activeExperts,
            categories: categoryIds.size,
          },
          items: {
            total: itemList.length,
            available: itemList.filter(item => Boolean(item.isAvailable)).length,
            unavailable: itemList.filter(item => !item.isAvailable).length,
          },
        });
      })
      .catch(error =>
        setToast({ visible: true, message: getErrorMessage(error), type: 'error' }),
      );
  }, [hoodId, todayDayOfWeek]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const toggleTodayHours = async () => {
    if (!todayHours || updatingHours) return;
    const previous = todayHours;
    const updated = { ...previous, isClosed: !previous.isClosed };
    setTodayHours(updated);
    try {
      setUpdatingHours(true);
      await updateHoodOperatingHours([updated], hoodId);
      setToast({
        visible: true,
        message: updated.isClosed ? 'Today marked closed' : 'Today marked open',
        type: 'success',
      });
    } catch (error) {
      setTodayHours(previous);
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setUpdatingHours(false);
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
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Hood Settings</Text>
          <Text style={styles.headerSubtitle}>{hoodName || 'Selected hood'}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Choose a section to manage. Each area has its own page so additional create and edit tools can be added cleanly.
        </Text>

        <View style={styles.sectionCard}>
          <View style={[styles.sectionIcon, { backgroundColor: '#EAF2FF' }]}>
            <Ionicons name="time-outline" size={24} color={THEME.colors.primary} />
          </View>
          <TouchableOpacity
            style={styles.sectionCopy}
            onPress={() =>
              router.push({
                pathname: '/operating-hours',
                params: { hoodId, hoodName },
              })
            }
          >
            <Text style={styles.sectionTitle}>Hood Operating Hours</Text>
            <Text style={styles.operatingDay}>
              {DAYS[new Date().getDay()]} ·{' '}
              {todayHours?.isClosed
                ? 'Closed'
                : todayHours
                  ? `${formatTime12Hour(todayHours.openTime)} – ${formatTime12Hour(todayHours.closeTime)}`
                  : 'Schedule unavailable'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{ checked: Boolean(todayHours && !todayHours.isClosed) }}
            disabled={!todayHours || updatingHours}
            onPress={toggleTodayHours}
            style={[
              styles.switchTrack,
              todayHours && !todayHours.isClosed ? styles.openTrack : styles.closedTrack,
            ]}
          >
            <View
              style={[
                styles.switchThumb,
                todayHours && !todayHours.isClosed ? styles.thumbRight : styles.thumbLeft,
              ]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/operating-hours',
                params: { hoodId, hoodName },
              })
            }
            style={styles.chevronButton}
          >
            <Ionicons name="chevron-forward" size={22} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {SECTIONS.map(section => (
          <TouchableOpacity
            key={section.route}
            activeOpacity={0.8}
            style={styles.sectionCard}
            onPress={() =>
              router.push({
                pathname: section.route,
                params: { hoodId, hoodName },
              })
            }
          >
            <View style={[styles.sectionIcon, { backgroundColor: section.accent }]}>
              <Ionicons name={section.icon} size={24} color={THEME.colors.primary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.route === '/experts' && sectionStats?.experts ? (
                <Text style={styles.sectionStats}>
                  {sectionStats.experts.total} total · {sectionStats.experts.active} active ·{' '}
                  {sectionStats.experts.inactive} inactive · {sectionStats.experts.categories} categories
                </Text>
              ) : section.route === '/hood-items' && sectionStats?.items ? (
                <Text style={styles.sectionStats}>
                  {sectionStats.items.total} total · {sectionStats.items.available} available ·{' '}
                  {sectionStats.items.unavailable} unavailable
                </Text>
              ) : (
                <Text style={styles.sectionDescription}>{section.description}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={22} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  backButton: { padding: 8 },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '800', color: THEME.colors.text },
  headerSubtitle: { marginTop: 2, fontSize: 12, color: THEME.colors.textSecondary },
  placeholder: { width: 40 },
  content: { padding: 16, paddingBottom: 40 },
  intro: { marginBottom: 18, color: THEME.colors.textSecondary, lineHeight: 21 },
  sectionCard: { minHeight: 92, marginBottom: 12, padding: 15, borderRadius: 17, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center', ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }, android: { elevation: 1 } }) },
  sectionIcon: { width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, marginHorizontal: 13 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: THEME.colors.text },
  sectionDescription: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 17 },
  sectionStats: { marginTop: 6, color: THEME.colors.primary, fontSize: 10, fontWeight: '700', lineHeight: 15 },
  operatingDay: { marginTop: 5, color: THEME.colors.primary, fontSize: 12, fontWeight: '700' },
  switchTrack: { width: 46, height: 26, padding: 3, borderRadius: 13, justifyContent: 'center' },
  openTrack: { backgroundColor: '#22C55E' },
  closedTrack: { backgroundColor: '#D1D5DB' },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', elevation: 2 },
  thumbLeft: { alignSelf: 'flex-start' },
  thumbRight: { alignSelf: 'flex-end' },
  chevronButton: { padding: 7, marginLeft: 3 },
});
