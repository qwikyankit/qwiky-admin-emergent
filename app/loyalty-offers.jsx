import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import Toast from '../components/Toast';
import { THEME } from '../constants/theme';
import {
  activateLoyaltyOffer,
  createLoyaltyOffer,
  fetchHoods,
  fetchLoyaltyOfferReport,
  fetchLoyaltyOffers,
  getErrorMessage,
  getUser,
  setLoyaltyOfferPaused,
  updateLoyaltyOffer,
  validateUserByMobile,
} from '../services/api';

const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

const EMPTY_FORM = {
  title: '',
  displayTitle: '',
  code: '',
  value: '',
  pointUnit: 'PER',
  maxValue: '',
  maxUsage: '',
  perGuestMax: '1',
  existingUser: null,
  applicableHoodId: null,
  applicableHoodCode: null,
  startDate: '',
  endDate: '',
  startTime: '00:00:00',
  endTime: '23:59:59',
  applicableWeekdays: [],
  eligibleUserIds: [],
  excludedUserIds: [],
  status: 'ACTIVE',
  paused: false,
  expired: false,
  promo: true,
  privateReward: false,
  rewardTrigger: 'NONE',
};

const extractRoles = user => {
  const rawRoles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.authorities) ? user.authorities : []),
    ...(Array.isArray(user?.userRoles) ? user.userRoles : []),
    user?.role,
    user?.adminRole,
    user?.userType,
  ].filter(Boolean);
  return {
    hasMetadata: rawRoles.length > 0,
    roles: rawRoles.map(role =>
      String(role?.name || role?.role || role?.roleName || role?.authority || role?.code || role)
        .replace(/^ROLE_/, '')
        .toUpperCase(),
    ),
  };
};

const normalizeOffers = data => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (data?._embedded) {
    const collection = Object.values(data._embedded).find(Array.isArray);
    if (collection) return collection;
  }
  return [];
};

const toApiTime = value => {
  const text = String(value || '').trim();
  return text && /^\d{2}:\d{2}$/.test(text) ? `${text}:00` : text || null;
};

const toNullableNumber = value => {
  const text = String(value ?? '').trim();
  return text === '' ? null : Number(text);
};

const isValidDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const isValidTime = value =>
  /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);

const offerToForm = offer => ({
  ...EMPTY_FORM,
  ...offer,
  value: offer?.value == null ? '' : String(offer.value),
  maxValue: offer?.maxValue == null ? '' : String(offer.maxValue),
  maxUsage: offer?.maxUsage == null ? '' : String(offer.maxUsage),
  perGuestMax: offer?.perGuestMax == null ? '' : String(offer.perGuestMax),
  applicableWeekdays: Array.isArray(offer?.applicableWeekdays)
    ? offer.applicableWeekdays
    : [],
  eligibleUserIds: Array.isArray(offer?.eligibleUserIds) ? offer.eligibleUserIds : [],
  excludedUserIds: Array.isArray(offer?.excludedUserIds) ? offer.excludedUserIds : [],
  startDate: offer?.startDate || '',
  endDate: offer?.endDate || '',
  startTime: offer?.startTime || '00:00:00',
  endTime: offer?.endTime || '23:59:59',
});

const kolkataNow = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
};

const displayState = offer => {
  if (offer?.paused) return 'PAUSED';
  const now = kolkataNow();
  const start = offer?.startDate
    ? `${offer.startDate}T${offer.startTime || '00:00:00'}`
    : null;
  const end = offer?.endDate
    ? `${offer.endDate}T${offer.endTime || '23:59:59'}`
    : null;
  if (offer?.expired || offer?.status === 'EXPIRE' || (end && end < now)) return 'EXPIRED';
  if (offer?.status === 'ACTIVE' && start && start > now) return 'SCHEDULED';
  return offer?.status === 'ACTIVE' ? 'ACTIVE' : 'EXPIRED';
};

const stateTone = state => ({
  ACTIVE: { backgroundColor: '#DCFCE7', color: '#166534' },
  SCHEDULED: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  PAUSED: { backgroundColor: '#FEF3C7', color: '#92400E' },
  EXPIRED: { backgroundColor: '#FEE2E2', color: '#991B1B' },
}[state]);

const formatHood = (offer, hoods) => {
  if (!offer?.applicableHoodId && !offer?.applicableHoodCode) return 'All hoods';
  const hood = hoods.find(
    item =>
      item.id === offer.applicableHoodId ||
      item.hoodCode === offer.applicableHoodCode,
  );
  if (hood) return `${hood.name}${hood.hoodCode ? ` · ${hood.hoodCode}` : ''}`;
  return offer.applicableHoodCode || offer.applicableHoodId;
};

const Toggle = ({ label, description, value, onChange, disabled = false }) => (
  <View style={styles.toggleRow}>
    <View style={styles.toggleCopy}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {!!description && <Text style={styles.toggleDescription}>{description}</Text>}
    </View>
    <TouchableOpacity
      accessibilityRole="switch"
      accessibilityState={{ checked: Boolean(value), disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={[styles.toggleTrack, value ? styles.toggleOn : styles.toggleOff]}
    >
      <View style={[styles.toggleThumb, value ? styles.thumbRight : styles.thumbLeft]} />
    </TouchableOpacity>
  </View>
);

const Segmented = ({ values, value, onChange, labelFor = item => item }) => (
  <View style={styles.segmented}>
    {values.map(item => (
      <TouchableOpacity
        key={String(item)}
        onPress={() => onChange(item)}
        style={[styles.segment, value === item && styles.segmentActive]}
      >
        <Text style={[styles.segmentText, value === item && styles.segmentTextActive]}>
          {labelFor(item)}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const UserPicker = ({ label, help, values, onChange }) => {
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addUser = async () => {
    if (!/^\d{10}$/.test(mobile)) {
      setError('Enter a 10 digit mobile number.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const user = await validateUserByMobile(mobile);
      const userId = user?.id || user?.userId;
      if (!userId) {
        setError('No user was found for this mobile number.');
        return;
      }
      if (!values.includes(userId)) onChange([...values, userId]);
      setMobile('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.userPicker}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.helpText}>{help}</Text>
      <View style={styles.userInputRow}>
        <TextInput
          value={mobile}
          onChangeText={setMobile}
          keyboardType="number-pad"
          maxLength={10}
          placeholder="User mobile number"
          style={[styles.input, styles.userInput]}
        />
        <TouchableOpacity disabled={loading} onPress={addUser} style={styles.secondaryButton}>
          {loading ? (
            <ActivityIndicator size="small" color={THEME.colors.primary} />
          ) : (
            <Text style={styles.secondaryButtonText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>
      {!!error && <Text style={styles.inlineError}>{error}</Text>}
      <View style={styles.chipWrap}>
        {values.map(userId => (
          <TouchableOpacity
            key={userId}
            onPress={() => onChange(values.filter(item => item !== userId))}
            style={styles.idChip}
          >
            <Text numberOfLines={1} style={styles.idChipText}>{userId}</Text>
            <Ionicons name="close" size={14} color={THEME.colors.primary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const Kpi = ({ label, value, tone = 'primary' }) => (
  <View style={styles.kpi}>
    <Text style={[styles.kpiValue, tone === 'success' && styles.kpiSuccess]}>{value}</Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
);

export default function LoyaltyOffers() {
  const router = useRouter();
  const [offers, setOffers] = useState([]);
  const [hoods, setHoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [editor, setEditor] = useState(null);
  const [editingOffer, setEditingOffer] = useState(null);
  const [formError, setFormError] = useState('');
  const [report, setReport] = useState(null);
  const [reportOffer, setReportOffer] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      const [offerData, hoodData, user] = await Promise.all([
        fetchLoyaltyOffers(),
        fetchHoods({ includeInactive: true }),
        getUser(),
      ]);
      const roleState = extractRoles(user);
      setCanManage(
        roleState.roles.includes('SUPER_ADMIN') ||
          roleState.roles.includes('CLUSTER_ADMIN'),
      );
      setOffers(normalizeOffers(offerData));
      setHoods(Array.isArray(hoodData) ? hoodData : []);
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedHood = useMemo(
    () => hoods.find(
      hood =>
        hood.id === editor?.applicableHoodId ||
        hood.hoodCode === editor?.applicableHoodCode,
    ),
    [editor?.applicableHoodCode, editor?.applicableHoodId, hoods],
  );

  const change = (field, value) => {
    setEditor(current => ({ ...current, [field]: value }));
    setFormError('');
  };

  const openCreate = () => {
    setEditingOffer(null);
    setEditor({ ...EMPTY_FORM });
    setFormError('');
  };

  const openEdit = offer => {
    setEditingOffer(offer);
    setEditor(offerToForm(offer));
    setFormError('');
  };

  const validate = () => {
    if (!editor.title.trim() || !editor.displayTitle.trim() || !editor.code.trim()) {
      return 'Operational title, display title and code are required.';
    }
    if (!Number.isFinite(Number(editor.value)) || Number(editor.value) <= 0) {
      return 'Discount value must be greater than zero.';
    }
    if (editor.maxValue !== '' && (!Number.isFinite(Number(editor.maxValue)) || Number(editor.maxValue) <= 0)) {
      return 'Maximum value must be greater than zero when supplied.';
    }
    if (editor.maxUsage !== '' && (!Number.isInteger(Number(editor.maxUsage)) || Number(editor.maxUsage) <= 0)) {
      return 'Maximum usage must be a positive whole number.';
    }
    if (editor.perGuestMax !== '' && (!Number.isInteger(Number(editor.perGuestMax)) || Number(editor.perGuestMax) <= 0)) {
      return 'Per guest maximum must be a positive whole number.';
    }
    if (editor.startDate && !isValidDate(editor.startDate)) {
      return 'Start date must use YYYY-MM-DD.';
    }
    if (editor.endDate && !isValidDate(editor.endDate)) {
      return 'End date must use YYYY-MM-DD.';
    }
    if (editor.startDate && editor.endDate && editor.endDate < editor.startDate) {
      return 'End date cannot be before start date.';
    }
    if (editor.startTime && !isValidTime(editor.startTime)) {
      return 'Start time must use HH:mm or HH:mm:ss.';
    }
    if (editor.endTime && !isValidTime(editor.endTime)) {
      return 'End time must use HH:mm or HH:mm:ss.';
    }
    if ((editor.applicableHoodId || editor.applicableHoodCode) && !selectedHood) {
      return 'The selected hood is no longer available. Choose another hood.';
    }
    if (editor.applicableHoodId && editor.applicableHoodCode) {
      const hoodById = hoods.find(hood => hood.id === editor.applicableHoodId);
      const hoodByCode = hoods.find(hood => hood.hoodCode === editor.applicableHoodCode);
      if (!hoodById || !hoodByCode || hoodById.id !== hoodByCode.id) {
        return 'The offer hood ID and hood code do not identify the same hood. Choose the hood again.';
      }
    }
    return '';
  };

  const saveOffer = async () => {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const payload = {
      title: editor.title.trim(),
      displayTitle: editor.displayTitle.trim(),
      code: editor.code.trim().toUpperCase(),
      value: Number(editor.value),
      pointUnit: editor.pointUnit,
      maxValue: toNullableNumber(editor.maxValue),
      maxUsage: toNullableNumber(editor.maxUsage),
      perGuestMax: toNullableNumber(editor.perGuestMax),
      existingUser: editor.existingUser,
      applicableHoodId: selectedHood?.id || null,
      applicableHoodCode: selectedHood?.hoodCode || null,
      startDate: editor.startDate || null,
      endDate: editor.endDate || null,
      startTime: toApiTime(editor.startTime),
      endTime: toApiTime(editor.endTime),
      applicableWeekdays: editor.applicableWeekdays,
      eligibleUserIds: editor.eligibleUserIds,
      excludedUserIds: editor.excludedUserIds,
      status: editor.status,
      paused: Boolean(editor.paused),
      expired: Boolean(editor.expired),
      promo: Boolean(editor.promo),
      privateReward: Boolean(editor.privateReward),
      rewardTrigger: editor.rewardTrigger,
    };
    try {
      setSaving(true);
      if (editingOffer) await updateLoyaltyOffer(editingOffer.id, payload);
      else await createLoyaltyOffer(payload);
      setEditor(null);
      setEditingOffer(null);
      setToast({
        visible: true,
        message: editingOffer ? 'Offer updated successfully' : 'Offer created successfully',
        type: 'success',
      });
      await loadData();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async offer => {
    try {
      setActionId(offer.id);
      await setLoyaltyOfferPaused(offer.id, !offer.paused);
      setToast({
        visible: true,
        message: offer.paused ? 'Offer resumed' : 'Offer paused',
        type: 'success',
      });
      await loadData();
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const activateOffer = async offer => {
    try {
      setActionId(offer.id);
      await activateLoyaltyOffer(offer.id);
      setToast({ visible: true, message: 'Offer activated', type: 'success' });
      await loadData();
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const openReport = async offer => {
    try {
      setReportOffer(offer);
      setReport(null);
      setReportLoading(true);
      setReport(await fetchLoyaltyOfferReport(offer.id));
    } catch (error) {
      setReportOffer(null);
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setReportLoading(false);
    }
  };

  const input = (label, field, options = {}) => (
    <View style={[styles.field, options.half && styles.halfField]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={editor?.[field] == null ? '' : String(editor[field])}
        onChangeText={value => change(field, options.uppercase ? value.toUpperCase() : value)}
        placeholder={options.placeholder || label}
        keyboardType={options.numeric ? 'decimal-pad' : 'default'}
        autoCapitalize={options.uppercase ? 'characters' : 'sentences'}
        style={styles.input}
      />
      {!!options.help && <Text style={styles.helpText}>{options.help}</Text>}
    </View>
  );

  const conversion = report?.couponsIssued
    ? `${((Number(report.couponsRedeemed || 0) / Number(report.couponsIssued)) * 100).toFixed(1)}%`
    : '0.0%';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(current => ({ ...current, visible: false }))}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/admin-settings')} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Loyalty Offers</Text>
          <Text style={styles.subtitle}>Offer configuration and coupon performance</Text>
        </View>
        {canManage ? (
          <TouchableOpacity onPress={openCreate} style={styles.addButton}>
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.addButtonText}>Offer</Text>
          </TouchableOpacity>
        ) : <View style={styles.headerSpacer} />}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={THEME.colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
        >
          <Text style={styles.intro}>
            Offers are editable templates. Coupons already issued to customers keep their original value, cap, hood and expiry snapshot.
          </Text>
          {!offers.length ? (
            <View style={styles.empty}>
              <Ionicons name="gift-outline" size={42} color={THEME.colors.textMuted} />
              <Text style={styles.emptyTitle}>No loyalty offers</Text>
              <Text style={styles.emptyText}>Create an all-hood or hood-specific offer to get started.</Text>
            </View>
          ) : offers.map(offer => {
            const state = displayState(offer);
            const tone = stateTone(state);
            const busy = actionId === offer.id;
            return (
              <View key={offer.id || offer.code} style={styles.offerCard}>
                <View style={styles.offerTop}>
                  <View style={styles.offerIcon}><Ionicons name="gift-outline" size={22} color={THEME.colors.primary} /></View>
                  <View style={styles.offerCopy}>
                    <Text style={styles.offerTitle}>{offer.displayTitle || offer.title}</Text>
                    <Text style={styles.offerOperational}>{offer.title} · {offer.code}</Text>
                  </View>
                  <View style={[styles.stateBadge, { backgroundColor: tone.backgroundColor }]}>
                    <Text style={[styles.stateText, { color: tone.color }]}>{state}</Text>
                  </View>
                </View>
                <View style={styles.offerFacts}>
                  <Text style={styles.offerFact}>
                    {offer.pointUnit === 'PER' ? `${Number(offer.value)}%` : `₹${Number(offer.value).toFixed(2)}`}
                    {offer.pointUnit === 'PER' && offer.maxValue != null ? ` · Up to ₹${Number(offer.maxValue).toFixed(2)}` : ''}
                  </Text>
                  <Text style={styles.offerFact}>{formatHood(offer, hoods)}</Text>
                  <Text style={styles.offerFact}>
                    {offer.startDate || 'No start'} → {offer.endDate || 'No end'}
                  </Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openReport(offer)} style={styles.cardAction}>
                    <Ionicons name="stats-chart-outline" size={17} color={THEME.colors.primary} />
                    <Text style={styles.cardActionText}>Report</Text>
                  </TouchableOpacity>
                  {canManage && (
                    <>
                      <TouchableOpacity onPress={() => openEdit(offer)} style={styles.cardAction}>
                        <Ionicons name="create-outline" size={17} color={THEME.colors.primary} />
                        <Text style={styles.cardActionText}>Edit</Text>
                      </TouchableOpacity>
                      {state === 'EXPIRED' ? (
                        <TouchableOpacity disabled={busy} onPress={() => activateOffer(offer)} style={styles.cardAction}>
                          <Ionicons name="play-outline" size={17} color={THEME.colors.primary} />
                          <Text style={styles.cardActionText}>{busy ? 'Working…' : 'Activate'}</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity disabled={busy} onPress={() => togglePause(offer)} style={styles.cardAction}>
                          <Ionicons name={offer.paused ? 'play-outline' : 'pause-outline'} size={17} color={THEME.colors.primary} />
                          <Text style={styles.cardActionText}>{busy ? 'Working…' : offer.paused ? 'Resume' : 'Pause'}</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={Boolean(editor)} animationType="slide" onRequestClose={() => setEditor(null)}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setEditor(null)} style={styles.iconButton}>
              <Ionicons name="close" size={25} color={THEME.colors.text} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{editingOffer ? 'Edit Offer' : 'Create Offer'}</Text>
              <Text style={styles.subtitle}>Times are evaluated in Asia/Kolkata</Text>
            </View>
            <TouchableOpacity disabled={saving} onPress={saveOffer} style={styles.saveHeaderButton}>
              <Text style={styles.saveHeaderText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionTitle}>Identity</Text>
            <View style={styles.sectionCard}>
              {input('Operational title', 'title', { placeholder: 'HSR weekday launch offer' })}
              {input('Customer display title', 'displayTitle', { placeholder: 'Save 20% in HSR' })}
              {input('Offer code', 'code', { placeholder: 'HSR20', uppercase: true, help: 'Issued coupons receive their own immutable coupon code.' })}
            </View>

            <Text style={styles.sectionTitle}>Discount</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.label}>Calculation mode</Text>
              <Segmented values={['PER', 'ABS']} value={editor?.pointUnit} onChange={value => change('pointUnit', value)} labelFor={value => value === 'PER' ? 'Percentage' : 'Fixed amount'} />
              <View style={styles.fieldRow}>
                {input(editor?.pointUnit === 'PER' ? 'Percentage' : 'Amount', 'value', { numeric: true, half: true })}
                {input('Maximum discount', 'maxValue', { numeric: true, half: true, help: editor?.pointUnit === 'PER' ? 'Optional cap' : 'Usually blank for fixed discounts' })}
              </View>
            </View>

            <Text style={styles.sectionTitle}>Usage policy</Text>
            <View style={styles.sectionCard}>
              <View style={styles.fieldRow}>
                {input('Maximum uses', 'maxUsage', { numeric: true, half: true, placeholder: 'Unlimited' })}
                {input('Per guest maximum', 'perGuestMax', { numeric: true, half: true })}
              </View>
              <Text style={styles.label}>Customer type</Text>
              <Segmented
                values={['ALL', 'EXISTING', 'NEW']}
                value={editor?.existingUser == null ? 'ALL' : editor.existingUser ? 'EXISTING' : 'NEW'}
                onChange={value => change('existingUser', value === 'ALL' ? null : value === 'EXISTING')}
                labelFor={value => ({ ALL: 'All', EXISTING: 'Existing only', NEW: 'New only' }[value])}
              />
            </View>

            <Text style={styles.sectionTitle}>Hood targeting</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.helpText}>Selecting a hood sends its matching backend ID and business code. Leave all unselected for an all-hood offer.</Text>
              <View style={styles.chipWrap}>
                <TouchableOpacity
                  onPress={() => {
                    change('applicableHoodId', null);
                    change('applicableHoodCode', null);
                  }}
                  style={[styles.choiceChip, !selectedHood && styles.choiceChipActive]}
                >
                  <Text style={[styles.choiceChipText, !selectedHood && styles.choiceChipTextActive]}>All hoods</Text>
                </TouchableOpacity>
                {hoods.map(hood => (
                  <TouchableOpacity
                    key={hood.id}
                    onPress={() => {
                      change('applicableHoodId', hood.id);
                      change('applicableHoodCode', hood.hoodCode || null);
                    }}
                    style={[styles.choiceChip, selectedHood?.id === hood.id && styles.choiceChipActive]}
                  >
                    <Text style={[styles.choiceChipText, selectedHood?.id === hood.id && styles.choiceChipTextActive]}>
                      {hood.name}{hood.hoodCode ? ` · ${hood.hoodCode}` : ''}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={styles.sectionTitle}>Schedule</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.helpText}>Future ACTIVE offers appear as Scheduled in this admin list; their backend status remains ACTIVE. End time may be earlier than start time for overnight windows.</Text>
              <View style={styles.fieldRow}>
                {input('Start date', 'startDate', { half: true, placeholder: 'YYYY-MM-DD' })}
                {input('End date', 'endDate', { half: true, placeholder: 'YYYY-MM-DD' })}
              </View>
              <View style={styles.fieldRow}>
                {input('Start time', 'startTime', { half: true, placeholder: 'HH:mm:ss' })}
                {input('End time', 'endTime', { half: true, placeholder: 'HH:mm:ss' })}
              </View>
              <Text style={styles.label}>Applicable weekdays</Text>
              <Text style={styles.helpText}>No selection means every day.</Text>
              <View style={styles.chipWrap}>
                {WEEKDAYS.map(day => {
                  const selected = editor?.applicableWeekdays.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => change('applicableWeekdays', selected ? editor.applicableWeekdays.filter(item => item !== day) : [...editor.applicableWeekdays, day])}
                      style={[styles.choiceChip, selected && styles.choiceChipActive]}
                    >
                      <Text style={[styles.choiceChipText, selected && styles.choiceChipTextActive]}>{day.slice(0, 3)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <Text style={styles.sectionTitle}>User targeting</Text>
            <View style={styles.sectionCard}>
              <UserPicker label="Eligible users" help="Leave empty to allow every otherwise eligible user." values={editor?.eligibleUserIds || []} onChange={value => change('eligibleUserIds', value)} />
              <UserPicker label="Excluded users" help="Exclusion always wins when a user appears in both lists." values={editor?.excludedUserIds || []} onChange={value => change('excludedUserIds', value)} />
            </View>

            <Text style={styles.sectionTitle}>Lifecycle</Text>
            <View style={styles.sectionCard}>
              <Text style={styles.label}>Backend status</Text>
              <Segmented values={['ACTIVE', 'EXPIRE']} value={editor?.status} onChange={value => change('status', value)} />
              <Toggle label="Paused" description="Temporarily stop the offer without changing its backend status." value={editor?.paused} onChange={value => change('paused', value)} />
              <Toggle label="Explicitly expired" description="Advanced hard-expiry flag." value={editor?.expired} onChange={value => change('expired', value)} />
              <Toggle label="Promotional offer" value={editor?.promo} onChange={value => change('promo', value)} />
              <Toggle label="Private reward" value={editor?.privateReward} onChange={value => change('privateReward', value)} />
              <Text style={styles.label}>Referral trigger</Text>
              <Segmented values={['NONE', 'REFERRER_SIGNUP', 'REFERRED_FIRST_BOOKING']} value={editor?.rewardTrigger} onChange={value => change('rewardTrigger', value)} labelFor={value => ({ NONE: 'None', REFERRER_SIGNUP: 'Referrer signup', REFERRED_FIRST_BOOKING: 'First booking' }[value])} />
            </View>

            {!!formError && <Text style={styles.formError}>{formError}</Text>}
            <TouchableOpacity disabled={saving} onPress={saveOffer} style={styles.primaryButton}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryButtonText}>Save offer</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={Boolean(reportOffer)} transparent animationType="fade" onRequestClose={() => setReportOffer(null)}>
        <View style={styles.overlay}>
          <View style={styles.reportModal}>
            <View style={styles.reportHeader}>
              <View style={styles.reportHeaderCopy}>
                <Text style={styles.reportTitle}>Coupon performance</Text>
                <Text style={styles.reportSubtitle}>{reportOffer?.displayTitle || reportOffer?.title}</Text>
              </View>
              <TouchableOpacity onPress={() => setReportOffer(null)} style={styles.iconButton}>
                <Ionicons name="close" size={24} color={THEME.colors.text} />
              </TouchableOpacity>
            </View>
            {reportLoading ? (
              <ActivityIndicator style={styles.reportLoader} color={THEME.colors.primary} />
            ) : report ? (
              <ScrollView contentContainerStyle={styles.reportContent}>
                <Text style={styles.reportSectionLabel}>Coupon funnel</Text>
                <View style={styles.kpiGrid}>
                  <Kpi label="Issued" value={Number(report.couponsIssued || 0).toLocaleString()} />
                  <Kpi label="Redeemed" value={Number(report.couponsRedeemed || 0).toLocaleString()} tone="success" />
                  <Kpi label="Expired" value={Number(report.couponsExpired || 0).toLocaleString()} />
                  <Kpi label="Conversion" value={conversion} tone="success" />
                </View>
                <Text style={styles.reportNote}>Expired uses the backend count directly; it is not derived from issued minus redeemed.</Text>
                <Text style={styles.reportSectionLabel}>Redemption diagnostics</Text>
                <View style={styles.diagnosticList}>
                  {[
                    ['Reserved', report.reserved],
                    ['Consumed', report.consumed],
                    ['Released', report.released],
                    ['Legacy rewards granted', report.rewardsGranted],
                    ['Legacy rewards redeemed', report.rewardsRedeemed],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.diagnosticRow}>
                      <Text style={styles.diagnosticLabel}>{label}</Text>
                      <Text style={styles.diagnosticValue}>{Number(value || 0).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { minHeight: 68, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 8 },
  headerCopy: { flex: 1, marginHorizontal: 6 },
  title: { color: THEME.colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { marginTop: 2, color: THEME.colors.textSecondary, fontSize: 11 },
  headerSpacer: { width: 58 },
  addButton: { minHeight: 40, paddingHorizontal: 13, borderRadius: 11, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addButtonText: { color: '#FFF', fontWeight: '800' },
  saveHeaderButton: { minHeight: 39, paddingHorizontal: 15, borderRadius: 10, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveHeaderText: { color: '#FFF', fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 16, paddingBottom: 44 },
  intro: { marginBottom: 16, color: THEME.colors.textSecondary, lineHeight: 21 },
  empty: { padding: 34, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center' },
  emptyTitle: { marginTop: 10, color: THEME.colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { marginTop: 6, color: THEME.colors.textSecondary, textAlign: 'center' },
  offerCard: { marginBottom: 12, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF' },
  offerTop: { flexDirection: 'row', alignItems: 'center' },
  offerIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#EFE3D8', alignItems: 'center', justifyContent: 'center' },
  offerCopy: { flex: 1, marginHorizontal: 11 },
  offerTitle: { color: THEME.colors.text, fontSize: 16, fontWeight: '800' },
  offerOperational: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 11 },
  stateBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  stateText: { fontSize: 9, fontWeight: '900' },
  offerFacts: { marginTop: 13, padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  offerFact: { color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  cardActions: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: THEME.colors.divider, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  cardAction: { minHeight: 36, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#EFE3D8', flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardActionText: { color: THEME.colors.primary, fontSize: 11, fontWeight: '800' },
  editorContent: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 16, paddingBottom: 50 },
  sectionTitle: { marginTop: 11, marginBottom: 8, color: THEME.colors.text, fontSize: 17, fontWeight: '800' },
  sectionCard: { marginBottom: 9, padding: 16, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 16, backgroundColor: '#FFF' },
  field: { width: '100%', marginBottom: 13 },
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  halfField: { flex: 1, minWidth: 145 },
  label: { marginBottom: 6, color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 47, paddingHorizontal: 13, borderWidth: 1, borderColor: '#DDE2E8', borderRadius: 11, backgroundColor: '#FFF', color: THEME.colors.text },
  helpText: { marginTop: 5, marginBottom: 8, color: THEME.colors.textMuted, fontSize: 10, lineHeight: 15 },
  segmented: { marginBottom: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  segment: { minHeight: 39, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { borderColor: THEME.colors.primary, backgroundColor: '#EFE3D8' },
  segmentText: { color: THEME.colors.textSecondary, fontSize: 10, fontWeight: '800' },
  segmentTextActive: { color: THEME.colors.primary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choiceChip: { minHeight: 35, maxWidth: '100%', paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: THEME.colors.border, alignItems: 'center', justifyContent: 'center' },
  choiceChipActive: { borderColor: THEME.colors.primary, backgroundColor: '#EFE3D8' },
  choiceChipText: { color: THEME.colors.textSecondary, fontSize: 10, fontWeight: '700' },
  choiceChipTextActive: { color: THEME.colors.primary },
  toggleRow: { minHeight: 65, paddingVertical: 10, borderTopWidth: 1, borderTopColor: THEME.colors.divider, flexDirection: 'row', alignItems: 'center' },
  toggleCopy: { flex: 1, paddingRight: 12 },
  toggleLabel: { color: THEME.colors.text, fontWeight: '800' },
  toggleDescription: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 10, lineHeight: 14 },
  toggleTrack: { width: 46, height: 26, padding: 3, borderRadius: 13, justifyContent: 'center' },
  toggleOn: { backgroundColor: THEME.colors.primary },
  toggleOff: { backgroundColor: '#D1D5DB' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  thumbLeft: { alignSelf: 'flex-start' },
  thumbRight: { alignSelf: 'flex-end' },
  userPicker: { marginBottom: 17 },
  userInputRow: { flexDirection: 'row', gap: 8 },
  userInput: { flex: 1 },
  secondaryButton: { width: 68, minHeight: 47, borderRadius: 11, borderWidth: 1, borderColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: THEME.colors.primary, fontWeight: '800' },
  inlineError: { marginTop: 5, marginBottom: 5, color: THEME.colors.error, fontSize: 11 },
  idChip: { maxWidth: '100%', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EFE3D8', flexDirection: 'row', alignItems: 'center', gap: 5 },
  idChipText: { maxWidth: 260, color: THEME.colors.primary, fontSize: 9, fontWeight: '700' },
  formError: { marginTop: 12, padding: 12, borderRadius: 11, backgroundColor: '#FEF2F2', color: THEME.colors.error, lineHeight: 19 },
  primaryButton: { minHeight: 50, marginTop: 14, borderRadius: 13, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFF', fontWeight: '800' },
  overlay: { flex: 1, padding: 18, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center' },
  reportModal: { width: '100%', maxWidth: 620, maxHeight: '88%', borderRadius: 20, backgroundColor: '#FFF', overflow: 'hidden', ...Platform.select({ web: { boxShadow: '0 18px 60px rgba(0,0,0,0.18)' } }) },
  reportHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center' },
  reportHeaderCopy: { flex: 1 },
  reportTitle: { color: THEME.colors.text, fontSize: 19, fontWeight: '800' },
  reportSubtitle: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 11 },
  reportLoader: { marginVertical: 60 },
  reportContent: { padding: 17, paddingBottom: 25 },
  reportSectionLabel: { marginBottom: 9, color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  kpi: { flexGrow: 1, flexBasis: 120, minHeight: 90, padding: 14, borderRadius: 14, backgroundColor: '#F8FAFC', justifyContent: 'center' },
  kpiValue: { color: THEME.colors.primary, fontSize: 24, fontWeight: '900' },
  kpiSuccess: { color: THEME.colors.success },
  kpiLabel: { marginTop: 5, color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  reportNote: { marginVertical: 15, color: THEME.colors.textMuted, fontSize: 10, lineHeight: 15 },
  diagnosticList: { borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 13, overflow: 'hidden' },
  diagnosticRow: { minHeight: 43, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: THEME.colors.divider, flexDirection: 'row', alignItems: 'center' },
  diagnosticLabel: { flex: 1, color: THEME.colors.textSecondary, fontSize: 12 },
  diagnosticValue: { color: THEME.colors.text, fontWeight: '900' },
});
