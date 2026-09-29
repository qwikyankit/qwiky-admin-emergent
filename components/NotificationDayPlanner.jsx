import React, { useEffect, useRef } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { campaignTypeColor } from '../utils/notifications';

const campaignRunTime = campaign => campaign.nextRunAt || campaign.scheduledAt;

const hourLabel = hour => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return `${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const eventTitle = campaign =>
  [campaign.campaignName || campaign.templateCode, campaign.entryName]
    .filter(Boolean)
    .join(' · ');

export default function NotificationDayPlanner({
  visible,
  date,
  campaigns,
  onClose,
  onChangeDate,
  onCreate,
  onInactivate,
  onEdit,
}) {
  const timelineRef = useRef(null);

  useEffect(() => {
    if (!visible) return undefined;
    const frame = requestAnimationFrame(() => {
      timelineRef.current?.scrollTo({ y: 7 * 84, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [date, visible]);

  if (!date) return null;

  const eventsByHour = new Map();
  campaigns.forEach(campaign => {
    const runAt = new Date(campaignRunTime(campaign));
    if (Number.isNaN(runAt.getTime())) return;
    const hour = runAt.getHours();
    eventsByHour.set(hour, [...(eventsByHour.get(hour) || []), campaign]);
  });

  const moveDay = amount => {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    onChangeDate(next);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton} accessibilityLabel="Back to month planner">
            <Ionicons name="chevron-back" size={27} color={THEME.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.month}>{date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
            <Text style={styles.fullDate}>{date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' })}</Text>
          </View>
          <TouchableOpacity onPress={() => moveDay(-1)} style={styles.headerButton} accessibilityLabel="Previous day">
            <Ionicons name="arrow-back" size={20} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => moveDay(1)} style={styles.headerButton} accessibilityLabel="Next day">
            <Ionicons name="arrow-forward" size={20} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.dateStrip}>
          <Text style={styles.weekday}>{date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</Text>
          <Text style={styles.dayNumber}>{date.getDate()}</Text>
          <Text style={styles.eventCount}>{campaigns.length} notification{campaigns.length === 1 ? '' : 's'}</Text>
        </View>

        <ScrollView ref={timelineRef} style={styles.timeline} showsVerticalScrollIndicator={false}>
          {Array.from({ length: 24 }, (_, hour) => {
            const hourEvents = eventsByHour.get(hour) || [];
            return (
              <View key={hour} style={styles.hourRow}>
                <Text style={styles.hourLabel}>{hourLabel(hour)}</Text>
                <View style={styles.hourLane}>
                  {hourEvents.map(campaign => {
                    const runAt = new Date(campaignRunTime(campaign));
                    const title = eventTitle(campaign);
                    const editableCampaign = !['COMPLETED', 'INACTIVE'].includes(campaign.campaignStatus || campaign.status);
                    const canPause = ['SCHEDULED', 'ACTIVE', 'PROCESSING'].includes(campaign.campaignStatus || campaign.status);
                    return (
                      <View
                        key={campaign.id}
                        style={[styles.event, { backgroundColor: campaignTypeColor(campaign) }]}
                      >
                        <TouchableOpacity
                          onPress={() => editableCampaign && onEdit(campaign)}
                          disabled={!editableCampaign}
                          activeOpacity={0.75}
                          style={styles.eventCopy}
                        >
                          <Text style={styles.eventTitle} numberOfLines={1}>{title}</Text>
                          <Text style={styles.eventMeta}>
                            {runAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {campaign.status}
                          </Text>
                        </TouchableOpacity>
                        {canPause && (
                          <TouchableOpacity onPress={() => onInactivate(campaign)} style={styles.eventAction} accessibilityLabel="Inactivate campaign">
                            <Ionicons name="pause-circle-outline" size={19} color="#0F172A" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={styles.floatingCreateButton} onPress={onCreate} accessibilityLabel="Create notification">
          <Ionicons name="add" size={36} color="#FFF" />
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { minHeight: 72, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 4 },
  month: { color: THEME.colors.text, fontSize: 18, fontWeight: '900' },
  fullDate: { marginTop: 2, color: THEME.colors.textSecondary, fontSize: 11 },
  dateStrip: { minHeight: 95, paddingHorizontal: 22, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, backgroundColor: '#F8FAFC' },
  weekday: { color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '800' },
  dayNumber: { marginTop: 5, color: THEME.colors.text, fontSize: 31, fontWeight: '500' },
  eventCount: { position: 'absolute', right: 20, bottom: 16, color: THEME.colors.textMuted, fontSize: 11, fontWeight: '700' },
  timeline: { flex: 1 },
  hourRow: { minHeight: 84, flexDirection: 'row' },
  hourLabel: { width: 68, paddingTop: 8, paddingRight: 10, color: THEME.colors.textMuted, textAlign: 'right', fontSize: 11, fontWeight: '700' },
  hourLane: { flex: 1, minHeight: 84, padding: 5, borderTopWidth: 1, borderLeftWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  event: { minHeight: 52, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, flexDirection: 'row', alignItems: 'center' },
  eventCopy: { flex: 1 },
  eventAction: { padding: 5 },
  eventTitle: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  eventMeta: { marginTop: 3, color: '#334155', fontSize: 9, fontWeight: '700' },
  floatingCreateButton: { position: 'absolute', right: 20, bottom: 24, width: 64, height: 64, borderRadius: 22, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(87, 43, 145, 0.32)' },
});
