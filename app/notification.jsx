import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import NotificationPlanner from '../components/NotificationPlanner';
import NotificationTemplateManager from '../components/NotificationTemplateManager';
import Toast from '../components/Toast';
import { THEME } from '../constants/theme';
import {
  fetchNotificationCampaigns,
  fetchNotificationTemplates,
  getErrorMessage,
} from '../services/api';
import { unwrapList } from '../utils/notifications';

export default function Notifications() {
  const router = useRouter();
  const [tab, setTab] = useState('planner');
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const showToast = (message, type = 'info') =>
    setToast({ visible: true, message, type });

  const loadNotificationData = useCallback(async () => {
    try {
      setLoading(true);
      const [templateData, campaignData] = await Promise.all([
        fetchNotificationTemplates(),
        fetchNotificationCampaigns(),
      ]);
      setTemplates(unwrapList(templateData));
      setCampaigns(unwrapList(campaignData));
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotificationData();
  }, [loadNotificationData]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast {...toast} onHide={() => setToast(current => ({ ...current, visible: false }))} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.iconButton} accessibilityLabel="Go to home">
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>Templates and campaign scheduling</Text>
        </View>
      </View>

      <View style={styles.tabsShell}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <TouchableOpacity onPress={() => setTab('planner')} style={[styles.tab, tab === 'planner' && styles.tabActive]}>
            <Ionicons name="calendar-outline" size={18} color={tab === 'planner' ? '#FFF' : THEME.colors.textSecondary} />
            <Text style={[styles.tabText, tab === 'planner' && styles.tabTextActive]}>Planner</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('templates')} style={[styles.tab, tab === 'templates' && styles.tabActive]}>
            <Ionicons name="document-text-outline" size={18} color={tab === 'templates' ? '#FFF' : THEME.colors.textSecondary} />
            <Text style={[styles.tabText, tab === 'templates' && styles.tabTextActive]}>Templates</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {tab === 'planner' ? (
        <NotificationPlanner
          campaigns={campaigns}
          templates={templates}
          loading={loading}
          onRefresh={loadNotificationData}
          showToast={showToast}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.templateScroll}>
          <NotificationTemplateManager
            templates={templates}
            campaigns={campaigns}
            loading={loading}
            onRefresh={loadNotificationData}
            showToast={showToast}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { minHeight: 62, paddingHorizontal: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 8 },
  headerCopy: { flex: 1, marginLeft: 4 },
  headerTitle: { color: THEME.colors.text, fontSize: 19, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, color: THEME.colors.textSecondary, fontSize: 11 },
  tabsShell: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  tabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: { minWidth: 120, minHeight: 40, paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabActive: { backgroundColor: THEME.colors.primary },
  tabText: { color: THEME.colors.textSecondary, fontWeight: '800' },
  tabTextActive: { color: '#FFF' },
  templateScroll: { flexGrow: 1 },
});
