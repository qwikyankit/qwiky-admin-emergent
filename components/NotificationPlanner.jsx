import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ConfirmationModal from './ConfirmationModal';
import InstantNotificationModal from './InstantNotificationModal';
import NotificationCampaignWizard from './NotificationCampaignWizard';
import NotificationDayPlanner from './NotificationDayPlanner';
import { THEME } from '../constants/theme';
import {
  fetchNotificationCampaign,
  getErrorMessage,
  inactivateNotificationCampaign,
} from '../services/api';
import {
  CAMPAIGN_STATUSES,
  campaignStatusColor,
  campaignTypeColor,
  formatDateTime,
} from '../utils/notifications';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfMonth = value => new Date(value.getFullYear(), value.getMonth(), 1);

const addMonths = (value, amount) =>
  new Date(value.getFullYear(), value.getMonth() + amount, 1);

const dateKey = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const monthLabel = value =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(value);

const buildCalendarDays = month => {
  const first = startOfMonth(month);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) =>
    new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index),
  );
};

const occurrencesForMonth = (entry, month) => {
  const base = new Date(entry.nextRunAt || entry.scheduledAt);
  if (Number.isNaN(base.getTime())) return [];
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
  const endAt = entry.endAt ? new Date(entry.endAt) : null;
  const inRange = value => value >= monthStart && value <= monthEnd && (!endAt || value <= endAt);
  if (entry.frequencyType === 'ONCE' || entry.frequencyType === 'CRON') return inRange(base) ? [base] : [];
  const results = [];
  const cursor = new Date(Math.max(base.getTime(), monthStart.getTime()));
  cursor.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds());
  while (cursor <= monthEnd) {
    const matches = entry.frequencyType === 'DAILY'
      || (entry.frequencyType === 'WEEKLY' && cursor.getDay() === base.getDay())
      ;
    if (matches && cursor >= base && inRange(cursor)) results.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return results;
};

const campaignRunTime = campaign => campaign.nextRunAt || campaign.scheduledAt;

const canInactivate = campaign =>
  ['SCHEDULED', 'ACTIVE', 'PROCESSING'].includes(campaign.status);

const canEdit = campaign => !['COMPLETED', 'INACTIVE'].includes(campaign.status);

export default function NotificationPlanner({
  campaigns,
  templates,
  loading,
  onRefresh,
  showToast,
}) {
  const { width } = useWindowDimensions();
  const desktop = width >= 850;
  const compactCalendar = width < 700;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [view, setView] = useState('calendar');
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [wizardVisible, setWizardVisible] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [wizardMode, setWizardMode] = useState('create');
  const [openingCampaignId, setOpeningCampaignId] = useState(null);
  const [instantVisible, setInstantVisible] = useState(false);
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [inactivateTarget, setInactivateTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const filteredCampaigns = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return campaigns
      .filter(campaign => {
        const matchesStatus = status === 'ALL' || campaign.status === status;
        const matchesSearch =
          !needle ||
          campaign.campaignName?.toLowerCase().includes(needle) ||
          campaign.templateCode?.toLowerCase().includes(needle) ||
          campaign.channel?.toLowerCase().includes(needle) ||
          campaign.targetType?.toLowerCase().includes(needle) ||
          campaign.targetSummary?.toLowerCase().includes(needle) ||
          campaign.contentPreview?.toLowerCase().includes(needle);
        return matchesStatus && matchesSearch;
      })
      .sort((left, right) => new Date(campaignRunTime(left)) - new Date(campaignRunTime(right)));
  }, [campaigns, search, status]);

  const campaignsByDay = useMemo(() => {
    const map = new Map();
    filteredCampaigns.forEach(campaign => {
      const entries = campaign.scheduleEntries?.length
        ? campaign.scheduleEntries
        : [{
            id: null,
            entryName: '',
            scheduledAt: campaign.scheduledAt || campaign.nextRunAt,
            status: campaign.status,
            frequencyType: campaign.frequencyType,
            timezone: campaign.timezone,
            data: campaign.data,
          }];
      entries.forEach((entry, index) => {
        occurrencesForMonth(entry, month).forEach((occurrence, occurrenceIndex) => {
          const key = dateKey(occurrence);
          if (!key) return;
          const event = {
            ...campaign,
            ...entry,
            id: `${campaign.id}:${entry.id || index}:${occurrenceIndex}`,
            campaignId: campaign.id,
            campaignStatus: campaign.status,
            scheduleEntryId: entry.id,
            campaignName: campaign.campaignName || campaign.templateCode,
            scheduledAt: occurrence.toISOString(),
            status: entry.status || campaign.status,
          };
          map.set(key, [...(map.get(key) || []), event]);
        });
      });
    });
    return map;
  }, [filteredCampaigns, month]);

  const calendarDays = buildCalendarDays(month);
  const monthChoices = Array.from({ length: 7 }, (_, index) => addMonths(month, index));
  const todayKey = dateKey(new Date());

  const campaignCalendarTitle = campaign =>
    [campaign.campaignName || campaign.templateCode, campaign.entryName].filter(Boolean).join(' · ');

  const inactivate = async () => {
    if (!inactivateTarget) return;
    try {
      setSaving(true);
      await inactivateNotificationCampaign(inactivateTarget.campaignId || inactivateTarget.id);
      setInactivateTarget(null);
      showToast('Campaign inactivated. Pending and retry-pending notifications were cancelled.', 'success');
      await onRefresh();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openCampaign = async (campaign, mode) => {
    const campaignId = campaign.campaignId || campaign.id;
    try {
      setOpeningCampaignId(campaignId);
      let detail = campaign;
      try {
        detail = await fetchNotificationCampaign(campaignId);
      } catch (error) {
        const methodUnavailable = /request method ['\"]?GET['\"]? is not supported/i.test(String(error?.friendlyMessage || error?.message || ''));
        if (![404, 405].includes(error?.apiStatus) && !(error?.apiStatus === 500 && methodUnavailable)) throw error;
      }
      setSelectedDay(null);
      setWizardMode(mode);
      setEditingCampaign(detail);
      if (campaign.status === 'PROCESSING') {
        showToast('This campaign is processing. Changes apply to future materialization only.', 'info');
      }
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setOpeningCampaignId(null);
    }
  };

  const renderCampaignCard = campaign => {
    const statusColor = campaignStatusColor(campaign.status);
    return (
      <View key={campaign.id} style={styles.campaignCard}>
        <View style={[styles.statusStripe, { backgroundColor: statusColor }]} />
        <View style={styles.campaignBody}>
          <View style={styles.campaignHeader}>
            <View style={styles.campaignTitleCopy}>
              <Text style={styles.campaignTitle}>{campaign.campaignName || campaign.templateCode}</Text>
              <Text style={styles.campaignTime}>{formatDateTime(campaignRunTime(campaign))}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}16` }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>{campaign.status}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{campaign.channel}</Text>
            <Text style={styles.meta}>·</Text>
            <Text style={styles.meta}>{campaign.targetType?.replace('_', ' ')}</Text>
            <Text style={styles.meta}>·</Text>
            <Text style={styles.meta}>{campaign.frequencyType || 'ONCE'}</Text>
          </View>
          {!!campaign.contentPreview && <Text style={styles.contentPreview} numberOfLines={2}>{campaign.contentPreview}</Text>}
          <View style={styles.campaignFooter}>
            <Text style={styles.revision}>Revision {campaign.revision ?? 1}</Text>
            {canEdit(campaign) && (
              <TouchableOpacity onPress={() => openCampaign(campaign, 'edit')} disabled={Boolean(openingCampaignId)} style={styles.editButton}>
                {openingCampaignId === campaign.id ? <ActivityIndicator size="small" color={THEME.colors.primary} /> : <Ionicons name="create-outline" size={17} color={THEME.colors.primary} />}
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            )}
            {canInactivate(campaign) && (
              <TouchableOpacity onPress={() => setInactivateTarget(campaign)} style={styles.inactivateButton}>
                <Ionicons name="pause-circle-outline" size={17} color="#B45309" />
                <Text style={styles.inactivateText}>Inactivate</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderCopy}>
          <Text style={styles.pageTitle}>Notification Plan</Text>
          <Text style={styles.pageSubtitle}>Scheduled and recurring campaign planner</Text>
        </View>
        {(desktop || view !== 'calendar') && <TouchableOpacity style={styles.createButton} onPress={() => setCreateMenuVisible(true)}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.createButtonText}>{desktop ? 'Create New Notification' : 'Create'}</Text>
        </TouchableOpacity>}
      </View>

      <View style={styles.plannerCard}>
        <View style={styles.toolbar}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={19} color={THEME.colors.textMuted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search by template, channel, or target" style={styles.searchInput} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusFilters}>
            {['ALL', ...CAMPAIGN_STATUSES].map(item => (
              <TouchableOpacity key={item} onPress={() => setStatus(item)} style={[styles.statusFilter, status === item && styles.statusFilterActive]}>
                <Text style={[styles.statusFilterText, status === item && styles.statusFilterTextActive]}>{item === 'ALL' ? 'All' : item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.calendarToolbar, !desktop && styles.calendarToolbarMobile]}>
          <View style={styles.viewToggle}>
            <TouchableOpacity onPress={() => setView('calendar')} style={[styles.viewButton, view === 'calendar' && styles.viewButtonActive]} accessibilityLabel="Calendar view">
              <Ionicons name="calendar-outline" size={19} color={view === 'calendar' ? THEME.colors.primary : THEME.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setView('list')} style={[styles.viewButton, view === 'list' && styles.viewButtonActive]} accessibilityLabel="List view">
              <Ionicons name="list" size={20} color={view === 'list' ? THEME.colors.primary : THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.monthNavigation}>
            <TouchableOpacity onPress={() => setMonth(value => addMonths(value, -1))} style={styles.roundButton}>
              <Ionicons name="chevron-back" size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{monthLabel(month)}</Text>
            <TouchableOpacity onPress={() => setMonth(value => addMonths(value, 1))} style={styles.roundButton}>
              <Ionicons name="chevron-forward" size={18} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMonth(startOfMonth(new Date()))} style={styles.todayButton}>
              <Text style={styles.todayText}>Today</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton} accessibilityLabel="Refresh campaigns">
            <Ionicons name="refresh" size={19} color={THEME.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={THEME.colors.primary} /></View>
        ) : view === 'calendar' ? (
          <View style={styles.calendarSurface}>
            <ScrollView style={styles.monthStripScroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthStrip}>
              {monthChoices.map(choice => {
                const selected = choice.getMonth() === month.getMonth() && choice.getFullYear() === month.getFullYear();
                return (
                  <TouchableOpacity key={`${choice.getFullYear()}-${choice.getMonth()}`} onPress={() => setMonth(choice)} style={[styles.monthChip, selected && styles.monthChipActive]}>
                    <Text style={[styles.monthChipText, selected && styles.monthChipTextActive]}>
                      {choice.toLocaleDateString('en-US', { month: 'short' })}
                    </Text>
                    {choice.getMonth() === 0 && <Text style={styles.monthChipYear}>{choice.getFullYear()}</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.calendarScroll}
            >
              <View style={styles.calendarGrid}>
                {WEEKDAYS.map(day => (
                  <View key={day} style={styles.weekdayCell}>
                    <Text style={styles.weekdayText}>{compactCalendar ? day.slice(0, 1) : day}</Text>
                  </View>
                ))}
                {calendarDays.map(day => {
                  const key = dateKey(day);
                  const events = campaignsByDay.get(key) || [];
                  const outsideMonth = day.getMonth() !== month.getMonth();
                  const today = key === todayKey;
                  return (
                    <TouchableOpacity key={key} style={styles.dayCell} onPress={() => setSelectedDay(day)} activeOpacity={0.82}>
                      <Text style={[styles.dayNumber, outsideMonth && styles.dayNumberMuted, today && styles.todayNumber]}>{day.getDate()}</Text>
                      <View style={styles.dayEvents}>
                        {events.slice(0, 3).map(campaign => {
                          const color = campaignTypeColor(campaign);
                          const title = campaignCalendarTitle(campaign);
                          return (
                            <TouchableOpacity
                              key={campaign.id}
                              onPress={() => setSelectedDay(day)}
                              style={[styles.calendarEvent, { backgroundColor: color }]}
                              accessibilityLabel={`${title}, ${formatDateTime(campaignRunTime(campaign))}, ${campaign.status}`}
                            >
                              <Text style={styles.eventText} numberOfLines={1}>{title}</Text>
                            </TouchableOpacity>
                          );
                        })}
                        {events.length > 3 && <Text style={styles.moreText}>+{events.length - 3} more</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            {!desktop && (
              <TouchableOpacity style={styles.floatingCreateButton} onPress={() => setCreateMenuVisible(true)} accessibilityLabel="Create new notification">
                <Ionicons name="add" size={34} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>
            {!filteredCampaigns.length ? (
              <View style={styles.empty}>
                <Ionicons name="calendar-outline" size={42} color={THEME.colors.textMuted} />
                <Text style={styles.emptyTitle}>No planned notifications</Text>
                <Text style={styles.emptyText}>Create a campaign or change the current filters.</Text>
              </View>
            ) : filteredCampaigns.map(renderCampaignCard)}
          </ScrollView>
        )}
      </View>

      <Modal visible={createMenuVisible} transparent animationType="fade" onRequestClose={() => setCreateMenuVisible(false)}>
        <View style={styles.createMenuOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setCreateMenuVisible(false)} accessibilityLabel="Close create menu" />
          <View style={styles.createMenuCard}>
            <Text style={styles.createMenuTitle}>Create notification</Text>
            <Text style={styles.createMenuSubtitle}>Choose how this notification should be delivered.</Text>
            <TouchableOpacity
              style={styles.createMenuOption}
              onPress={() => {
                setCreateMenuVisible(false);
                setInstantVisible(true);
              }}
            >
              <View style={styles.createMenuIcon}>
                <Ionicons name="flash" size={20} color={THEME.colors.primary} />
              </View>
              <View style={styles.createMenuCopy}>
                <Text style={styles.createMenuOptionTitle}>Instant Generic Push</Text>
                <Text style={styles.createMenuOptionText}>Send now using PIN codes, title, and description.</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={THEME.colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.createMenuOption}
              onPress={() => {
                setCreateMenuVisible(false);
                setEditingCampaign(null);
                setWizardMode('create');
                setWizardVisible(true);
              }}
            >
              <View style={styles.createMenuIcon}>
                <Ionicons name="calendar" size={20} color={THEME.colors.primary} />
              </View>
              <View style={styles.createMenuCopy}>
                <Text style={styles.createMenuOptionTitle}>Schedule Notification</Text>
                <Text style={styles.createMenuOptionText}>Open the campaign planner and recurrence options.</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <NotificationDayPlanner
        visible={Boolean(selectedDay)}
        date={selectedDay}
        campaigns={selectedDay ? campaignsByDay.get(dateKey(selectedDay)) || [] : []}
        templates={templates}
        onClose={() => setSelectedDay(null)}
        onChangeDate={setSelectedDay}
        onCreate={() => {
          setSelectedDay(null);
          setCreateMenuVisible(true);
        }}
        onInactivate={campaign => {
          setSelectedDay(null);
          setInactivateTarget(campaign);
        }}
        onEdit={campaign => {
          openCampaign(campaign, 'edit');
        }}
      />

      <InstantNotificationModal
        visible={instantVisible}
        onClose={() => setInstantVisible(false)}
        onSent={onRefresh}
        showToast={showToast}
      />

      <NotificationCampaignWizard
        visible={wizardVisible || Boolean(editingCampaign)}
        templates={templates}
        campaign={editingCampaign}
        mode={wizardMode}
        onClose={() => {
          setWizardVisible(false);
          setEditingCampaign(null);
          setWizardMode('create');
        }}
        onCreated={onRefresh}
        showToast={showToast}
      />

      <ConfirmationModal
        visible={Boolean(inactivateTarget)}
        title="Inactivate campaign?"
        message="The campaign will stop scheduling future runs. Linked pending and retry-pending notifications will be cancelled; sent notifications and campaign history are retained."
        confirmText="Inactivate"
        confirmColor="#B45309"
        loading={saving}
        onCancel={() => setInactivateTarget(null)}
        onConfirm={inactivate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageHeaderCopy: { flex: 1 },
  pageTitle: { color: THEME.colors.text, fontSize: 25, fontWeight: '900' },
  pageSubtitle: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 12 },
  createButton: { minHeight: 46, paddingHorizontal: 17, borderRadius: 10, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  createButtonText: { color: '#FFF', fontWeight: '800' },
  plannerCard: { flex: 1, marginHorizontal: 16, marginBottom: 16, borderRadius: 18, borderWidth: 1, borderColor: '#DDE3EC', backgroundColor: '#F8FAFC', overflow: 'hidden' },
  toolbar: { padding: 12, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBox: { flex: 1, minWidth: 220, minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 8, color: THEME.colors.text },
  statusFilters: { gap: 6 },
  statusFilter: { minHeight: 36, paddingHorizontal: 11, borderRadius: 18, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  statusFilterActive: { borderColor: THEME.colors.primary, backgroundColor: '#F3E8FF' },
  statusFilterText: { color: THEME.colors.textSecondary, fontSize: 10, fontWeight: '800' },
  statusFilterTextActive: { color: THEME.colors.primary },
  calendarToolbar: { minHeight: 62, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#CBD5E1', flexDirection: 'row', alignItems: 'center' },
  calendarToolbarMobile: { paddingHorizontal: 8 },
  viewToggle: { flexDirection: 'row', gap: 4 },
  viewButton: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  viewButtonActive: { borderWidth: 1, borderColor: '#93C5FD', backgroundColor: '#EFF6FF' },
  monthNavigation: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  roundButton: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  monthTitle: { minWidth: 120, color: THEME.colors.text, textAlign: 'center', fontSize: 16, fontWeight: '800' },
  todayButton: { minHeight: 36, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  todayText: { color: THEME.colors.textSecondary, fontWeight: '700' },
  refreshButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center' },
  calendarSurface: { flex: 1, position: 'relative', backgroundColor: '#FFF' },
  monthStripScroll: { minHeight: 70, maxHeight: 70, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  monthStrip: { minWidth: '100%', minHeight: 69, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14, gap: 8, alignItems: 'center' },
  monthChip: { minWidth: 64, minHeight: 38, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  monthChipActive: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  monthChipText: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' },
  monthChipTextActive: { color: '#FFF' },
  monthChipYear: { marginTop: 1, color: THEME.colors.textMuted, fontSize: 8, fontWeight: '700' },
  calendarScroll: { width: '100%' },
  calendarGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#FFF' },
  weekdayCell: { width: '14.285%', height: 42, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  weekdayText: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' },
  dayCell: { width: '14.285%', minHeight: 114, padding: 6, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
  dayNumber: { width: 25, height: 25, borderRadius: 13, color: THEME.colors.text, textAlign: 'center', lineHeight: 25, fontSize: 12, fontWeight: '700' },
  dayNumberMuted: { color: '#CBD5E1' },
  todayNumber: { color: '#FFF', backgroundColor: '#2563EB', fontWeight: '900' },
  dayEvents: { marginTop: 4, gap: 3 },
  calendarEvent: { minHeight: 21, paddingHorizontal: 5, borderRadius: 3, flexDirection: 'row', alignItems: 'center' },
  eventText: { flex: 1, color: '#0F172A', fontSize: 10, fontWeight: '800' },
  moreText: { color: THEME.colors.primary, fontSize: 9, fontWeight: '800' },
  floatingCreateButton: { position: 'absolute', right: 18, bottom: 18, width: 60, height: 60, borderRadius: 20, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(87, 43, 145, 0.32)' },
  createMenuOverlay: { flex: 1, padding: 18, backgroundColor: 'rgba(15, 23, 42, 0.45)', alignItems: 'center', justifyContent: 'center' },
  createMenuCard: { width: '100%', maxWidth: 520, padding: 18, borderRadius: 18, backgroundColor: '#FFF', boxShadow: '0 18px 45px rgba(15, 23, 42, 0.2)' },
  createMenuTitle: { color: THEME.colors.text, fontSize: 20, fontWeight: '900' },
  createMenuSubtitle: { marginTop: 4, marginBottom: 13, color: THEME.colors.textSecondary, fontSize: 11 },
  createMenuOption: { minHeight: 76, marginTop: 9, padding: 12, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  createMenuIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  createMenuCopy: { flex: 1, marginHorizontal: 11 },
  createMenuOptionTitle: { color: THEME.colors.text, fontSize: 13, fontWeight: '900' },
  createMenuOptionText: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 10, lineHeight: 14 },
  listContent: { padding: 14, paddingBottom: 35 },
  campaignCard: { minHeight: 126, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', overflow: 'hidden' },
  statusStripe: { width: 5 },
  campaignBody: { flex: 1, padding: 13 },
  campaignHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  campaignTitleCopy: { flex: 1 },
  campaignTitle: { color: THEME.colors.text, fontSize: 15, fontWeight: '900' },
  campaignTime: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 11 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999 },
  statusBadgeText: { fontSize: 9, fontWeight: '900' },
  metaRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  meta: { color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  contentPreview: { marginTop: 8, color: THEME.colors.textMuted, fontSize: 10, lineHeight: 14 },
  campaignFooter: { marginTop: 11, flexDirection: 'row', alignItems: 'center' },
  revision: { flex: 1, color: THEME.colors.textMuted, fontSize: 10 },
  editButton: { minHeight: 32, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText: { color: THEME.colors.primary, fontSize: 10, fontWeight: '900' },
  inactivateButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4 },
  inactivateText: { color: '#B45309', fontSize: 11, fontWeight: '800' },
  empty: { padding: 42, alignItems: 'center' },
  emptyTitle: { marginTop: 12, color: THEME.colors.text, fontSize: 17, fontWeight: '800' },
  emptyText: { marginTop: 5, color: THEME.colors.textSecondary, textAlign: 'center' },
});
