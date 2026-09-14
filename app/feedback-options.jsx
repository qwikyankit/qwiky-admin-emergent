import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import ConfirmationModal from '../components/ConfirmationModal';
import THEME from '../constants/theme';
import {
  createFeedbackOption,
  fetchFeedbackOptions,
  getErrorMessage,
  updateFeedbackOption,
  updateFeedbackOptionStatus,
} from '../services/api';

const emptyForm = { code: '', label: '', sortOrder: '1' };
const directions = [
  { reviewerType: 'CUSTOMER', revieweeType: 'EXPERT', label: 'Customer → Expert' },
  { reviewerType: 'EXPERT', revieweeType: 'CUSTOMER', label: 'Expert → Customer' },
];

const ratingPresets = {
  'CUSTOMER:EXPERT': {
    1: { title: "We're sorry to hear that", options: ["Didn't show up", 'Left the job incomplete', 'Damaged my property', 'Rude or unprofessional', 'Very poor quality of work', 'Arrived very late'] },
    2: { title: 'Help us do better', options: ['Arrived late', 'Poor quality of work', "Didn't follow instructions", 'Unprofessional behavior', 'Overpriced for what was done', 'Used wrong products or tools'] },
    3: { title: 'What could we improve?', options: ['Slightly late', 'Could be more thorough', 'Needed more guidance', 'Left some areas unfinished', 'Expected more for the price', 'Could be friendlier'] },
    4: { title: 'Glad it went well!', options: ['On time', 'Good quality of work', 'Friendly and polite', 'Followed instructions well', 'Good value for money'] },
    5: { title: 'We love to hear it!', options: ['Arrived on time', 'Exceptional quality of work', 'Very professional', 'Went above and beyond', 'Great value for money', 'Would recommend'] },
  },
  'EXPERT:CUSTOMER': {
    1: { title: 'This was a difficult experience', options: ['Customer was not present', 'Could not enter the property', 'Customer was rude or abusive', 'Work location felt unsafe', 'Customer refused payment', 'Booking details were completely incorrect'] },
    2: { title: 'What went wrong?', options: ['Waited a long time for customer', 'Customer was uncooperative', 'Property access was difficult', 'Service requirements were inaccurate', 'Customer made unreasonable requests', 'Had difficulty collecting payment'] },
    3: { title: 'What could be smoother?', options: ['Had to wait for customer', 'Instructions could be clearer', 'Service scope changed during work', 'Property access could be easier', 'Customer communication was slow', 'Payment took longer than expected'] },
    4: { title: 'A good customer experience', options: ['Customer was ready on time', 'Instructions were clear', 'Customer was friendly and respectful', 'Property was easy to access', 'Booking details were accurate', 'Payment was completed smoothly'] },
    5: { title: 'A great customer experience', options: ['Customer was ready and available', 'Communication was excellent', 'Customer was very respectful', 'Service requirements were very clear', 'Work environment was safe and welcoming', 'Would serve this customer again'] },
  },
};

const optionCode = (direction, ratingValue, label) =>
  `${direction.revieweeType}_${ratingValue}_${label}`
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

export default function FeedbackOptions() {
  const router = useRouter();
  const [direction, setDirection] = useState(directions[0]);
  const [rating, setRating] = useState(5);
  const [active, setActive] = useState(true);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingPreset, setAddingPreset] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [statusRule, setStatusRule] = useState(null);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const filters = useMemo(
    () => ({
      reviewerType: direction.reviewerType,
      revieweeType: direction.revieweeType,
      rating,
      active,
    }),
    [direction, rating, active],
  );

  const preset = ratingPresets[`${direction.reviewerType}:${direction.revieweeType}`][rating];
  const existingCodes = useMemo(
    () => new Set(rules.map(rule => String(rule.code).toUpperCase())),
    [rules],
  );
  const existingLabels = useMemo(
    () => new Set(rules.map(rule => String(rule.label).trim().toLowerCase())),
    [rules],
  );
  const missingPresetOptions = preset.options.filter(
    label =>
      !existingCodes.has(optionCode(direction, rating, label)) &&
      !existingLabels.has(label.toLowerCase()),
  );

  const loadRules = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchFeedbackOptions(filters);
      setRules([...(data || [])].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder)));
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const openCreate = () => {
    setEditingRule(null);
    const lastRule = rules[rules.length - 1];
    setForm({ ...emptyForm, sortOrder: String((lastRule?.sortOrder || 0) + 1) });
    setFormError('');
  };

  const openEdit = rule => {
    setEditingRule(rule);
    setForm({ code: rule.code, label: rule.label, sortOrder: String(rule.sortOrder) });
    setFormError('');
  };

  const saveRule = async () => {
    const code = form.code.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_');
    const label = form.label.trim();
    const sortOrder = Number(form.sortOrder);
    if (!code || !label || !Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError('Enter a code, label, and a non-negative whole-number sort order.');
      return;
    }
    try {
      setSaving(true);
      if (editingRule) {
        await updateFeedbackOption(editingRule.id, { label, sortOrder, active: editingRule.active });
      } else {
        await createFeedbackOption({
          code,
          label,
          reviewerType: direction.reviewerType,
          revieweeType: direction.revieweeType,
          rating,
          sortOrder,
        });
      }
      setEditingRule(null);
      setForm(null);
      setToast({ visible: true, message: editingRule ? 'Feedback option updated' : 'Feedback option created', type: 'success' });
      await loadRules();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    if (!statusRule) return;
    try {
      setSaving(true);
      await updateFeedbackOptionStatus(statusRule.id, !statusRule.active);
      setStatusRule(null);
      setToast({ visible: true, message: statusRule.active ? 'Feedback option disabled' : 'Feedback option enabled', type: 'success' });
      await loadRules();
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const addRecommendedSet = async () => {
    if (!missingPresetOptions.length) return;
    try {
      setAddingPreset(true);
      const nextOrder = Math.max(0, ...rules.map(rule => Number(rule.sortOrder) || 0)) + 1;
      await Promise.all(
        missingPresetOptions.map((label, index) =>
          createFeedbackOption({
            code: optionCode(direction, rating, label),
            label,
            reviewerType: direction.reviewerType,
            revieweeType: direction.revieweeType,
            rating,
            sortOrder: nextOrder + index,
          }),
        ),
      );
      setToast({ visible: true, message: 'Recommended feedback options added', type: 'success' });
      await loadRules();
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
      await loadRules();
    } finally {
      setAddingPreset(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast {...toast} onHide={() => setToast(current => ({ ...current, visible: false }))} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/admin-settings')} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Feedback Options</Text>
          <Text style={styles.subtitle}>Customer and expert rating choices</Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={styles.addButton}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Feedback direction</Text>
        <View style={styles.segmentRow}>
          {directions.map(item => (
            <TouchableOpacity key={item.label} onPress={() => setDirection(item)} style={[styles.segment, direction.label === item.label && styles.segmentActive]}>
              <Text style={[styles.segmentText, direction.label === item.label && styles.segmentTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.sectionLabel}>Rating</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map(value => (
            <TouchableOpacity key={value} onPress={() => setRating(value)} style={[styles.rating, rating === value && styles.ratingActive]}>
              <Ionicons name={rating === value ? 'star' : 'star-outline'} size={18} color={rating === value ? '#FFF' : THEME.colors.primary} />
              <Text style={[styles.ratingText, rating === value && styles.ratingTextActive]}>{value}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.statusRow}>
          {[true, false].map(value => (
            <TouchableOpacity key={String(value)} onPress={() => setActive(value)} style={[styles.statusChip, active === value && styles.statusChipActive]}>
              <Text style={[styles.statusText, active === value && styles.statusTextActive]}>{value ? 'Active' : 'Inactive'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.presetCard}>
          <View style={styles.presetHeader}>
            <View style={styles.presetTitleCopy}>
              <Text style={styles.presetEyebrow}>{rating}-STAR EXPERIENCE</Text>
              <Text style={styles.presetTitle}>{preset.title}</Text>
            </View>
            <View style={styles.starSummary}>
              {[1, 2, 3, 4, 5].map(value => (
                <Ionicons key={value} name="star" size={15} color={value <= rating ? '#FBBF24' : '#E5E7EB'} />
              ))}
            </View>
          </View>
          <Text style={styles.presetDescription}>
            Recommended choices for {direction.label.toLowerCase()} feedback.
          </Text>
          <View style={styles.presetChips}>
            {preset.options.map(label => {
              const added =
                existingCodes.has(optionCode(direction, rating, label)) ||
                existingLabels.has(label.toLowerCase());
              return (
                <View key={label} style={[styles.presetChip, added && styles.presetChipAdded]}>
                  {added && <Ionicons name="checkmark-circle" size={14} color={THEME.colors.success} />}
                  <Text style={[styles.presetChipText, added && styles.presetChipTextAdded]}>{label}</Text>
                </View>
              );
            })}
          </View>
          {active && (
            <TouchableOpacity
              disabled={loading || addingPreset || !missingPresetOptions.length}
              onPress={addRecommendedSet}
              style={[styles.presetButton, !missingPresetOptions.length && styles.presetButtonDone]}
            >
              <Ionicons name={missingPresetOptions.length ? 'add-circle-outline' : 'checkmark-circle-outline'} size={18} color={missingPresetOptions.length ? '#FFF' : THEME.colors.success} />
              <Text style={[styles.presetButtonText, !missingPresetOptions.length && styles.presetButtonTextDone]}>
                {addingPreset ? 'Adding…' : missingPresetOptions.length ? `Add ${missingPresetOptions.length} missing options` : 'Recommended set added'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={THEME.colors.primary} />
        ) : !rules.length ? (
          <View style={styles.empty}>
            <Ionicons name="chatbox-ellipses-outline" size={38} color={THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>No options for these filters</Text>
            <Text style={styles.emptyText}>Create an option to make it available for this direction and rating.</Text>
          </View>
        ) : (
          rules.map(rule => (
            <View key={rule.id} style={styles.card}>
              <View style={styles.orderBadge}><Text style={styles.orderText}>{rule.sortOrder}</Text></View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{rule.label}</Text>
                <Text style={styles.code}>{rule.code}</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(rule)} style={styles.cardAction}>
                <Ionicons name="create-outline" size={20} color={THEME.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStatusRule(rule)} style={styles.cardAction}>
                <Ionicons name={rule.active ? 'eye-off-outline' : 'eye-outline'} size={20} color={rule.active ? THEME.colors.error : THEME.colors.success} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={form !== null} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingRule ? 'Edit feedback option' : 'Create feedback option'}</Text>
            <Text style={styles.fieldLabel}>Code</Text>
            <TextInput editable={!editingRule} autoCapitalize="characters" value={form?.code || ''} onChangeText={code => setForm(current => ({ ...current, code }))} style={[styles.input, editingRule && styles.inputDisabled]} placeholder="ON_TIME" />
            <Text style={styles.fieldLabel}>Label</Text>
            <TextInput value={form?.label || ''} onChangeText={label => setForm(current => ({ ...current, label }))} style={styles.input} placeholder="On time" />
            <Text style={styles.fieldLabel}>Sort order</Text>
            <TextInput keyboardType="number-pad" value={form?.sortOrder || ''} onChangeText={sortOrder => setForm(current => ({ ...current, sortOrder }))} style={styles.input} placeholder="1" />
            {!!formError && <Text style={styles.formError}>{formError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity disabled={saving} onPress={() => setForm(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={saveRule} style={styles.saveButton}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={Boolean(statusRule)}
        title={`${statusRule?.active ? 'Disable' : 'Enable'} feedback option?`}
        message={statusRule?.active ? 'It will no longer appear in new feedback forms. Historical feedback is preserved.' : 'It will become available for its configured direction and rating.'}
        confirmText={statusRule?.active ? 'Disable' : 'Enable'}
        loading={saving}
        onCancel={() => setStatusRule(null)}
        onConfirm={changeStatus}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  iconButton: { padding: 8 }, headerCopy: { flex: 1, marginLeft: 4 },
  title: { fontSize: 20, fontWeight: '800', color: THEME.colors.text }, subtitle: { marginTop: 2, fontSize: 12, color: THEME.colors.textSecondary },
  addButton: { height: 40, paddingHorizontal: 13, borderRadius: 11, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 }, addButtonText: { color: '#FFF', fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 }, sectionLabel: { marginBottom: 8, color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 18 }, segment: { flex: 1, minHeight: 44, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' }, segmentActive: { borderColor: THEME.colors.primary, backgroundColor: '#F3E8FF' }, segmentText: { fontSize: 12, fontWeight: '700', color: THEME.colors.textSecondary }, segmentTextActive: { color: THEME.colors.primary },
  ratingRow: { flexDirection: 'row', gap: 8, marginBottom: 14 }, rating: { flex: 1, height: 43, borderRadius: 11, borderWidth: 1, borderColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: '#FFF' }, ratingActive: { backgroundColor: THEME.colors.primary }, ratingText: { color: THEME.colors.primary, fontWeight: '800' }, ratingTextActive: { color: '#FFF' },
  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 18 }, statusChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border }, statusChipActive: { backgroundColor: '#EDE9FE', borderColor: THEME.colors.primary }, statusText: { color: THEME.colors.textSecondary, fontWeight: '700' }, statusTextActive: { color: THEME.colors.primary },
  presetCard: { marginBottom: 18, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#DDD6FE', backgroundColor: '#FAF5FF' },
  presetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  presetTitleCopy: { flex: 1 },
  presetEyebrow: { color: THEME.colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  presetTitle: { marginTop: 3, color: THEME.colors.text, fontSize: 18, fontWeight: '900' },
  starSummary: { flexDirection: 'row', gap: 2 },
  presetDescription: { marginTop: 7, color: THEME.colors.textSecondary, fontSize: 12 },
  presetChips: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  presetChip: { minHeight: 34, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#C4B5FD', backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', gap: 5 },
  presetChipAdded: { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  presetChipText: { color: THEME.colors.text, fontSize: 12, fontWeight: '700' },
  presetChipTextAdded: { color: '#166534' },
  presetButton: { minHeight: 44, marginTop: 15, borderRadius: 12, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  presetButtonDone: { borderWidth: 1, borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' },
  presetButtonText: { color: '#FFF', fontWeight: '800' },
  presetButtonTextDone: { color: '#166534' },
  loader: { marginTop: 40 }, empty: { marginTop: 20, padding: 28, borderRadius: 18, alignItems: 'center', backgroundColor: '#FFF' }, emptyTitle: { marginTop: 10, color: THEME.colors.text, fontSize: 17, fontWeight: '800' }, emptyText: { marginTop: 5, color: THEME.colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  card: { minHeight: 76, marginBottom: 10, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, orderBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' }, orderText: { color: THEME.colors.primary, fontWeight: '900' }, cardCopy: { flex: 1, marginHorizontal: 11 }, cardTitle: { color: THEME.colors.text, fontSize: 15, fontWeight: '800' }, code: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 11 }, cardAction: { padding: 9 },
  overlay: { flex: 1, padding: 22, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center' }, modalCard: { width: '100%', maxWidth: 420, padding: 20, borderRadius: 19, backgroundColor: '#FFF' }, modalTitle: { fontSize: 19, fontWeight: '800', color: THEME.colors.text }, fieldLabel: { marginTop: 14, marginBottom: 6, color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' }, input: { height: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, color: THEME.colors.text }, inputDisabled: { backgroundColor: '#F3F4F6', color: THEME.colors.textMuted }, formError: { marginTop: 12, color: THEME.colors.error, lineHeight: 18 }, modalActions: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 20 }, cancelText: { color: THEME.colors.textSecondary, fontWeight: '700' }, saveButton: { minHeight: 42, paddingHorizontal: 20, borderRadius: 11, backgroundColor: THEME.colors.primary, justifyContent: 'center' }, saveText: { color: '#FFF', fontWeight: '800' },
});
