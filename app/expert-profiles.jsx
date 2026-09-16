import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import THEME from '../constants/theme';
import Toast from '../components/Toast';
import {
  fetchAdminFeedbackWeightage,
  fetchHoodExperts,
  fetchHoods,
  getErrorMessage,
} from '../services/api';

const RATINGS = [5, 4, 3, 2, 1];

export default function ExpertProfiles() {
  const router = useRouter();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const loadProfiles = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      const hoods = await fetchHoods();
      const hoodResults = await Promise.all(
        (hoods || []).map(async hood => {
          const experts = await fetchHoodExperts(hood.id).catch(() => []);
          return (experts || []).map(expert => ({
            ...expert,
            hoodId: expert.hoodId || hood.id,
            hoodName: hood.name,
            expertUserId: expert.userId || expert.id,
          }));
        }),
      );
      const assignments = hoodResults.flat().filter(item => item.expertUserId);
      const uniqueUserIds = [...new Set(assignments.map(item => item.expertUserId))];
      const summaries = await Promise.all(
        uniqueUserIds.map(async userId => {
          try {
            return [userId, await fetchAdminFeedbackWeightage(userId, 'EXPERT')];
          } catch {
            return [userId, null];
          }
        }),
      );
      const summaryByUser = Object.fromEntries(summaries);
      const profilesByUser = new Map();
      assignments.forEach(assignment => {
        const existing = profilesByUser.get(assignment.expertUserId);
        if (existing) {
          existing.hoodAssignments.push({
            hoodId: assignment.hoodId,
            hoodName: assignment.hoodName,
          });
          return;
        }
        profilesByUser.set(assignment.expertUserId, {
          ...assignment,
          hoodAssignments: [{ hoodId: assignment.hoodId, hoodName: assignment.hoodName }],
          ratingSummary: summaryByUser[assignment.expertUserId],
        });
      });
      setProfiles([...profilesByUser.values()]);
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const openHoodExperts = (profile, hoodAssignment) => {
    router.push({
      pathname: '/experts',
      params: {
        hoodId: hoodAssignment.hoodId,
        hoodName: hoodAssignment.hoodName,
        expertUserId: profile.expertUserId,
      },
    });
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
        <TouchableOpacity style={styles.back} onPress={() => router.replace('/admin-settings')}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Expert Profiles</Text>
          <Text style={styles.subtitle}>Ratings, profiles and shifts</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Loading expert profiles…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadProfiles(true)}
              tintColor={THEME.colors.primary}
            />
          }
        >
          {!profiles.length && (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={42} color={THEME.colors.textMuted} />
              <Text style={styles.emptyTitle}>No expert profiles found</Text>
            </View>
          )}
          {profiles.map(profile => {
            const summary = profile.ratingSummary;
            const total = Number(summary?.totalRatings || 0);
            const average = Number(summary?.averageRating || 0);
            const weightage = Number(summary?.ratingWeightage || 0);
            const distribution = summary?.ratingDistribution || {};
            const name = profile.userName || profile.name || 'Expert';
            return (
              <View key={profile.expertUserId} style={styles.card}>
                <View style={styles.identityRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.identityCopy}>
                    <Text style={styles.expertName}>{name}</Text>
                    <Text style={styles.hoodName}>
                      {profile.hoodAssignments.map(item => item.hoodName).filter(Boolean).join(' · ') ||
                        'Hood unavailable'}
                    </Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={styles.statusText}>{profile.status || 'ACTIVE'}</Text>
                  </View>
                </View>

                {summary === null ? (
                  <Text style={styles.unavailable}>Rating unavailable</Text>
                ) : total === 0 ? (
                  <View style={styles.noRatings}>
                    <Ionicons name="star-outline" size={19} color="#F59E0B" />
                    <Text style={styles.noRatingsText}>No ratings yet</Text>
                  </View>
                ) : (
                  <View style={styles.ratingPanel}>
                    <View style={styles.overallRow}>
                      <View>
                        <Text style={styles.overallLabel}>Overall rating</Text>
                        <Text style={styles.overallScore}>{average.toFixed(1)} / 5</Text>
                      </View>
                      <View style={styles.totalBlock}>
                        <Text style={styles.totalValue}>{total}</Text>
                        <Text style={styles.totalLabel}>{total === 1 ? 'rating' : 'ratings'}</Text>
                      </View>
                    </View>
                    <View style={styles.weightTrack}>
                      <View
                        style={[
                          styles.weightFill,
                          { width: `${Math.max(0, Math.min(100, weightage))}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.weightText}>{weightage.toFixed(0)}% rating weightage</Text>

                    <View style={styles.distribution}>
                      {RATINGS.map(stars => {
                        const count = Number(distribution[String(stars)] || 0);
                        const percentage = total ? (count / total) * 100 : 0;
                        return (
                          <View key={stars} style={styles.distributionRow}>
                            <Text style={styles.starLabel}>{stars}</Text>
                            <Ionicons name="star" size={13} color="#F59E0B" />
                            <View style={styles.distributionTrack}>
                              <View
                                style={[styles.distributionFill, { width: `${percentage}%` }]}
                              />
                            </View>
                            <Text style={styles.distributionCount}>{count}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {profile.hoodAssignments.map(hoodAssignment => (
                  <TouchableOpacity
                    key={hoodAssignment.hoodId}
                    style={styles.manageButton}
                    onPress={() => openHoodExperts(profile, hoodAssignment)}
                  >
                    <Ionicons name="create-outline" size={18} color={THEME.colors.primary} />
                    <Text style={styles.manageButtonText}>
                      Manage {hoodAssignment.hoodName || 'hood'} profile and shifts
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={THEME.colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  back: { padding: 8 },
  headerCopy: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: THEME.colors.text },
  subtitle: { marginTop: 2, fontSize: 12, color: THEME.colors.textSecondary },
  placeholder: { width: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: THEME.colors.textSecondary },
  content: { padding: 16, paddingBottom: 40 },
  emptyCard: { padding: 30, alignItems: 'center', borderRadius: 18, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border },
  emptyTitle: { marginTop: 10, color: THEME.colors.text, fontSize: 17, fontWeight: '800' },
  card: { marginBottom: 14, padding: 16, borderRadius: 19, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border },
  identityRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 15, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: THEME.colors.primary, fontSize: 19, fontWeight: '900' },
  identityCopy: { flex: 1, marginHorizontal: 12 },
  expertName: { color: THEME.colors.text, fontSize: 17, fontWeight: '800' },
  hoodName: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 12 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: '#DCFCE7' },
  statusText: { color: '#166534', fontSize: 10, fontWeight: '900' },
  ratingPanel: { marginTop: 15, padding: 14, borderRadius: 15, backgroundColor: '#FFFBEB' },
  overallRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  overallLabel: { color: '#92400E', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  overallScore: { marginTop: 3, color: THEME.colors.text, fontSize: 23, fontWeight: '900' },
  totalBlock: { alignItems: 'flex-end' },
  totalValue: { color: THEME.colors.text, fontSize: 19, fontWeight: '900' },
  totalLabel: { color: THEME.colors.textSecondary, fontSize: 11 },
  weightTrack: { height: 6, marginTop: 11, borderRadius: 999, backgroundColor: '#FDE68A', overflow: 'hidden' },
  weightFill: { height: '100%', borderRadius: 999, backgroundColor: '#F59E0B' },
  weightText: { marginTop: 5, color: '#92400E', fontSize: 10, fontWeight: '700' },
  distribution: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#FDE68A' },
  distributionRow: { minHeight: 25, flexDirection: 'row', alignItems: 'center' },
  starLabel: { width: 14, textAlign: 'right', color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '800' },
  distributionTrack: { flex: 1, height: 6, marginHorizontal: 8, borderRadius: 999, backgroundColor: '#FEF3C7', overflow: 'hidden' },
  distributionFill: { height: '100%', borderRadius: 999, backgroundColor: '#F59E0B' },
  distributionCount: { width: 28, textAlign: 'right', color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  noRatings: { marginTop: 15, padding: 14, borderRadius: 14, backgroundColor: '#FFFBEB', flexDirection: 'row', gap: 8, alignItems: 'center' },
  noRatingsText: { color: '#92400E', fontWeight: '700' },
  unavailable: { marginTop: 15, color: THEME.colors.textSecondary, fontSize: 12 },
  manageButton: { minHeight: 46, marginTop: 14, paddingHorizontal: 13, borderRadius: 12, backgroundColor: '#F3E8FF', flexDirection: 'row', gap: 8, alignItems: 'center' },
  manageButtonText: { flex: 1, color: THEME.colors.primary, fontWeight: '800' },
});
