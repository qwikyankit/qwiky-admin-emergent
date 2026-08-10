import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from '../components/Toast';
import THEME from '../constants/theme';
import { logout } from '../services/api';

export default function AdminSettings() {
  const router = useRouter();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/login');
    } catch {
      setToast({ visible: true, message: 'Unable to logout', type: 'error' });
    }
  };

  const cards = [
    {
      title: 'Catalog Management',
      description: 'Categories, subcategories, products and items.',
      icon: 'layers-outline',
      onPress: () => router.push('/catalog'),
    },
    {
      title: 'Hood Management',
      description: 'Create hoods and update their service, dispatch and payment configuration.',
      icon: 'map-outline',
      onPress: () => router.push('/hood-management'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(current => ({ ...current, visible: false }))}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Admin Settings</Text>
          <Text style={styles.subtitle}>System-level configuration</Text>
        </View>
        <View style={styles.placeholder} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>
          These settings apply across Qwiky and are not tied to one hood.
        </Text>
        {cards.map(card => (
          <TouchableOpacity
            key={card.title}
            disabled={card.disabled}
            onPress={card.onPress}
            style={[styles.card, card.disabled && styles.disabledCard]}
          >
            <View style={styles.icon}>
              <Ionicons name={card.icon} size={24} color={THEME.colors.primary} />
            </View>
            <View style={styles.cardCopy}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                {card.badge && <Text style={styles.badge}>{card.badge}</Text>}
              </View>
              <Text style={styles.cardDescription}>{card.description}</Text>
            </View>
            {!card.disabled && (
              <Ionicons name="chevron-forward" size={22} color={THEME.colors.textSecondary} />
            )}
          </TouchableOpacity>
        ))}
        <Text style={styles.session}>Session</Text>
        <TouchableOpacity style={styles.logout} onPress={() => setLogoutVisible(true)}>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
      <Modal visible={logoutVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Logout?</Text>
            <Text style={styles.modalText}>Are you sure you want to end this admin session?</Text>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => setLogoutVisible(false)} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleLogout} style={styles.confirm}>
                <Text style={styles.confirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  back: { padding: 8 },
  headerCopy: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: THEME.colors.text },
  subtitle: { marginTop: 2, fontSize: 12, color: THEME.colors.textSecondary },
  placeholder: { width: 40 },
  content: { padding: 16, paddingBottom: 40 },
  help: { marginBottom: 17, color: THEME.colors.textSecondary, lineHeight: 21 },
  card: { minHeight: 92, marginBottom: 12, padding: 15, borderRadius: 17, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center' },
  disabledCard: { opacity: 0.58 },
  icon: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, marginHorizontal: 13 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: THEME.colors.text },
  cardDescription: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 17 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FFF7E6', color: '#92400E', fontSize: 9, fontWeight: '800' },
  session: { marginTop: 16, marginBottom: 9, color: THEME.colors.textSecondary, fontWeight: '800' },
  logout: { height: 56, paddingHorizontal: 16, borderRadius: 15, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoutText: { color: '#DC2626', fontWeight: '800' },
  overlay: { flex: 1, padding: 22, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center' },
  modal: { width: '100%', maxWidth: 360, padding: 22, borderRadius: 20, backgroundColor: '#FFF' },
  modalTitle: { fontSize: 20, textAlign: 'center', fontWeight: '800', color: THEME.colors.text },
  modalText: { marginTop: 8, textAlign: 'center', color: THEME.colors.textSecondary },
  actions: { marginTop: 20, flexDirection: 'row', gap: 10 },
  cancel: { flex: 1, height: 44, borderRadius: 11, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: THEME.colors.textSecondary, fontWeight: '700' },
  confirm: { flex: 1, height: 44, borderRadius: 11, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#FFF', fontWeight: '800' },
});
