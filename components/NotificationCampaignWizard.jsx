import React, { useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { THEME } from '../constants/theme';
import { CORE_JAIPUR_PIN_CODES } from '../constants/jaipurPinCodes';
import {
  createNotificationCampaign,
  getErrorMessage,
  updateNotificationCampaign,
} from '../services/api';
import PincodeSelector from './PincodeSelector';
import {
  extractTemplateVariables,
  FREQUENCY_TYPES,
  nextSuggestedSchedule,
  splitValues,
  TARGET_TYPES,
} from '../utils/notifications';

const USER_CONTEXT_VARIABLES = new Set(['userId', 'userName', 'name', 'email', 'mobileNumber']);
const timezone = () => {
  const value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  return value === 'Asia/Calcutta' ? 'Asia/Kolkata' : value;
};

const emptyAttachment = () => ({
  fileName: '', contentType: '', storageKey: '', fileSize: '', checksum: '',
});

const templateDataDefaults = template => {
  if (template?.templateCode === 'GENERIC_PUSH' && template?.channel === 'PUSH') {
    return { title: '', description: '' };
  }
  const variables = extractTemplateVariables(`${template?.subject || ''} ${template?.content || ''}`);
  return Object.fromEntries(
    variables.filter(variable => !USER_CONTEXT_VARIABLES.has(variable)).map(variable => [variable, '']),
  );
};

let entrySequence = 0;
const newEntry = (index = 1, template = null) => ({
  clientKey: `new-entry-${Date.now()}-${entrySequence += 1}`,
  id: null,
  entryName: `Notification ${index}`,
  scheduledAt: nextSuggestedSchedule(),
  frequencyType: 'ONCE',
  frequencyExpression: '',
  timezone: timezone(),
  endAt: '',
  data: JSON.stringify(templateDataDefaults(template), null, 2),
  attachments: [],
  status: 'SCHEDULED',
});

const initialForm = () => ({
  campaignName: '',
  templateCode: 'GENERIC_PUSH',
  channel: 'PUSH',
  targetType: 'PIN_CODE',
  criteriaOperator: 'AND',
  userId: '',
  emails: '',
  deviceIds: '',
  tokenIds: '',
  pinCodes: CORE_JAIPUR_PIN_CODES.join(','),
  city: '',
  state: '',
  scheduleEntries: [newEntry(1, { templateCode: 'GENERIC_PUSH', channel: 'PUSH' })],
});

const valuesString = value => {
  if (Array.isArray(value)) return value.join(',');
  return value == null ? '' : String(value);
};

const normalizeEntry = (entry, index) => ({
  clientKey: entry.id || `existing-entry-${index}`,
  id: entry.id || null,
  entryName: entry.entryName || `Notification ${index + 1}`,
  scheduledAt: entry.scheduledAt || entry.nextRunAt || nextSuggestedSchedule(),
  frequencyType: entry.frequencyType || 'ONCE',
  frequencyExpression: entry.frequencyExpression || '',
  timezone: entry.timezone || timezone(),
  endAt: entry.endAt || '',
  data: JSON.stringify(entry.data || {}, null, 2),
  attachments: (entry.attachments || []).map(attachment => ({
    ...emptyAttachment(),
    ...attachment,
    fileSize: attachment.fileSize == null ? '' : String(attachment.fileSize),
  })),
  status: entry.status || 'SCHEDULED',
  revision: entry.revision,
});

const campaignForm = (campaign, addEntry = false) => {
  const sourceEntries = campaign.scheduleEntries?.length
    ? campaign.scheduleEntries
    : [{
        entryName: 'Notification 1',
        scheduledAt: campaign.scheduledAt || campaign.nextRunAt,
        frequencyType: campaign.frequencyType,
        frequencyExpression: campaign.frequencyExpression,
        timezone: campaign.timezone,
        endAt: campaign.endAt,
        data: campaign.data,
        attachments: campaign.attachments,
        status: campaign.status,
      }];
  const scheduleEntries = sourceEntries.map(normalizeEntry);
  if (addEntry) scheduleEntries.push(newEntry(scheduleEntries.length + 1));
  return {
    campaignName: campaign.campaignName || '',
    templateCode: campaign.templateCode || 'GENERIC_PUSH',
    channel: campaign.channel || 'PUSH',
    targetType: campaign.targetType || 'PIN_CODE',
    criteriaOperator: campaign.criteriaOperator || campaign.targetCriteria?.criteriaOperator || 'AND',
    userId: campaign.userId || '',
    emails: valuesString(campaign.emails),
    deviceIds: valuesString(campaign.deviceIds),
    tokenIds: valuesString(campaign.tokenIds),
    pinCodes: valuesString(campaign.pinCodes || campaign.pinCode || campaign.targetCriteria?.pinCodes),
    city: campaign.targetCriteria?.city || '',
    state: campaign.targetCriteria?.state || '',
    scheduleEntries,
  };
};

const isImmutableEntry = entry => ['COMPLETED', 'INACTIVE'].includes(entry.status);

const validDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(Date.now() + 10 * 60 * 1000) : date;
};

const toLocalInputValue = value => {
  if (!value) return '';
  const date = validDate(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

function IsoDateTimeField({ value, onChange, label, optional = false, disabled = false }) {
  const [pickerMode, setPickerMode] = useState(null);
  const [draftDate, setDraftDate] = useState(null);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webDateInputShell, disabled && styles.disabledField]}>
        <input aria-label={label} disabled={disabled} type="datetime-local" value={toLocalInputValue(value)} onChange={event => onChange(event.target.value ? new Date(event.target.value).toISOString() : '')} style={styles.webDateInput} />
        {optional && value && !disabled ? <TouchableOpacity onPress={() => onChange('')} style={styles.clearDateButton}><Ionicons name="close-circle" size={19} color={THEME.colors.textMuted} /></TouchableOpacity> : null}
      </View>
    );
  }

  const selectedDate = draftDate || validDate(value);
  const handlePickerChange = (event, nextDate) => {
    if (event.type === 'dismissed' || !nextDate) {
      setPickerMode(null);
      setDraftDate(null);
      return;
    }
    if (Platform.OS === 'android' && pickerMode === 'date') {
      const current = validDate(value);
      setDraftDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate(), current.getHours(), current.getMinutes()));
      setPickerMode('time');
      return;
    }
    const completed = Platform.OS === 'android' && draftDate
      ? new Date(draftDate.getFullYear(), draftDate.getMonth(), draftDate.getDate(), nextDate.getHours(), nextDate.getMinutes())
      : nextDate;
    onChange(completed.toISOString());
    setPickerMode(null);
    setDraftDate(null);
  };

  return (
    <>
      <TouchableOpacity disabled={disabled} onPress={() => setPickerMode(Platform.OS === 'android' ? 'date' : 'datetime')} style={[styles.dateButton, disabled && styles.disabledField]}>
        <Ionicons name="calendar-outline" size={19} color={THEME.colors.primary} />
        <Text style={[styles.dateButtonText, !value && styles.datePlaceholder]}>{value ? validDate(value).toLocaleString() : 'Select date and time'}</Text>
        {optional && value && !disabled ? <TouchableOpacity onPress={() => onChange('')} style={styles.clearDateButton}><Ionicons name="close-circle" size={19} color={THEME.colors.textMuted} /></TouchableOpacity> : null}
      </TouchableOpacity>
      {pickerMode && <DateTimePicker value={selectedDate} mode={pickerMode} minimumDate={new Date()} onChange={handlePickerChange} />}
    </>
  );
}

const fieldForTarget = targetType => ({ USER: 'userId', EMAIL: 'emails', DEVICE_IDS: 'deviceIds', TOKEN_IDS: 'tokenIds' }[targetType] || null);
const labelForTarget = targetType => ({ USER: 'User ID', EMAIL: 'Email recipients', DEVICE_IDS: 'Device IDs', TOKEN_IDS: 'Token IDs' }[targetType] || '');

export default function NotificationCampaignWizard({ visible, templates, onClose, onCreated, showToast, campaign = null, mode = 'create' }) {
  const editing = ['edit', 'add-entry'].includes(mode) && Boolean(campaign?.id);
  const addingEntry = mode === 'add-entry';
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [impactConfirmed, setImpactConfirmed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setForm(editing ? campaignForm(campaign, addingEntry) : initialForm());
    setStep(1);
    setError('');
    setImpactConfirmed(false);
  }, [addingEntry, campaign, editing, visible]);

  const activeTemplates = useMemo(() => templates.filter(template => template.status === 'ACTIVE'), [templates]);
  const selectedTemplate = templates.find(template => template.templateCode === form.templateCode && template.channel === form.channel);
  const isGenericPush = form.templateCode === 'GENERIC_PUSH' && form.channel === 'PUSH';
  const variables = selectedTemplate ? extractTemplateVariables(`${selectedTemplate.subject || ''} ${selectedTemplate.content || ''}`) : [];

  const change = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
    setError('');
    if (['targetType', 'criteriaOperator'].includes(field)) setImpactConfirmed(false);
  };

  const updateEntry = (index, patch) => {
    setForm(current => ({ ...current, scheduleEntries: current.scheduleEntries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry) }));
    setError('');
  };

  const selectTemplate = template => {
    setForm(current => ({
      ...current,
      templateCode: template.templateCode,
      channel: template.channel,
      targetType: template.channel === 'EMAIL' ? 'EMAIL' : template.templateCode === 'GENERIC_PUSH' && template.channel === 'PUSH' ? 'PIN_CODE' : current.targetType === 'EMAIL' ? 'USER' : current.targetType,
      scheduleEntries: current.scheduleEntries.map(entry => isImmutableEntry(entry) ? entry : { ...entry, data: JSON.stringify(templateDataDefaults(template), null, 2), attachments: template.channel === 'EMAIL' ? entry.attachments : [] }),
    }));
    setError('');
    setImpactConfirmed(false);
  };

  const allowedTargets = TARGET_TYPES.filter(targetType => {
    if (form.channel === 'EMAIL') return ['USER', 'EMAIL', 'PIN_CODE', 'ADDRESS'].includes(targetType);
    if (form.channel === 'PUSH') return targetType !== 'EMAIL';
    if (form.channel === 'SMS') return ['USER', 'PIN_CODE', 'ADDRESS'].includes(targetType);
    return true;
  });

  const validateTarget = () => {
    if (!selectedTemplate || selectedTemplate.status !== 'ACTIVE') return 'Select an active template.';
    const targetField = fieldForTarget(form.targetType);
    if (targetField === 'userId' && !form.userId.trim()) return 'User ID is required.';
    if (targetField && targetField !== 'userId' && !splitValues(form[targetField]).length) return `${labelForTarget(form.targetType)} are required.`;
    if (form.targetType === 'PIN_CODE' && !splitValues(form.pinCodes).length) return 'Select at least one PIN code.';
    if (form.targetType === 'ADDRESS' && !splitValues(form.pinCodes).length && !form.city.trim() && !form.state.trim()) return 'Enter at least one address filter.';
    return null;
  };

  const parseEntryData = entry => {
    try {
      const value = JSON.parse(entry.data || '{}');
      return value && !Array.isArray(value) && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  };

  const validateEntries = () => {
    if (!form.scheduleEntries.length) return 'Add at least one schedule entry.';
    const names = new Set();
    for (let index = 0; index < form.scheduleEntries.length; index += 1) {
      const entry = form.scheduleEntries[index];
      const label = `Entry ${index + 1}`;
      if (!entry.entryName.trim()) return `${label} name is required.`;
      const normalizedName = entry.entryName.trim().toLowerCase();
      if (names.has(normalizedName)) return 'Schedule entry names must be unique within the campaign.';
      names.add(normalizedName);
      if (isImmutableEntry(entry)) continue;
      const scheduled = Date.parse(entry.scheduledAt);
      if (Number.isNaN(scheduled)) return `${label} needs a valid scheduled time.`;
      if (scheduled < Date.now() - 60000) return `${label} must be scheduled now or in the future.`;
      if (!entry.timezone.trim()) return `${label} timezone is required.`;
      if (entry.frequencyType === 'CRON' && !entry.frequencyExpression.trim()) return `${label} requires a six-field Spring cron expression.`;
      if (entry.endAt) {
        const end = Date.parse(entry.endAt);
        if (Number.isNaN(end) || end < scheduled) return `${label} end time cannot be before its scheduled time.`;
      }
      const data = parseEntryData(entry);
      if (!data) return `${label} data must be a JSON object.`;
      const unresolved = variables.filter(variable => (data[variable] == null || String(data[variable]).trim() === '') && !(['USER', 'PIN_CODE', 'ADDRESS'].includes(form.targetType) && USER_CONTEXT_VARIABLES.has(variable)));
      if (unresolved.length) return `${label} is missing template data for: ${unresolved.join(', ')}.`;
      if (isGenericPush && (!String(data.title || '').trim() || !String(data.description || '').trim())) return `${label} requires a title and description.`;
      for (const attachment of entry.attachments) {
        if (!attachment.fileName.trim() || !attachment.contentType.trim() || !attachment.storageKey.trim()) return `${label} attachments need a file name, content type, and storage key.`;
      }
    }
    if (!impactConfirmed) return 'Review and confirm the targeting impact before saving the campaign.';
    return null;
  };

  const goNext = () => {
    const validationError = validateTarget();
    if (validationError) return setError(validationError);
    setStep(2);
    setError('');
  };

  const buildEntryPayload = entry => ({
    ...(entry.id ? { id: entry.id } : {}),
    entryName: entry.entryName.trim(),
    scheduledAt: entry.scheduledAt,
    frequencyType: entry.frequencyType,
    ...(entry.frequencyType === 'CRON' ? { frequencyExpression: entry.frequencyExpression.trim() } : {}),
    timezone: entry.timezone.trim(),
    ...(entry.endAt ? { endAt: entry.endAt } : {}),
    data: JSON.parse(entry.data || '{}'),
    attachments: entry.attachments.map(attachment => ({
      fileName: attachment.fileName.trim(),
      contentType: attachment.contentType.trim(),
      storageKey: attachment.storageKey.trim(),
      ...(attachment.fileSize ? { fileSize: Number(attachment.fileSize) } : {}),
      ...(attachment.checksum.trim() ? { checksum: attachment.checksum.trim() } : {}),
    })),
  });

  const buildPayload = () => {
    const payload = {
      campaignName: form.campaignName.trim() || form.templateCode,
      templateCode: form.templateCode,
      channel: form.channel,
      targetType: form.targetType,
      criteriaOperator: form.criteriaOperator,
      scheduleEntries: form.scheduleEntries.map(buildEntryPayload),
    };
    if (form.targetType === 'USER') payload.userId = form.userId.trim();
    if (form.targetType === 'EMAIL') payload.emails = splitValues(form.emails);
    if (form.targetType === 'DEVICE_IDS') payload.deviceIds = splitValues(form.deviceIds);
    if (form.targetType === 'TOKEN_IDS') payload.tokenIds = splitValues(form.tokenIds);
    if (form.targetType === 'PIN_CODE') payload.pinCodes = splitValues(form.pinCodes);
    if (['PIN_CODE', 'ADDRESS'].includes(form.targetType)) {
      payload.criteriaOperator = form.criteriaOperator;
      const targetCriteria = {
        criteriaOperator: form.criteriaOperator,
        ...(splitValues(form.pinCodes).length ? { pinCodes: splitValues(form.pinCodes) } : {}),
        ...(form.city.trim() ? { city: form.city.trim() } : {}),
        ...(form.state.trim() ? { state: form.state.trim() } : {}),
      };
      if (form.targetType === 'ADDRESS' || form.city.trim() || form.state.trim()) payload.targetCriteria = targetCriteria;
    }
    return payload;
  };

  const save = async () => {
    const validationError = validateEntries();
    if (validationError) return setError(validationError);
    try {
      setSaving(true);
      if (editing) await updateNotificationCampaign(campaign.id, buildPayload());
      else await createNotificationCampaign(buildPayload());
      showToast(editing ? 'Notification campaign updated successfully.' : 'Notification campaign scheduled successfully.', 'success');
      onClose();
      await onCreated();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const addEntry = () => {
    setForm(current => ({ ...current, scheduleEntries: [...current.scheduleEntries, newEntry(current.scheduleEntries.length + 1, selectedTemplate)] }));
    setError('');
  };

  const removeEntry = index => {
    setForm(current => ({ ...current, scheduleEntries: current.scheduleEntries.filter((_, entryIndex) => entryIndex !== index) }));
    setError('');
  };

  const updateEntryDataField = (index, field, value) => {
    const data = parseEntryData(form.scheduleEntries[index]) || {};
    updateEntry(index, { data: JSON.stringify({ ...data, [field]: value }, null, 2) });
  };

  const addAttachment = index => updateEntry(index, { attachments: [...form.scheduleEntries[index].attachments, emptyAttachment()] });
  const updateAttachment = (entryIndex, attachmentIndex, field, value) => updateEntry(entryIndex, { attachments: form.scheduleEntries[entryIndex].attachments.map((attachment, index) => index === attachmentIndex ? { ...attachment, [field]: value } : attachment) });
  const removeAttachment = (entryIndex, attachmentIndex) => updateEntry(entryIndex, { attachments: form.scheduleEntries[entryIndex].attachments.filter((_, index) => index !== attachmentIndex) });

  const targetField = fieldForTarget(form.targetType);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving} style={styles.iconButton}><Ionicons name="close" size={25} color={THEME.colors.text} /></TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{addingEntry ? 'Add Campaign Time' : editing ? 'Edit Campaign' : 'Create New Notification'}</Text>
            <Text style={styles.subtitle}>Campaign definition · Step {step} of 2</Text>
          </View>
          <View style={styles.stepPills}>
            <View style={[styles.stepPill, styles.stepPillActive]}><Text style={styles.stepPillText}>1</Text></View>
            <View style={styles.stepLine} />
            <View style={[styles.stepPill, step === 2 && styles.stepPillActive]}><Text style={[styles.stepPillText, step !== 2 && styles.stepPillTextMuted]}>2</Text></View>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 1 ? (
            <>
              <Text style={styles.sectionTitle}>Campaign details</Text>
              <Text style={styles.label}>Campaign name</Text>
              <TextInput value={form.campaignName} onChangeText={value => change('campaignName', value)} placeholder="Shown in the calendar" style={styles.input} />

              <Text style={styles.sectionTitle}>Template and channel</Text>
              <Text style={styles.sectionHint}>Only active templates can be selected.</Text>
              <View style={styles.templateGrid}>
                {activeTemplates.map(template => {
                  const selected = selectedTemplate?.templateCode === template.templateCode && selectedTemplate?.channel === template.channel;
                  return <TouchableOpacity key={template.id || `${template.channel}:${template.templateCode}`} onPress={() => selectTemplate(template)} style={[styles.templateChoice, selected && styles.templateChoiceActive]}><Text style={[styles.templateChannel, selected && styles.selectedText]}>{template.channel}</Text><Text style={styles.templateName}>{template.name}</Text><Text style={styles.templateCode}>{template.templateCode}</Text></TouchableOpacity>;
                })}
              </View>

              <Text style={styles.sectionTitle}>Recipient target</Text>
              <View style={styles.choiceRow}>
                {allowedTargets.map(item => <TouchableOpacity key={item} onPress={() => change('targetType', item)} style={[styles.choice, form.targetType === item && styles.choiceActive]}><Text style={[styles.choiceText, form.targetType === item && styles.choiceTextActive]}>{item.replace('_', ' ')}</Text></TouchableOpacity>)}
              </View>

              {targetField && <><Text style={styles.label}>{labelForTarget(form.targetType)}</Text><TextInput value={form[targetField]} onChangeText={value => change(targetField, value)} multiline={targetField !== 'userId'} placeholder={targetField === 'userId' ? 'User UUID' : 'Enter one per line or separate with commas'} style={[styles.input, targetField !== 'userId' && styles.listInput]} /></>}

              {['PIN_CODE', 'ADDRESS'].includes(form.targetType) && <><Text style={styles.label}>{form.targetType === 'ADDRESS' ? 'PIN codes (optional)' : 'PIN codes'}</Text><PincodeSelector selectedPinCodes={splitValues(form.pinCodes)} onChange={values => change('pinCodes', values.join(','))} /><Text style={styles.label}>Criteria operator</Text><View style={styles.choiceRow}>{['AND', 'OR'].map(item => <TouchableOpacity key={item} onPress={() => change('criteriaOperator', item)} style={[styles.choice, form.criteriaOperator === item && styles.choiceActive]}><Text style={[styles.choiceText, form.criteriaOperator === item && styles.choiceTextActive]}>{item}</Text></TouchableOpacity>)}</View><View style={styles.twoColumn}><View style={styles.fieldColumn}><Text style={styles.label}>City (optional)</Text><TextInput value={form.city} onChangeText={value => change('city', value)} placeholder="Jaipur" style={styles.input} /></View><View style={styles.fieldColumn}><Text style={styles.label}>State (optional)</Text><TextInput value={form.state} onChangeText={value => change('state', value)} placeholder="Rajasthan" style={styles.input} /></View></View></>}
            </>
          ) : (
            <>
              <View style={styles.entriesHeader}><View style={styles.fieldColumn}><Text style={styles.sectionTitle}>Schedule entries</Text><Text style={styles.sectionHint}>Each entry can have different timing, recurrence, content, and attachments.</Text></View><TouchableOpacity onPress={addEntry} style={styles.addEntryButton}><Ionicons name="add" size={18} color={THEME.colors.primary} /><Text style={styles.addEntryText}>Add entry</Text></TouchableOpacity></View>

              {form.scheduleEntries.map((entry, index) => {
                const immutable = isImmutableEntry(entry);
                const data = parseEntryData(entry) || {};
                return (
                  <View key={entry.clientKey} style={styles.entryCard}>
                    <View style={styles.entryHeader}><Text style={styles.entryNumber}>Entry {index + 1}</Text>{immutable && <View style={styles.lockedBadge}><Ionicons name="lock-closed" size={12} color="#64748B" /><Text style={styles.lockedText}>{entry.status}</Text></View>}{!immutable && form.scheduleEntries.length > 1 && <TouchableOpacity onPress={() => removeEntry(index)} style={styles.removeButton}><Ionicons name="trash-outline" size={18} color="#B91C1C" /></TouchableOpacity>}</View>
                    {immutable && <Text style={styles.immutableHint}>Completed and processing entries are historical and cannot be changed.</Text>}
                    <Text style={styles.label}>Scheduled at</Text><IsoDateTimeField disabled={immutable} value={entry.scheduledAt} onChange={value => updateEntry(index, { scheduledAt: value })} label={`Entry ${index + 1} scheduled at`} />
                    <Text style={styles.label}>Frequency</Text><View style={styles.choiceRow}>{FREQUENCY_TYPES.map(item => <TouchableOpacity disabled={immutable} key={item} onPress={() => updateEntry(index, { frequencyType: item })} style={[styles.choice, entry.frequencyType === item && styles.choiceActive, immutable && styles.disabledField]}><Text style={[styles.choiceText, entry.frequencyType === item && styles.choiceTextActive]}>{item}</Text></TouchableOpacity>)}</View>
                    {entry.frequencyType === 'CRON' && <><Text style={styles.label}>Spring cron expression</Text><TextInput editable={!immutable} value={entry.frequencyExpression} onChangeText={value => updateEntry(index, { frequencyExpression: value })} placeholder="0 0 9 * * *" style={[styles.input, immutable && styles.disabledField]} /></>}
                    <Text style={styles.label}>IANA timezone</Text><TextInput editable={!immutable} value={entry.timezone} onChangeText={value => updateEntry(index, { timezone: value })} placeholder="Asia/Kolkata" autoCapitalize="none" style={[styles.input, immutable && styles.disabledField]} />
                    <Text style={styles.label}>End at (optional)</Text><IsoDateTimeField disabled={immutable} value={entry.endAt} onChange={value => updateEntry(index, { endAt: value })} label={`Entry ${index + 1} end at`} optional />

                    <Text style={styles.sectionTitle}>Entry content</Text>
                    {isGenericPush ? <><Text style={styles.label}>Title</Text><TextInput editable={!immutable} value={data.title || ''} onChangeText={value => updateEntryDataField(index, 'title', value)} placeholder="Notification title" style={[styles.input, immutable && styles.disabledField]} /><Text style={styles.label}>Description</Text><TextInput editable={!immutable} value={data.description || ''} onChangeText={value => updateEntryDataField(index, 'description', value)} placeholder="Notification description" multiline style={[styles.input, styles.descriptionInput, immutable && styles.disabledField]} /></> : <><Text style={styles.sectionHint}>Provide all non-user variables required by the selected template.</Text><TextInput editable={!immutable} value={entry.data} onChangeText={value => updateEntry(index, { data: value })} multiline autoCapitalize="none" autoCorrect={false} placeholder={JSON.stringify(templateDataDefaults(selectedTemplate), null, 2)} style={[styles.input, styles.jsonInput, immutable && styles.disabledField]} /></>}

                    {form.channel === 'EMAIL' && <View style={styles.attachmentsSection}><View style={styles.attachmentHeader}><Text style={styles.sectionTitle}>Attachments</Text>{!immutable && <TouchableOpacity onPress={() => addAttachment(index)} style={styles.addEntryButton}><Ionicons name="add" size={18} color={THEME.colors.primary} /><Text style={styles.addEntryText}>Add</Text></TouchableOpacity>}</View>{entry.attachments.map((attachment, attachmentIndex) => <View key={`${entry.clientKey}-attachment-${attachmentIndex}`} style={styles.attachmentCard}>{!immutable && <TouchableOpacity onPress={() => removeAttachment(index, attachmentIndex)} style={styles.attachmentRemove}><Ionicons name="trash-outline" size={18} color="#B91C1C" /></TouchableOpacity>}{['fileName', 'contentType', 'storageKey', 'fileSize', 'checksum'].map(field => <TextInput key={field} editable={!immutable} value={attachment[field]} onChangeText={value => updateAttachment(index, attachmentIndex, field, value)} placeholder={field} style={[styles.input, styles.attachmentInput, immutable && styles.disabledField]} />)}</View>)}</View>}
                  </View>
                );
              })}

              <View style={styles.warning}><Ionicons name="information-circle-outline" size={19} color="#B45309" /><Text style={styles.warningText}>Changing target, content, or schedule affects future materialization only. Sent notifications and history remain unchanged.</Text></View>
              <TouchableOpacity onPress={() => setImpactConfirmed(value => !value)} style={[styles.confirmationRow, impactConfirmed && styles.confirmationRowActive]}><Ionicons name={impactConfirmed ? 'checkbox' : 'square-outline'} size={23} color={impactConfirmed ? THEME.colors.primary : THEME.colors.textMuted} /><Text style={styles.confirmationText}>I reviewed the target and all {form.scheduleEntries.length} schedule entries.</Text></TouchableOpacity>
            </>
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>{step === 2 && <TouchableOpacity onPress={() => { setStep(1); setError(''); }} disabled={saving} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Back</Text></TouchableOpacity>}<TouchableOpacity onPress={step === 1 ? goNext : save} disabled={saving || (step === 1 && !activeTemplates.length)} style={[styles.submitButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitButtonText}>{step === 1 ? 'Configure Times' : editing ? 'Update Campaign' : 'Create Campaign'}</Text>}</TouchableOpacity></View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: THEME.colors.background },
  header: { minHeight: 68, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 8 },
  headerCopy: { flex: 1, marginLeft: 5 },
  title: { color: THEME.colors.text, fontSize: 19, fontWeight: '900' },
  subtitle: { marginTop: 2, color: THEME.colors.textSecondary, fontSize: 11 },
  stepPills: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  stepPill: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  stepPillActive: { backgroundColor: THEME.colors.primary }, stepPillText: { color: '#FFF', fontSize: 11, fontWeight: '900' }, stepPillTextMuted: { color: '#64748B' }, stepLine: { width: 20, height: 2, backgroundColor: '#CBD5E1' },
  content: { width: '100%', maxWidth: 880, alignSelf: 'center', padding: 18, paddingBottom: 45 },
  sectionTitle: { marginTop: 14, color: THEME.colors.text, fontSize: 17, fontWeight: '900' }, sectionHint: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 11, lineHeight: 16 }, label: { marginTop: 14, marginBottom: 7, color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#FFF', color: THEME.colors.text }, listInput: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' }, descriptionInput: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }, jsonInput: { minHeight: 125, paddingTop: 12, textAlignVertical: 'top', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }, disabledField: { opacity: 0.62, backgroundColor: '#F1F5F9' },
  templateGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, templateChoice: { flexGrow: 1, flexBasis: 230, minHeight: 96, padding: 13, borderRadius: 13, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF' }, templateChoiceActive: { borderColor: THEME.colors.primary, backgroundColor: '#FAF5FF' }, templateChannel: { color: THEME.colors.textSecondary, fontSize: 10, fontWeight: '900' }, selectedText: { color: THEME.colors.primary }, templateName: { marginTop: 9, color: THEME.colors.text, fontWeight: '800' }, templateCode: { marginTop: 3, color: THEME.colors.textMuted, fontSize: 10 },
  choiceRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { minHeight: 40, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' }, choiceActive: { borderColor: THEME.colors.primary, backgroundColor: '#F3E8FF' }, choiceText: { color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '800' }, choiceTextActive: { color: THEME.colors.primary },
  twoColumn: { flexDirection: 'row', gap: 10 }, fieldColumn: { flex: 1 }, webDateInputShell: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' }, webDateInput: { flex: 1, width: '100%', minHeight: 44, border: 0, backgroundColor: 'transparent', color: THEME.colors.text, fontSize: 14 }, clearDateButton: { padding: 5 }, dateButton: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', gap: 9 }, dateButtonText: { flex: 1, color: THEME.colors.text, fontSize: 14 }, datePlaceholder: { color: THEME.colors.textMuted },
  entriesHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, addEntryButton: { minHeight: 38, paddingHorizontal: 11, borderRadius: 9, backgroundColor: '#F3E8FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, addEntryText: { color: THEME.colors.primary, fontSize: 10, fontWeight: '900' }, entryCard: { marginTop: 14, padding: 15, borderWidth: 1, borderColor: '#DDE3EC', borderRadius: 15, backgroundColor: '#FFF' }, entryHeader: { flexDirection: 'row', alignItems: 'center' }, entryNumber: { flex: 1, color: THEME.colors.text, fontSize: 14, fontWeight: '900' }, removeButton: { padding: 7 }, lockedBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 4 }, lockedText: { color: '#64748B', fontSize: 9, fontWeight: '900' }, immutableHint: { marginTop: 8, color: '#64748B', fontSize: 10, lineHeight: 14 },
  attachmentsSection: { marginTop: 8 }, attachmentHeader: { flexDirection: 'row', alignItems: 'center' }, attachmentCard: { marginTop: 10, padding: 10, borderRadius: 11, backgroundColor: '#F8FAFC' }, attachmentInput: { marginTop: 8 }, attachmentRemove: { alignSelf: 'flex-end', padding: 4 },
  warning: { marginTop: 16, padding: 13, borderRadius: 12, backgroundColor: '#FFFBEB', flexDirection: 'row', gap: 8 }, warningText: { flex: 1, color: '#92400E', fontSize: 11, lineHeight: 16 }, confirmationRow: { marginTop: 14, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', gap: 9 }, confirmationRowActive: { borderColor: THEME.colors.primary, backgroundColor: '#FAF5FF' }, confirmationText: { flex: 1, color: THEME.colors.textSecondary, fontSize: 11, lineHeight: 16 }, error: { marginTop: 13, color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  footer: { minHeight: 72, padding: 12, borderTopWidth: 1, borderTopColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }, secondaryButton: { minWidth: 100, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: THEME.colors.border, alignItems: 'center', justifyContent: 'center' }, secondaryButtonText: { color: THEME.colors.textSecondary, fontWeight: '800' }, submitButton: { minWidth: 170, minHeight: 46, paddingHorizontal: 18, borderRadius: 10, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' }, submitButtonText: { color: '#FFF', fontWeight: '900' }, disabled: { opacity: 0.55 },
});
