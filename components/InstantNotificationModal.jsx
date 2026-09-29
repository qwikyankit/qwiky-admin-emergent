import React, { useEffect, useState } from 'react';
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
import { createNotificationCampaign, getErrorMessage } from '../services/api';
import { THEME } from '../constants/theme';
import { CORE_JAIPUR_PIN_CODES } from '../constants/jaipurPinCodes';
import PincodeSelector from './PincodeSelector';

export default function InstantNotificationModal({
  visible,
  onClose,
  onSent,
  showToast,
}) {
  const [pinCodes, setPinCodes] = useState(CORE_JAIPUR_PIN_CODES);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPinCodes(CORE_JAIPUR_PIN_CODES);
    setTitle('');
    setDescription('');
    setError('');
  }, [visible]);

  const send = async () => {
    if (!pinCodes.length) {
      setError('Enter at least one PIN code.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!description.trim()) {
      setError('Description is required.');
      return;
    }

    try {
      setSending(true);
      setError('');
      await createNotificationCampaign({
        campaignName: title.trim() || 'Generic push notification',
        templateCode: 'GENERIC_PUSH',
        channel: 'PUSH',
        targetType: 'PIN_CODE',
        criteriaOperator: 'AND',
        pinCodes,
        scheduleEntries: [{
          entryName: 'Instant notification',
          data: { title: title.trim(), description: description.trim() },
          scheduledAt: new Date(Date.now() + 5000).toISOString(),
          frequencyType: 'ONCE',
          timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata') === 'Asia/Calcutta' ? 'Asia/Kolkata' : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'),
          attachments: [],
        }],
      });
      showToast('Instant notification submitted successfully.', 'success');
      onClose();
      await onSent();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton} accessibilityLabel="Close instant notification">
            <Ionicons name="close" size={24} color={THEME.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Instant Generic Push</Text>
            <Text style={styles.subtitle}>Send immediately to selected PIN codes</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.templateBadge}>
            <Ionicons name="notifications" size={17} color={THEME.colors.primary} />
            <Text style={styles.templateBadgeText}>GENERIC_PUSH · PUSH</Text>
          </View>

          <Text style={styles.label}>PIN codes</Text>
          <PincodeSelector selectedPinCodes={pinCodes} onChange={setPinCodes} />

          <Text style={styles.label}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Notification title"
            maxLength={255}
            style={styles.input}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Notification description"
            multiline
            style={[styles.input, styles.descriptionInput]}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity onPress={send} disabled={sending} style={[styles.sendButton, sending && styles.disabledButton]}>
            {sending ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="send" size={18} color="#FFF" />
                <Text style={styles.sendButtonText}>Send Instant Notification</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { minHeight: 70, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 5 },
  title: { color: THEME.colors.text, fontSize: 19, fontWeight: '900' },
  subtitle: { marginTop: 2, color: THEME.colors.textSecondary, fontSize: 11 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 18, paddingBottom: 42 },
  templateBadge: { alignSelf: 'flex-start', marginBottom: 18, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, backgroundColor: '#F3E8FF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  templateBadgeText: { color: THEME.colors.primary, fontSize: 11, fontWeight: '900' },
  label: { marginTop: 13, marginBottom: 7, color: THEME.colors.text, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 46, paddingHorizontal: 13, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 10, backgroundColor: '#FFF', color: THEME.colors.text },
  descriptionInput: { minHeight: 120, paddingTop: 12, textAlignVertical: 'top' },
  helper: { marginTop: 5, color: THEME.colors.textMuted, fontSize: 10 },
  error: { marginTop: 14, color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  sendButton: { minHeight: 50, marginTop: 22, borderRadius: 11, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  disabledButton: { opacity: 0.65 },
  sendButtonText: { color: '#FFF', fontWeight: '900' },
});
