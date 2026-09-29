import React, { useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import ConfirmationModal from './ConfirmationModal';
import { THEME } from '../constants/theme';
import {
  createNotificationTemplate,
  getErrorMessage,
  updateNotificationTemplate,
} from '../services/api';
import {
  extractTemplateVariables,
  NOTIFICATION_CHANNELS,
  TEMPLATE_STATUSES,
  validateTemplateSyntax,
} from '../utils/notifications';

const EMPTY_TEMPLATE = {
  templateCode: '',
  name: '',
  channel: 'PUSH',
  subject: '',
  content: '',
  contentType: 'TEXT',
  status: 'ACTIVE',
};

const templatePayload = values => ({
  templateCode: values.templateCode.trim(),
  name: values.name.trim(),
  channel: values.channel,
  subject: ['PUSH', 'EMAIL'].includes(values.channel) ? values.subject.trim() || undefined : undefined,
  content: values.content,
  contentType: values.contentType,
  status: values.status,
});

export default function NotificationTemplateManager({
  templates,
  campaigns,
  loading,
  onRefresh,
  showToast,
}) {
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const visibleTemplates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return templates.filter(template => {
      const matchesChannel = channel === 'ALL' || template.channel === channel;
      const matchesStatus = status === 'ALL' || template.status === status;
      const matchesSearch =
        !needle ||
        template.name?.toLowerCase().includes(needle) ||
        template.templateCode?.toLowerCase().includes(needle) ||
        template.content?.toLowerCase().includes(needle);
      return matchesChannel && matchesStatus && matchesSearch;
    });
  }, [channel, search, status, templates]);

  const openCreate = () => {
    setForm({ editing: false, id: null, values: { ...EMPTY_TEMPLATE } });
    setFormError('');
  };

  const openEdit = template => {
    setForm({
      editing: true,
      id: template.id,
      values: {
        ...EMPTY_TEMPLATE,
        ...template,
        subject: template.subject || '',
      },
    });
    setFormError('');
  };

  const change = (field, value) =>
    setForm(current => ({
      ...current,
      values: { ...current.values, [field]: value },
    }));

  const validate = values => {
    if (!values.templateCode.trim()) return 'Template code is required.';
    if (values.templateCode.trim().length > 120) return 'Template code cannot exceed 120 characters.';
    if (!values.name.trim()) return 'Display name is required.';
    if (values.name.trim().length > 200) return 'Display name cannot exceed 200 characters.';
    if (!values.content.trim()) return 'Template content is required.';
    if (values.channel === 'EMAIL' && !values.subject.trim()) return 'Email templates require a subject.';
    if (values.subject.length > 255) return 'Subject cannot exceed 255 characters.';
    return validateTemplateSyntax(`${values.subject}\n${values.content}`);
  };

  const persist = async candidate => {
    try {
      setSaving(true);
      const payload = templatePayload(candidate.values);
      if (candidate.editing) await updateNotificationTemplate(candidate.id, payload);
      else await createNotificationTemplate(payload);
      setForm(null);
      setConfirmation(null);
      showToast(
        `Template ${candidate.editing ? 'updated' : 'created'} successfully.`,
        'success',
      );
      await onRefresh();
    } catch (error) {
      setFormError(getErrorMessage(error));
      setConfirmation(null);
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    const error = validate(form.values);
    if (error) {
      setFormError(error);
      return;
    }
    const usedByCampaign = campaigns.some(
      campaign => campaign.templateCode === form.values.templateCode,
    );
    if (form.editing && form.values.status === 'ACTIVE' && usedByCampaign) {
      setConfirmation({
        mode: 'save',
        candidate: form,
        title: 'Update active template?',
        message:
          'This template is used by campaigns. The change affects future rendering; already-created notifications retain their existing payload.',
      });
      return;
    }
    persist(form);
  };

  const requestStatusChange = template => {
    const nextStatus = template.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const usedByCampaign = campaigns.some(
      campaign => campaign.templateCode === template.templateCode,
    );
    setConfirmation({
      mode: 'status',
      candidate: {
        editing: true,
        id: template.id,
        values: { ...EMPTY_TEMPLATE, ...template, status: nextStatus },
      },
      title: `${nextStatus === 'ACTIVE' ? 'Activate' : 'Deactivate'} template?`,
      message:
        nextStatus === 'INACTIVE' && usedByCampaign
          ? 'This template is used by campaigns. Inactive templates cannot be used by new notifications or campaigns.'
          : nextStatus === 'ACTIVE'
            ? 'This template will become available for new notifications and campaigns.'
            : 'This template will no longer be available for new notifications and campaigns.',
    });
  };

  const variables = form ? extractTemplateVariables(`${form.values.subject} ${form.values.content}`) : [];

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderCopy}>
          <Text style={styles.pageTitle}>Notification Templates</Text>
          <Text style={styles.pageSubtitle}>Reusable push, SMS, and email content</Text>
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={openCreate}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.primaryButtonText}>Create Template</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={THEME.colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search templates"
            style={styles.searchInput}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {['ALL', ...NOTIFICATION_CHANNELS].map(item => (
            <TouchableOpacity
              key={item}
              onPress={() => setChannel(item)}
              style={[styles.filterChip, channel === item && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, channel === item && styles.filterTextActive]}>
                {item === 'ALL' ? 'All channels' : item}
              </Text>
            </TouchableOpacity>
          ))}
          {['ALL', ...TEMPLATE_STATUSES].map(item => (
            <TouchableOpacity
              key={`status-${item}`}
              onPress={() => setStatus(item)}
              style={[styles.filterChip, status === item && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, status === item && styles.filterTextActive]}>
                {item === 'ALL' ? 'All statuses' : item}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={THEME.colors.primary} /></View>
      ) : !visibleTemplates.length ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={42} color={THEME.colors.textMuted} />
          <Text style={styles.emptyTitle}>No notification templates</Text>
          <Text style={styles.emptyText}>Create an active template before scheduling a campaign.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {visibleTemplates.map(template => {
            const templateVariables = extractTemplateVariables(
              `${template.subject || ''} ${template.content || ''}`,
            );
            return (
              <View key={template.id || `${template.channel}:${template.templateCode}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.channelBadge}>
                    <Ionicons
                      name={template.channel === 'EMAIL' ? 'mail-outline' : template.channel === 'SMS' ? 'chatbox-outline' : 'notifications-outline'}
                      size={16}
                      color={THEME.colors.primary}
                    />
                    <Text style={styles.channelText}>{template.channel}</Text>
                  </View>
                  <View style={[styles.statusBadge, template.status === 'ACTIVE' ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.statusText, template.status === 'ACTIVE' ? styles.statusTextActive : styles.statusTextInactive]}>
                      {template.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardTitle}>{template.name}</Text>
                <Text style={styles.code}>{template.templateCode}</Text>
                {!!template.subject && <Text style={styles.subject}>{template.subject}</Text>}
                <Text style={styles.content} numberOfLines={4}>{template.content}</Text>
                {!!template.updatedAt && <Text style={styles.updatedAt}>Updated {new Date(template.updatedAt).toLocaleString()}</Text>}
                {!!templateVariables.length && (
                  <View style={styles.variableRow}>
                    {templateVariables.map(variable => (
                      <View key={variable} style={styles.variableChip}>
                        <Text style={styles.variableText}>{`{{${variable}}}`}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(template)} style={styles.textAction}>
                    <Ionicons name="create-outline" size={17} color={THEME.colors.primary} />
                    <Text style={styles.textActionLabel}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => requestStatusChange(template)} style={styles.textAction}>
                    <Ionicons
                      name={template.status === 'ACTIVE' ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={17}
                      color={template.status === 'ACTIVE' ? '#B45309' : '#15803D'}
                    />
                    <Text style={[styles.textActionLabel, { color: template.status === 'ACTIVE' ? '#B45309' : '#15803D' }]}>
                      {template.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal visible={Boolean(form)} animationType="slide" onRequestClose={() => setForm(null)}>
        <View style={styles.formScreen}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setForm(null)} style={styles.iconButton}>
              <Ionicons name="close" size={24} color={THEME.colors.text} />
            </TouchableOpacity>
            <View style={styles.formHeaderCopy}>
              <Text style={styles.formTitle}>{form?.editing ? 'Edit Template' : 'Create Template'}</Text>
              <Text style={styles.formSubtitle}>Variables are case-sensitive</Text>
            </View>
            <TouchableOpacity onPress={requestSave} disabled={saving} style={styles.headerSave}>
              {saving ? <ActivityIndicator color={THEME.colors.primary} /> : <Text style={styles.headerSaveText}>Save</Text>}
            </TouchableOpacity>
          </View>
          {form && (
            <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Template code</Text>
              <TextInput
                value={form.values.templateCode}
                onChangeText={value => change('templateCode', value.toUpperCase())}
                autoCapitalize="characters"
                maxLength={120}
                placeholder="BOOKING_CONFIRMED_PUSH"
                style={styles.input}
              />
              <Text style={styles.label}>Display name</Text>
              <TextInput
                value={form.values.name}
                onChangeText={value => change('name', value)}
                maxLength={200}
                placeholder="Booking Confirmed Push"
                style={styles.input}
              />
              <Text style={styles.label}>Channel</Text>
              <View style={styles.choiceRow}>
                {NOTIFICATION_CHANNELS.map(item => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => change('channel', item)}
                    style={[styles.choice, form.values.channel === item && styles.choiceActive]}
                  >
                    <Text style={[styles.choiceText, form.values.channel === item && styles.choiceTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {['PUSH', 'EMAIL'].includes(form.values.channel) && (
                <>
                  <Text style={styles.label}>{form.values.channel === 'EMAIL' ? 'Subject' : 'Push title'}</Text>
                  <TextInput value={form.values.subject} onChangeText={value => change('subject', value)} maxLength={255} placeholder={form.values.channel === 'EMAIL' ? 'Email subject' : 'Push notification title'} style={styles.input} />
                </>
              )}
              <Text style={styles.label}>Content type</Text>
              <View style={styles.choiceRow}>
                {['TEXT', 'HTML'].map(item => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => change('contentType', item)}
                    style={[styles.choice, form.values.contentType === item && styles.choiceActive]}
                  >
                    <Text style={[styles.choiceText, form.values.contentType === item && styles.choiceTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Content</Text>
              <TextInput
                value={form.values.content}
                onChangeText={value => change('content', value)}
                placeholder="Hello {{userName}}, your booking {{bookingId}} is confirmed."
                multiline
                style={[styles.input, styles.contentInput]}
              />
              <Text style={styles.helper}>Use {'{{variableName}}'} or {'{variableName}'}. Missing variables fail delivery validation.</Text>
              {!!variables.length && (
                <View style={styles.variablePreview}>
                  <Text style={styles.variablePreviewTitle}>Detected variables</Text>
                  <View style={styles.variableRow}>
                    {variables.map(variable => (
                      <View key={variable} style={styles.variableChip}>
                        <Text style={styles.variableText}>{`{{${variable}}}`}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              <Text style={styles.label}>Status</Text>
              <View style={styles.choiceRow}>
                {TEMPLATE_STATUSES.map(item => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => change('status', item)}
                    style={[styles.choice, form.values.status === item && styles.choiceActive]}
                  >
                    <Text style={[styles.choiceText, form.values.status === item && styles.choiceTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {!!formError && <Text style={styles.formError}>{formError}</Text>}
            </ScrollView>
          )}
        </View>
      </Modal>

      <ConfirmationModal
        visible={Boolean(confirmation)}
        title={confirmation?.title || ''}
        message={confirmation?.message || ''}
        confirmText="Continue"
        loading={saving}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => persist(confirmation.candidate)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageHeaderCopy: { flex: 1 },
  pageTitle: { color: THEME.colors.text, fontSize: 24, fontWeight: '900' },
  pageSubtitle: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 12 },
  primaryButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 11, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  primaryButtonText: { color: '#FFF', fontWeight: '800' },
  toolbar: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  searchBox: { minHeight: 44, paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 8, color: THEME.colors.text },
  filters: { gap: 7 },
  filterChip: { minHeight: 36, paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { borderColor: THEME.colors.primary, backgroundColor: '#F3E8FF' },
  filterText: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: THEME.colors.primary },
  center: { padding: 48, alignItems: 'center' },
  empty: { margin: 16, padding: 36, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.border },
  emptyTitle: { marginTop: 12, color: THEME.colors.text, fontSize: 18, fontWeight: '800' },
  emptyText: { marginTop: 5, color: THEME.colors.textSecondary, textAlign: 'center' },
  grid: { paddingHorizontal: 16, paddingBottom: 40, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, flexBasis: 320, maxWidth: 560, minHeight: 270, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  channelBadge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F3E8FF', flexDirection: 'row', alignItems: 'center', gap: 5 },
  channelText: { color: THEME.colors.primary, fontSize: 11, fontWeight: '900' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusInactive: { backgroundColor: '#F1F5F9' },
  statusText: { fontSize: 10, fontWeight: '900' },
  statusTextActive: { color: '#166534' },
  statusTextInactive: { color: '#64748B' },
  cardTitle: { marginTop: 14, color: THEME.colors.text, fontSize: 17, fontWeight: '900' },
  code: { marginTop: 3, color: THEME.colors.primary, fontSize: 11, fontWeight: '700' },
  subject: { marginTop: 12, color: THEME.colors.text, fontWeight: '800' },
  content: { marginTop: 7, color: THEME.colors.textSecondary, lineHeight: 19 },
  updatedAt: { marginTop: 9, color: THEME.colors.textMuted, fontSize: 10 },
  variableRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  variableChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, backgroundColor: '#F1F5F9' },
  variableText: { color: '#475569', fontSize: 10, fontWeight: '700' },
  cardActions: { marginTop: 'auto', paddingTop: 15, flexDirection: 'row', gap: 18 },
  textAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5 },
  textActionLabel: { color: THEME.colors.primary, fontSize: 12, fontWeight: '800' },
  formScreen: { flex: 1, backgroundColor: THEME.colors.background },
  formHeader: { minHeight: 64, paddingHorizontal: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 8 },
  formHeaderCopy: { flex: 1, marginLeft: 5 },
  formTitle: { color: THEME.colors.text, fontSize: 18, fontWeight: '900' },
  formSubtitle: { marginTop: 2, color: THEME.colors.textSecondary, fontSize: 11 },
  headerSave: { minWidth: 55, padding: 10, alignItems: 'center' },
  headerSaveText: { color: THEME.colors.primary, fontWeight: '900' },
  formContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 18, paddingBottom: 60 },
  label: { marginTop: 13, marginBottom: 7, color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#FFF', color: THEME.colors.text },
  contentInput: { minHeight: 150, paddingTop: 13, textAlignVertical: 'top' },
  helper: { marginTop: 7, color: THEME.colors.textMuted, fontSize: 11, lineHeight: 16 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minWidth: 92, minHeight: 42, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  choiceActive: { borderColor: THEME.colors.primary, backgroundColor: '#F3E8FF' },
  choiceText: { color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' },
  choiceTextActive: { color: THEME.colors.primary },
  variablePreview: { marginTop: 12, padding: 13, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border },
  variablePreviewTitle: { color: THEME.colors.text, fontSize: 12, fontWeight: '800' },
  formError: { marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: '#FEF2F2', color: '#B91C1C', lineHeight: 19 },
});
