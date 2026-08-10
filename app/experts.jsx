import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import THEME from '../constants/theme';
import { formatTime12Hour } from '../utils/helpers';
import {
  createHoodUser,
  createAdminUser,
  deleteHoodUser,
  fetchCategories,
  fetchHoodDetails,
  fetchHoodExperts,
  fetchHoods,
  fetchSubcategories,
  getErrorMessage,
  updateHoodUser,
  updateHoodUserStatus,
} from '../services/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_HOURS = DAYS.map((_, index) => ({
  dayOfWeek: index + 1,
  isClosed: false,
  workStartTime: '09:00:00',
  workEndTime: '18:00:00',
}));

const normalizeHoodHours = hood =>
  DAYS.map((_, index) => {
    const dayOfWeek = index + 1;
    const saved = (
      hood?.hoodOperatingHours ||
      hood?.operatingHours ||
      []
    ).find(
      day => Number(day.dayOfWeek) === dayOfWeek,
    );
    if (!saved) return { ...DEFAULT_HOURS[index] };
    return {
      dayOfWeek,
      isClosed: Boolean(saved.isClosed),
      workStartTime: saved.isClosed ? null : saved.openTime || '09:00:00',
      workEndTime: saved.isClosed ? null : saved.closeTime || '18:00:00',
    };
  });

const emptyDraft = (hoodId, defaultHours = DEFAULT_HOURS) => ({
  hoodId,
  userId: '',
  name: '',
  mobileNumber: '',
  countryCode: '91',
  dob: '',
  role: 'EXPERT',
  status: 'ACTIVE',
  expertises: [],
  workingHours: defaultHours.map(day => ({ ...day })),
});

const normalizeExpert = (expert, fallbackHoodId, defaultHours = DEFAULT_HOURS) => ({
  hoodId: expert.hoodId || fallbackHoodId,
  userId: expert.userId || expert.id || '',
  role: expert.role || 'EXPERT',
  status: expert.status || 'ACTIVE',
  expertises: (expert.expertises || expert.expertiseList || []).map(item => ({
    categoryId: item.categoryId || '',
    subcategoryId: item.subcategoryId || '',
  })),
  workingHours: DAYS.map((_, index) => {
    const sourceHours =
      expert.workingHours ||
      expert.hoodUserWorkingHours ||
      expert.expertWorkingHours ||
      [];
    const saved = sourceHours.find(item => Number(item.dayOfWeek) === index + 1);
    return saved
      ? {
          dayOfWeek: index + 1,
          isClosed: Boolean(saved.isClosed),
          workStartTime:
            saved.isClosed
              ? null
              : saved.workStartTime || defaultHours[index]?.workStartTime || '09:00:00',
          workEndTime:
            saved.isClosed
              ? null
              : saved.workEndTime || defaultHours[index]?.workEndTime || '18:00:00',
        }
      : { ...(defaultHours[index] || DEFAULT_HOURS[index]) };
  }),
});

const displayTime = value => formatTime12Hour(value);
const toApiTime = value => (value?.length === 5 ? `${value}:00` : value);

export default function Experts() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hoodId = Array.isArray(params.hoodId) ? params.hoodId[0] : params.hoodId;
  const hoodName = Array.isArray(params.hoodName) ? params.hoodName[0] : params.hoodName;
  const [experts, setExperts] = useState([]);
  const [hoods, setHoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [hoodDefaultHours, setHoodDefaultHours] = useState(
    DEFAULT_HOURS.map(day => ({ ...day })),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft(hoodId));
  const [selectedTargetHoods, setSelectedTargetHoods] = useState({});
  const [hoodPickerExpert, setHoodPickerExpert] = useState(null);
  const [deleteExpert, setDeleteExpert] = useState(null);
  const [picker, setPicker] = useState(null);
  const [dobPickerVisible, setDobPickerVisible] = useState(false);
  const [catalogPicker, setCatalogPicker] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const targetHoods = useMemo(
    () => hoods.filter(hood => hood.id !== hoodId),
    [hoods, hoodId],
  );

  const returnToSettings = () =>
    router.replace({
      pathname: '/settings',
      params: { hoodId, hoodName },
    });

  const showToast = (message, type = 'info') =>
    setToast({ visible: true, message, type });

  const loadData = useCallback(async () => {
    if (!hoodId) return;
    try {
      setLoading(true);
      const [expertData, hoodData, categoryData, subcategoryData, hoodDetails] = await Promise.all([
        fetchHoodExperts(hoodId),
        fetchHoods(),
        fetchCategories(),
        fetchSubcategories(),
        fetchHoodDetails(hoodId).catch(() => null),
      ]);
      setExperts(expertData || []);
      setHoods(hoodData || []);
      setCategories((categoryData || []).filter(item => item.status === 'ACTIVE'));
      setSubcategories((subcategoryData || []).filter(item => item.status === 'ACTIVE'));
      setHoodDefaultHours(normalizeHoodHours(hoodDetails));
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [hoodId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setEditing(false);
    setDraft(emptyDraft(hoodId, hoodDefaultHours));
    setEditorVisible(true);
  };

  const openEdit = expert => {
    setEditing(true);
    setDraft(normalizeExpert(expert, hoodId, hoodDefaultHours));
    setEditorVisible(true);
  };

  const updateExpertise = (index, field, value) => {
    setDraft(current => ({
      ...current,
      expertises: current.expertises.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value.trim() } : item,
      ),
    }));
  };

  const updateWorkingDay = async (index, changes) => {
    const previousDraft = draft;
    const nextWorkingHours = draft.workingHours.map((day, dayIndex) =>
      dayIndex === index ? { ...day, ...changes } : day,
    );
    const nextDraft = { ...draft, workingHours: nextWorkingHours };
    setDraft(nextDraft);

    if (!editing) return;

    const updatedDay = nextWorkingHours[index];
    if (
      !updatedDay.isClosed &&
      (!updatedDay.workStartTime ||
        !updatedDay.workEndTime ||
        updatedDay.workStartTime >= updatedDay.workEndTime)
    ) {
      showToast('End time must be later than start time', 'error');
      return;
    }

    try {
      setSaving(true);
      await updateHoodUser(buildPayload(nextDraft));
      showToast(`${DAYS[index]} schedule updated`, 'success');
      await loadData();
    } catch (error) {
      setDraft(previousDraft);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const validateDraft = () => {
    if (!editing) {
      if (!draft.name.trim()) return 'Expert name is required';
      if (draft.name.trim().length < 2) return 'Expert name must contain at least 2 characters';
      if (!/^\d{1,4}$/.test(draft.countryCode)) return 'Enter a valid country code';
      if (!/^\d{10}$/.test(draft.mobileNumber)) return 'Enter a valid 10-digit mobile number';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dob)) return 'Date of birth must use YYYY-MM-DD';
      const dob = new Date(`${draft.dob}T00:00:00`);
      if (Number.isNaN(dob.getTime()) || dob >= new Date()) return 'Enter a valid past date of birth';
    } else if (!draft.userId.trim()) {
      return 'This expert record is missing required account information';
    }
    if (draft.expertises.some(item => !item.categoryId || !item.subcategoryId)) {
      return 'Complete or remove the unfinished expertise';
    }
    const invalidShift = draft.workingHours.some(
      day =>
        !day.isClosed &&
        (!day.workStartTime ||
          !day.workEndTime ||
          day.workStartTime >= day.workEndTime),
    );
    return invalidShift ? 'Every open day needs a valid start and end time' : null;
  };

  const buildPayload = source => ({
    hoodId: source.hoodId,
    userId: source.userId.trim(),
    role: 'EXPERT',
    status: source.status || 'ACTIVE',
    expertises: source.expertises.map(item => ({
      categoryId: item.categoryId.trim(),
      subcategoryId: item.subcategoryId.trim(),
    })),
    workingHours: source.workingHours.map(day => ({
      dayOfWeek: day.dayOfWeek,
      isClosed: day.isClosed,
      workStartTime: day.isClosed ? null : toApiTime(day.workStartTime),
      workEndTime: day.isClosed ? null : toApiTime(day.workEndTime),
    })),
  });

  const saveExpert = async () => {
    const validationMessage = validateDraft();
    if (validationMessage) {
      showToast(validationMessage, 'error');
      return;
    }
    let createdUserId = null;
    try {
      setSaving(true);
      if (editing) {
        await updateHoodUser(buildPayload(draft));
      } else {
        const createdUser = await createAdminUser({
          mobileNumber: draft.mobileNumber,
          countryCode: draft.countryCode,
          name: draft.name.trim(),
          roles: ['EXPERT'],
          dob: draft.dob,
        });
        createdUserId =
          createdUser?.id ||
          createdUser?.userId ||
          createdUser?.user?.id ||
          createdUser?.admin?.id ||
          createdUser?.userResponse?.id ||
          createdUser?.data?.id;
        if (!createdUserId) {
          throw new Error('User was created but the API did not return a user ID');
        }
        await createHoodUser(buildPayload({ ...draft, userId: createdUserId }));
      }
      setEditorVisible(false);
      showToast(editing ? 'Expert updated successfully' : 'Expert added successfully', 'success');
      await loadData();
    } catch (error) {
      showToast(
        createdUserId
          ? `User created, but hood assignment failed: ${getErrorMessage(error)}`
          : getErrorMessage(error),
        'error',
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async expert => {
    try {
      setSaving(true);
      const context = normalizeExpert(expert, hoodId, hoodDefaultHours);
      await updateHoodUserStatus(
        context.hoodId,
        context.userId,
        context.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      );
      await loadData();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const moveExpert = async expert => {
    const expertUserId = expert?.userId || expert?.id;
    const targetHoodId = selectedTargetHoods[expertUserId];
    if (!expert || !targetHoodId) {
      showToast('Select a target hood', 'error');
      return;
    }

    const savedContext = buildPayload(normalizeExpert(expert, hoodId, hoodDefaultHours));
    const targetContext = { ...savedContext, hoodId: targetHoodId };
    let removedFromSource = false;

    try {
      setSaving(true);
      // Preserve the complete source context before performing the required
      // delete/create move. If target creation fails, restore that snapshot.
      await deleteHoodUser(savedContext.hoodId, savedContext.userId);
      removedFromSource = true;
      await createHoodUser(targetContext);
      setSelectedTargetHoods(current => {
        const updated = { ...current };
        delete updated[expertUserId];
        return updated;
      });
      showToast('Expert moved with expertise and shifts preserved', 'success');
      await loadData();
    } catch (error) {
      if (removedFromSource) {
        try {
          await createHoodUser(savedContext);
          showToast(`Move failed. Expert was restored: ${getErrorMessage(error)}`, 'error');
        } catch {
          showToast('Move failed and automatic restore failed. Please contact support.', 'error');
        }
      } else {
        showToast(getErrorMessage(error), 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const removeExpert = async () => {
    if (!deleteExpert) return;
    try {
      setSaving(true);
      await deleteHoodUser(deleteExpert.hoodId || hoodId, deleteExpert.userId);
      setDeleteExpert(null);
      showToast('Expert removed from hood', 'success');
      await loadData();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openTimePicker = (dayIndex, field) => {
    setPicker({ dayIndex, field });
  };

  const timePickerValue = () => {
    const value = draft.workingHours[picker.dayIndex][picker.field] || '09:00:00';
    const [hours, minutes] = value.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
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
        <View style={styles.headerText}>
          <Text style={styles.title}>Experts</Text>
          <Text style={styles.subtitle}>{hoodName || 'Selected hood'}</Text>
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.addButton}>
          <Ionicons name="person-add-outline" size={18} color="#FFF" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Loading experts…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {!experts.length && (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={42} color={THEME.colors.textSecondary} />
              <Text style={styles.emptyTitle}>No experts in this hood</Text>
              <Text style={styles.emptyText}>Add an expert and configure their expertise and shifts.</Text>
            </View>
          )}
          {experts.map(expert => {
            const context = normalizeExpert(expert, hoodId, hoodDefaultHours);
            const openDays = context.workingHours.filter(day => !day.isClosed).length;
            return (
              <View key={context.userId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(expert.userName || expert.name || 'E').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.cardIdentity}>
                    <Text style={styles.expertName}>{expert.userName || expert.name || 'Expert'}</Text>
                    <Text style={styles.expertMeta}>
                      {context.expertises.length} expertise · {openDays} working days
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="switch"
                    accessibilityState={{ checked: context.status === 'ACTIVE' }}
                    disabled={saving}
                    onPress={() => toggleStatus(expert)}
                    style={[
                      styles.statusPill,
                      context.status === 'ACTIVE' ? styles.activePill : styles.inactivePill,
                    ]}
                  >
                    <Text style={styles.statusText}>{context.status}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.secondaryAction} onPress={() => openEdit(expert)}>
                    <Ionicons name="create-outline" size={18} color={THEME.colors.primary} />
                    <Text style={styles.secondaryActionText}>Edit details and shifts</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteAction} onPress={() => setDeleteExpert(expert)}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.schedulePreview}
                >
                  {context.workingHours.map((day, dayIndex) => (
                    <View
                      key={day.dayOfWeek}
                      style={[styles.scheduleChip, day.isClosed && styles.scheduleChipClosed]}
                    >
                      <Text style={[styles.scheduleDay, day.isClosed && styles.scheduleTextClosed]}>
                        {DAYS[dayIndex].slice(0, 3)}
                      </Text>
                      <Text style={[styles.scheduleTime, day.isClosed && styles.scheduleTextClosed]}>
                        {day.isClosed
                          ? 'Leave'
                          : `${displayTime(day.workStartTime)}–${displayTime(day.workEndTime)}`}
                      </Text>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.transferArea}>
                  <Text style={styles.transferLabel}>Move to another hood</Text>
                  <TouchableOpacity
                    style={styles.hoodSelectButton}
                    onPress={() => setHoodPickerExpert(expert)}
                  >
                    <Text
                      style={
                        selectedTargetHoods[context.userId]
                          ? styles.catalogValue
                          : styles.catalogPlaceholder
                      }
                    >
                      {hoods.find(hood => hood.id === selectedTargetHoods[context.userId])?.name ||
                        'Select target hood'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={THEME.colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={!selectedTargetHoods[context.userId] || saving}
                    style={[
                      styles.transferButton,
                      (!selectedTargetHoods[context.userId] || saving) && styles.disabledButton,
                    ]}
                    onPress={() => moveExpert(expert)}
                  >
                    <Ionicons name="swap-horizontal" size={19} color="#FFF" />
                    <Text style={styles.transferButtonText}>
                      {saving ? 'Transferring…' : 'Transfer Expert'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={editorVisible} animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <SafeAreaView style={styles.editor}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditorVisible(false)} style={styles.iconButton}>
              <Ionicons name="close" size={25} color={THEME.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editing ? 'Edit expert' : 'Add expert'}</Text>
            <TouchableOpacity disabled={saving} onPress={saveExpert}>
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form}>
            {!editing && (
              <>
                <Text style={styles.label}>Expert name</Text>
                <TextInput
                  value={draft.name}
                  onChangeText={name => setDraft(current => ({ ...current, name }))}
                  placeholder="Full name"
                  style={styles.input}
                />
                <Text style={styles.label}>Mobile number</Text>
                <View style={styles.phoneRow}>
                  <TextInput
                    keyboardType="phone-pad"
                    value={draft.countryCode}
                    onChangeText={countryCode =>
                      setDraft(current => ({
                        ...current,
                        countryCode: countryCode.replace(/\D/g, '').slice(0, 4),
                      }))
                    }
                    placeholder="91"
                    style={[styles.input, styles.countryCodeInput]}
                  />
                  <TextInput
                    keyboardType="phone-pad"
                    value={draft.mobileNumber}
                    onChangeText={mobileNumber =>
                      setDraft(current => ({
                        ...current,
                        mobileNumber: mobileNumber.replace(/\D/g, '').slice(0, 10),
                      }))
                    }
                    placeholder="10-digit mobile number"
                    style={[styles.input, styles.mobileInput]}
                  />
                </View>
                <Text style={styles.label}>Date of birth</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={draft.dob}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={event =>
                      setDraft(current => ({ ...current, dob: event.target.value }))
                    }
                    style={styles.webDateInput}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.dateSelectButton}
                    onPress={() => setDobPickerVisible(true)}
                  >
                    <Ionicons name="calendar-outline" size={19} color={THEME.colors.primary} />
                    <Text style={draft.dob ? styles.catalogValue : styles.catalogPlaceholder}>
                      {draft.dob || 'Select date of birth'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={THEME.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </>
            )}

            <Text style={styles.sectionTitle}>Expertise (optional)</Text>
            <Text style={styles.optionalHelp}>
              You can add category expertise now or configure it later.
            </Text>
            {draft.expertises.map((item, index) => (
              <View key={index} style={styles.expertiseCard}>
                <TouchableOpacity
                  style={styles.catalogSelect}
                  onPress={() => setCatalogPicker({ type: 'category', index })}
                >
                  <Text style={item.categoryId ? styles.catalogValue : styles.catalogPlaceholder}>
                    {categories.find(category => category.id === item.categoryId)?.name || 'Select category'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={THEME.colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={!item.categoryId}
                  style={[styles.catalogSelect, !item.categoryId && styles.disabledInput]}
                  onPress={() => setCatalogPicker({ type: 'subcategory', index })}
                >
                  <Text style={item.subcategoryId ? styles.catalogValue : styles.catalogPlaceholder}>
                    {subcategories.find(subcategory => subcategory.id === item.subcategoryId)?.name ||
                      'Select subcategory'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={THEME.colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    setDraft(current => ({
                      ...current,
                      expertises: current.expertises.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  <Text style={styles.removeText}>Remove expertise</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addExpertise}
              onPress={() =>
                setDraft(current => ({
                  ...current,
                  expertises: [...current.expertises, { categoryId: '', subcategoryId: '' }],
                }))
              }
            >
              <Ionicons name="add-circle-outline" size={18} color={THEME.colors.primary} />
              <Text style={styles.addExpertiseText}>Add another expertise</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Working hours</Text>
            {editing && (
              <View style={styles.autoSaveNote}>
                <Ionicons name="cloud-done-outline" size={18} color="#166534" />
                <Text style={styles.autoSaveNoteText}>
                  Shift time and availability changes are saved automatically.
                </Text>
              </View>
            )}
            <View style={styles.availabilityNote}>
              <Ionicons name="information-circle-outline" size={18} color={THEME.colors.primary} />
              <Text style={styles.availabilityNoteText}>
                Mark a day as on leave when the expert is unavailable. Shift times will not be sent for that day.
              </Text>
            </View>
            {draft.workingHours.map((day, index) => (
              <View key={day.dayOfWeek} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayName}>{DAYS[index]}</Text>
                  <TouchableOpacity
                    accessibilityRole="switch"
                    accessibilityState={{ checked: !day.isClosed }}
                    accessibilityLabel={`${DAYS[index]} availability`}
                    accessibilityHint="Switch between available and on leave"
                    activeOpacity={0.85}
                    onPress={() =>
                      updateWorkingDay(index, {
                        isClosed: !day.isClosed,
                        workStartTime: day.isClosed
                          ? hoodDefaultHours[index]?.workStartTime || '09:00:00'
                          : null,
                        workEndTime: day.isClosed
                          ? hoodDefaultHours[index]?.workEndTime || '18:00:00'
                          : null,
                      })
                    }
                    style={styles.availabilityControl}
                  >
                    <Text
                      style={[
                        styles.availabilityLabel,
                        day.isClosed ? styles.leaveLabel : styles.availableLabel,
                      ]}
                    >
                      {day.isClosed ? 'On leave' : 'Available'}
                    </Text>
                    <View
                      style={[
                        styles.availabilityTrack,
                        day.isClosed ? styles.leaveTrack : styles.availableTrack,
                      ]}
                    >
                      <View
                        style={[
                          styles.availabilityThumb,
                          day.isClosed ? styles.thumbLeft : styles.thumbRight,
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
                {!day.isClosed && (
                  <View style={styles.timeRow}>
                    {['workStartTime', 'workEndTime'].map(field =>
                      Platform.OS === 'web' ? (
                        <input
                          key={field}
                          type="time"
                          value={day[field] ? String(day[field]).slice(0, 5) : ''}
                          onChange={event =>
                            updateWorkingDay(index, {
                              [field]: event.target.value ? `${event.target.value}:00` : null,
                            })
                          }
                          style={styles.webTimeInput}
                        />
                      ) : (
                        <TouchableOpacity
                          key={field}
                          style={styles.timeButton}
                          onPress={() => openTimePicker(index, field)}
                        >
                          <Ionicons name="time-outline" size={17} color={THEME.colors.primary} />
                          <Text style={styles.timeText}>{displayTime(day[field])}</Text>
                        </TouchableOpacity>
                      ),
                    )}
                  </View>
                )}
                {day.isClosed && (
                  <View style={styles.leaveMessage}>
                    <Ionicons name="calendar-outline" size={16} color="#B91C1C" />
                    <Text style={styles.leaveMessageText}>Unavailable for the full day</Text>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {picker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={timePickerValue()}
          mode="time"
          is24Hour
          onChange={(_, value) => {
            if (value) {
              const time = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:00`;
              updateWorkingDay(picker.dayIndex, { [picker.field]: time });
            }
            setPicker(null);
          }}
        />
      )}

      {dobPickerVisible && Platform.OS !== 'web' && (
        <DateTimePicker
          value={draft.dob ? new Date(`${draft.dob}T00:00:00`) : new Date(2000, 0, 1)}
          mode="date"
          maximumDate={new Date()}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, value) => {
            setDobPickerVisible(false);
            if (event.type === 'dismissed' || !value) return;
            const dob = [
              value.getFullYear(),
              String(value.getMonth() + 1).padStart(2, '0'),
              String(value.getDate()).padStart(2, '0'),
            ].join('-');
            setDraft(current => ({ ...current, dob }));
          }}
        />
      )}

      <Modal visible={Boolean(hoodPickerExpert)} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>Select Target Hood</Text>
            <Text style={styles.helperText}>
              The expert’s expertise and working hours will be preserved.
            </Text>
            <ScrollView style={styles.hoodList} showsHorizontalScrollIndicator={false}>
              {targetHoods.map(hood => (
                <TouchableOpacity
                  key={hood.id}
                  onPress={() => {
                    const expertUserId = hoodPickerExpert.userId || hoodPickerExpert.id;
                    setSelectedTargetHoods(current => ({
                      ...current,
                      [expertUserId]: hood.id,
                    }));
                    setHoodPickerExpert(null);
                  }}
                  style={[
                    styles.hoodOption,
                    selectedTargetHoods[hoodPickerExpert?.userId || hoodPickerExpert?.id] === hood.id &&
                      styles.hoodOptionSelected,
                  ]}
                >
                  <Text style={styles.hoodName}>{hood.name}</Text>
                  {selectedTargetHoods[hoodPickerExpert?.userId || hoodPickerExpert?.id] === hood.id && (
                    <Ionicons name="checkmark-circle" size={21} color={THEME.colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setHoodPickerExpert(null)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(catalogPicker)} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>
              Select {catalogPicker?.type === 'category' ? 'category' : 'subcategory'}
            </Text>
            <ScrollView style={styles.hoodList} showsHorizontalScrollIndicator={false}>
              {(catalogPicker?.type === 'category'
                ? categories
                : subcategories.filter(
                    item =>
                      item.categoryId ===
                      draft.expertises[catalogPicker?.index]?.categoryId,
                  )
              ).map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.hoodOption}
                  onPress={() => {
                    if (catalogPicker.type === 'category') {
                      setDraft(current => ({
                        ...current,
                        expertises: current.expertises.map((expertise, index) =>
                          index === catalogPicker.index
                            ? { categoryId: item.id, subcategoryId: '' }
                            : expertise,
                        ),
                      }));
                    } else {
                      updateExpertise(catalogPicker.index, 'subcategoryId', item.id);
                    }
                    setCatalogPicker(null);
                  }}
                >
                  <Text style={styles.hoodName}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.catalogClose} onPress={() => setCatalogPicker(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={Boolean(deleteExpert)}
        title="Remove expert?"
        message="This removes the expert from this hood. Their global user account is not deleted."
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={removeExpert}
        onCancel={() => setDeleteExpert(null)}
        loading={saving}
        confirmColor="#DC2626"
        icon="person-remove-outline"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  iconButton: { padding: 8 },
  headerText: { flex: 1, marginLeft: 4 },
  title: { fontSize: 21, fontWeight: '800', color: THEME.colors.text },
  subtitle: { marginTop: 2, color: THEME.colors.textSecondary, fontSize: 13 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: THEME.colors.primary, paddingHorizontal: 14, height: 40, borderRadius: 12 },
  addButtonText: { color: '#FFF', fontWeight: '700' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, color: THEME.colors.textSecondary },
  emptyCard: { alignItems: 'center', backgroundColor: '#FFF', padding: 32, borderRadius: 18, borderWidth: 1, borderColor: THEME.colors.border },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: '700', color: THEME.colors.text },
  emptyText: { marginTop: 6, textAlign: 'center', color: THEME.colors.textSecondary },
  card: { padding: 16, marginBottom: 12, backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: THEME.colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, color: THEME.colors.primary, fontWeight: '800' },
  cardIdentity: { flex: 1, marginHorizontal: 12 },
  expertName: { fontSize: 17, fontWeight: '700', color: THEME.colors.text },
  expertMeta: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 12 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  activePill: { backgroundColor: '#DCFCE7' },
  inactivePill: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 11, fontWeight: '800', color: '#166534' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondaryAction: { flex: 1, height: 40, borderRadius: 10, backgroundColor: '#F0FDF4', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: THEME.colors.primary, fontWeight: '700' },
  deleteAction: { width: 42, height: 40, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  schedulePreview: { gap: 7, paddingTop: 14 },
  scheduleChip: { minWidth: 78, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#DCFCE7' },
  scheduleChipClosed: { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' },
  scheduleDay: { color: '#166534', fontSize: 11, fontWeight: '900' },
  scheduleTime: { marginTop: 3, color: '#166534', fontSize: 10, fontWeight: '600' },
  scheduleTextClosed: { color: '#B91C1C' },
  transferArea: { marginTop: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  transferLabel: { marginBottom: 8, color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  hoodSelectButton: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center' },
  transferButton: { height: 44, marginTop: 10, borderRadius: 11, backgroundColor: THEME.colors.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  transferButtonText: { color: '#FFF', fontWeight: '800' },
  disabledButton: { opacity: 0.45 },
  editor: { flex: 1, backgroundColor: THEME.colors.background },
  modalHeader: { height: 60, paddingHorizontal: 12, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: THEME.colors.border },
  modalTitle: { fontSize: 18, fontWeight: '800', color: THEME.colors.text },
  saveText: { color: THEME.colors.primary, fontWeight: '800', padding: 10 },
  form: { padding: 16, paddingBottom: 42 },
  label: { marginBottom: 7, fontSize: 13, fontWeight: '700', color: THEME.colors.textSecondary },
  sectionTitle: { marginTop: 24, marginBottom: 12, fontSize: 18, fontWeight: '800', color: THEME.colors.text },
  input: { minHeight: 46, paddingHorizontal: 13, marginBottom: 10, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#FFF', color: THEME.colors.text },
  disabledInput: { backgroundColor: '#F3F4F6', color: THEME.colors.textSecondary },
  phoneRow: { flexDirection: 'row', gap: 10 },
  countryCodeInput: { width: 74 },
  mobileInput: { flex: 1 },
  dateSelectButton: { minHeight: 48, paddingHorizontal: 13, marginBottom: 10, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#FFF', flexDirection: 'row', gap: 9, alignItems: 'center' },
  webDateInput: { width: '100%', height: 46, boxSizing: 'border-box', paddingLeft: 13, paddingRight: 13, marginBottom: 10, borderWidth: 1, borderStyle: 'solid', borderColor: '#EFEFEF', borderRadius: 11, backgroundColor: '#FFF', color: '#333' },
  optionalHelp: { marginTop: -5, marginBottom: 12, color: THEME.colors.textSecondary, lineHeight: 19 },
  expertiseCard: { padding: 12, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF' },
  catalogSelect: { minHeight: 46, paddingHorizontal: 13, marginBottom: 10, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' },
  catalogValue: { flex: 1, color: THEME.colors.text, fontWeight: '600' },
  catalogPlaceholder: { flex: 1, color: THEME.colors.textMuted },
  catalogClose: { alignSelf: 'flex-end', marginTop: 16, padding: 8 },
  removeText: { color: '#DC2626', fontWeight: '700', textAlign: 'right' },
  addExpertise: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 8 },
  addExpertiseText: { color: THEME.colors.primary, fontWeight: '700' },
  availabilityNote: { flexDirection: 'row', gap: 8, padding: 12, marginBottom: 12, borderRadius: 12, backgroundColor: '#F3E8FF' },
  availabilityNoteText: { flex: 1, color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  autoSaveNote: { flexDirection: 'row', gap: 8, padding: 12, marginBottom: 9, borderRadius: 12, backgroundColor: '#DCFCE7' },
  autoSaveNoteText: { flex: 1, color: '#166534', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  dayCard: { padding: 13, marginBottom: 9, borderRadius: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayName: { fontWeight: '700', color: THEME.colors.text },
  availabilityControl: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5, paddingLeft: 9 },
  availabilityLabel: { fontSize: 12, fontWeight: '800' },
  availableLabel: { color: '#166534' },
  leaveLabel: { color: '#B91C1C' },
  availabilityTrack: { width: 44, height: 24, padding: 2, borderRadius: 12, justifyContent: 'center' },
  availableTrack: { backgroundColor: '#22C55E' },
  leaveTrack: { backgroundColor: '#FCA5A5' },
  availabilityThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  thumbLeft: { alignSelf: 'flex-start' },
  thumbRight: { alignSelf: 'flex-end' },
  timeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  leaveMessage: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#FEE2E2' },
  leaveMessageText: { color: '#B91C1C', fontSize: 12, fontWeight: '600' },
  timeButton: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  timeText: { fontWeight: '700', color: THEME.colors.text },
  webTimeInput: { flex: 1, height: 42, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { maxHeight: '75%', padding: 20, borderRadius: 20, backgroundColor: '#FFF' },
  helperText: { marginTop: 7, color: THEME.colors.textSecondary, lineHeight: 20 },
  hoodList: { maxHeight: 280, marginTop: 15, borderWidth: 0 },
  hoodOption: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 0, borderBottomWidth: 0 },
  hoodOptionSelected: { backgroundColor: '#F0FDF4' },
  hoodName: { flex: 1, fontWeight: '600', color: THEME.colors.text },
  modalActions: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 20 },
  cancelText: { color: THEME.colors.textSecondary, fontWeight: '700' },
  primaryButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 11, backgroundColor: THEME.colors.primary, justifyContent: 'center' },
  primaryButtonText: { color: '#FFF', fontWeight: '800' },
});
