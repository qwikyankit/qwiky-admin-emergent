import React, { useCallback, useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';

import ConfirmationModal from '../components/ConfirmationModal';
import Toast from '../components/Toast';
import THEME from '../constants/theme';
import {
  createDistancePriceRule,
  deleteDistancePriceRule,
  fetchDistancePriceRules,
  getErrorMessage,
  updateDistancePriceRule,
} from '../services/api';

const emptyForm = { maxDistanceKm: '', price: '', status: 'ACTIVE' };

export default function DistancePricing() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hoodItemId = Array.isArray(params.hoodItemId) ? params.hoodItemId[0] : params.hoodItemId;
  const itemName = Array.isArray(params.itemName) ? params.itemName[0] : params.itemName;
  const offerPrice = Array.isArray(params.offerPrice) ? params.offerPrice[0] : params.offerPrice;
  const radiusParam = Array.isArray(params.serviceableRadiusKm)
    ? params.serviceableRadiusKm[0]
    : params.serviceableRadiusKm;
  const serviceableRadiusKm = Number(radiusParam);
  const hasRadiusLimit = Number.isFinite(serviceableRadiusKm) && serviceableRadiusKm > 0;
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteRule, setDeleteRule] = useState(null);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const loadRules = useCallback(async () => {
    if (!hoodItemId) return;
    try {
      setLoading(true);
      const data = await fetchDistancePriceRules(hoodItemId);
      setRules([...(data || [])].sort((a, b) => Number(a.maxDistanceKm) - Number(b.maxDistanceKm)));
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [hoodItemId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const openCreate = () => {
    setEditingRule(null);
    setForm({ ...emptyForm, price: offerPrice == null ? '' : String(offerPrice) });
    setFormError('');
  };

  const openEdit = rule => {
    setEditingRule(rule);
    setForm({
      maxDistanceKm: String(rule.maxDistanceKm),
      price: String(rule.price),
      status: rule.status || 'ACTIVE',
    });
    setFormError('');
  };

  const validateForm = () => {
    const distanceText = String(form?.maxDistanceKm || '').trim();
    const priceText = String(form?.price || '').trim();
    const distance = Number(distanceText);
    const price = Number(priceText);
    if (!/^\d+(\.\d{1,3})?$/.test(distanceText) || !Number.isFinite(distance) || distance <= 0) {
      return 'Maximum distance must be greater than 0 with up to 3 decimal places.';
    }
    if (hasRadiusLimit && distance > serviceableRadiusKm) {
      return `Maximum distance cannot exceed this hood's ${serviceableRadiusKm} km serviceable radius.`;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(priceText) || !Number.isFinite(price) || price < 0) {
      return 'Price must be non-negative with up to 2 decimal places.';
    }
    if (!editingRule && rules.some(rule => Number(rule.maxDistanceKm) === distance)) {
      return 'A rule already exists for this maximum distance.';
    }
    return '';
  };

  const saveRule = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const payload = {
      maxDistanceKm: Number(form.maxDistanceKm),
      price: Number(form.price),
      status: form.status,
    };
    try {
      setSaving(true);
      if (editingRule) await updateDistancePriceRule(hoodItemId, editingRule.id, payload);
      else await createDistancePriceRule(hoodItemId, payload);
      setForm(null);
      setEditingRule(null);
      setToast({ visible: true, message: editingRule ? 'Distance price rule updated' : 'Distance price rule created', type: 'success' });
      await loadRules();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRule) return;
    try {
      setSaving(true);
      await deleteDistancePriceRule(hoodItemId, deleteRule.id);
      setDeleteRule(null);
      setToast({ visible: true, message: 'Distance price rule deleted', type: 'success' });
      await loadRules();
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast {...toast} onHide={() => setToast(current => ({ ...current, visible: false }))} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Distance Pricing</Text>
          <Text style={styles.subtitle}>{itemName || 'Selected hood item'}</Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={styles.addButton}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addButtonText}>Add rule</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>Rules are evaluated from the shortest maximum distance upward. The first matching active rule supplies the customer price.</Text>
        {hasRadiusLimit && (
          <View style={styles.radiusNotice}>
            <Ionicons name="radio-button-on-outline" size={18} color={THEME.colors.primary} />
            <Text style={styles.radiusNoticeText}>
              Hood serviceable radius: <Text style={styles.radiusNoticeValue}>{serviceableRadiusKm} km</Text>
            </Text>
          </View>
        )}
        {loading ? (
          <ActivityIndicator style={styles.loader} color={THEME.colors.primary} />
        ) : !rules.length ? (
          <View style={styles.empty}>
            <Ionicons name="navigate-outline" size={40} color={THEME.colors.textMuted} />
            <Text style={styles.emptyTitle}>No distance price rules</Text>
            <Text style={styles.emptyText}>The item keeps its existing price until an active rule is configured.</Text>
          </View>
        ) : (
          rules.map((rule, index) => (
            <View key={rule.id} style={[styles.card, hasRadiusLimit && Number(rule.maxDistanceKm) > serviceableRadiusKm && styles.invalidCard]}>
              <View style={styles.distanceIcon}><Ionicons name="location-outline" size={21} color={THEME.colors.primary} /></View>
              <View style={styles.cardCopy}>
                <Text style={styles.range}>{index === 0 ? '0' : `>${rules[index - 1].maxDistanceKm}`} – {rule.maxDistanceKm} km</Text>
                <Text style={styles.price}>₹{Number(rule.price).toFixed(2)}</Text>
                {hasRadiusLimit && Number(rule.maxDistanceKm) > serviceableRadiusKm && (
                  <Text style={styles.invalidText}>Beyond {serviceableRadiusKm} km hood radius</Text>
                )}
              </View>
              <View style={[styles.statusBadge, rule.status !== 'ACTIVE' && styles.inactiveBadge]}><Text style={[styles.statusText, rule.status !== 'ACTIVE' && styles.inactiveText]}>{rule.status || 'ACTIVE'}</Text></View>
              <TouchableOpacity onPress={() => openEdit(rule)} style={styles.action}><Ionicons name="create-outline" size={20} color={THEME.colors.primary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setDeleteRule(rule)} style={styles.action}><Ionicons name="trash-outline" size={20} color={THEME.colors.error} /></TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={Boolean(form)} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingRule ? 'Edit distance rule' : 'Create distance rule'}</Text>
            <Text style={styles.fieldLabel}>Maximum distance in km</Text>
            <TextInput keyboardType="decimal-pad" value={form?.maxDistanceKm || ''} onChangeText={maxDistanceKm => setForm(current => ({ ...current, maxDistanceKm }))} style={styles.input} placeholder="5.000" />
            {hasRadiusLimit && <Text style={styles.fieldHint}>Maximum allowed: {serviceableRadiusKm} km</Text>}
            <Text style={styles.fieldLabel}>Price</Text>
            <TextInput keyboardType="decimal-pad" value={form?.price || ''} onChangeText={price => setForm(current => ({ ...current, price }))} style={styles.input} placeholder="250.00" />
            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.statusChoices}>
              {['ACTIVE', 'INACTIVE', 'DELETED'].map(status => (
                <TouchableOpacity key={status} onPress={() => setForm(current => ({ ...current, status }))} style={[styles.statusChoice, form?.status === status && styles.statusChoiceActive]}><Text style={[styles.statusChoiceText, form?.status === status && styles.statusChoiceTextActive]}>{status}</Text></TouchableOpacity>
              ))}
            </View>
            {!!formError && <Text style={styles.formError}>{formError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity disabled={saving} onPress={() => setForm(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity disabled={saving} onPress={saveRule} style={styles.saveButton}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save rule'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmationModal visible={Boolean(deleteRule)} title="Delete distance rule?" message="This removes the selected pricing boundary. Remaining rules will continue to be evaluated in ascending order." confirmText="Delete" confirmColor={THEME.colors.error} loading={saving} onCancel={() => setDeleteRule(null)} onConfirm={confirmDelete} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background }, header: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border }, iconButton: { padding: 8 }, headerCopy: { flex: 1, marginLeft: 4 }, title: { fontSize: 20, fontWeight: '800', color: THEME.colors.text }, subtitle: { marginTop: 2, fontSize: 12, color: THEME.colors.textSecondary }, addButton: { height: 40, paddingHorizontal: 12, borderRadius: 11, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 }, addButtonText: { color: '#FFF', fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 }, intro: { marginBottom: 12, color: THEME.colors.textSecondary, lineHeight: 21 }, radiusNotice: { marginBottom: 18, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 12, backgroundColor: '#F3E8FF', flexDirection: 'row', alignItems: 'center', gap: 8 }, radiusNoticeText: { color: THEME.colors.textSecondary, fontSize: 12 }, radiusNoticeValue: { color: THEME.colors.primary, fontWeight: '900' }, loader: { marginTop: 40 }, empty: { padding: 30, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center' }, emptyTitle: { marginTop: 10, color: THEME.colors.text, fontSize: 18, fontWeight: '800' }, emptyText: { marginTop: 5, color: THEME.colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  card: { minHeight: 82, marginBottom: 10, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, invalidCard: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' }, distanceIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' }, cardCopy: { flex: 1, marginHorizontal: 11 }, range: { color: THEME.colors.text, fontWeight: '800' }, price: { marginTop: 4, color: THEME.colors.primary, fontSize: 18, fontWeight: '900' }, invalidText: { marginTop: 4, color: THEME.colors.error, fontSize: 10, fontWeight: '800' }, statusBadge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, backgroundColor: '#DCFCE7' }, inactiveBadge: { backgroundColor: '#F3F4F6' }, statusText: { color: '#166534', fontSize: 9, fontWeight: '900' }, inactiveText: { color: THEME.colors.textSecondary }, action: { padding: 8 },
  overlay: { flex: 1, padding: 22, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center' }, modalCard: { width: '100%', maxWidth: 420, padding: 20, borderRadius: 19, backgroundColor: '#FFF' }, modalTitle: { fontSize: 19, fontWeight: '800', color: THEME.colors.text }, fieldLabel: { marginTop: 14, marginBottom: 6, color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' }, fieldHint: { marginTop: 5, color: THEME.colors.primary, fontSize: 11, fontWeight: '700' }, input: { height: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, color: THEME.colors.text }, statusChoices: { flexDirection: 'row', gap: 7 }, statusChoice: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border, alignItems: 'center', justifyContent: 'center' }, statusChoiceActive: { borderColor: THEME.colors.primary, backgroundColor: '#F3E8FF' }, statusChoiceText: { color: THEME.colors.textSecondary, fontSize: 10, fontWeight: '800' }, statusChoiceTextActive: { color: THEME.colors.primary }, formError: { marginTop: 12, color: THEME.colors.error, lineHeight: 18 }, modalActions: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 20 }, cancelText: { color: THEME.colors.textSecondary, fontWeight: '700' }, saveButton: { minHeight: 42, paddingHorizontal: 18, borderRadius: 11, backgroundColor: THEME.colors.primary, justifyContent: 'center' }, saveText: { color: '#FFF', fontWeight: '800' },
});
