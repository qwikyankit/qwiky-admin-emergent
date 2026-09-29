import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { THEME } from '../constants/theme';
import { sendPushNotification } from '../services/api';

export default function DeprecatedNotification() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter title');
      return;
    }
    if (!message.trim()) {
      Alert.alert('Validation', 'Please enter message');
      return;
    }

    try {
      setLoading(true);
      await sendPushNotification({ title, message });
      Alert.alert('Success', 'Notification sent successfully');
      setTitle('');
      setMessage('');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.iconButton} accessibilityLabel="Go to home">
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Notification - Deprecated</Text>
          <Text style={styles.headerSubtitle}>Legacy OneSignal broadcast flow</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.notice}>
          This legacy flow is retained temporarily. Use Notification Plan for new scheduled campaigns.
        </Text>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter notification title"
          value={title}
          onChangeText={setTitle}
        />
        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          placeholder="Enter notification message"
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, loading && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#FFF" />
              <Text style={styles.sendButtonText}>Send Notification</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  iconButton: { padding: 6 },
  headerCopy: { flex: 1, marginLeft: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: THEME.colors.text },
  headerSubtitle: { marginTop: 2, fontSize: 11, color: THEME.colors.textSecondary },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 16 },
  notice: {
    marginBottom: 20,
    padding: 13,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    color: '#92400E',
    lineHeight: 19,
  },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: THEME.colors.text },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 20,
  },
  messageInput: { minHeight: 140, textAlignVertical: 'top' },
  sendButton: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.65 },
  sendButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
