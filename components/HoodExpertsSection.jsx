import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import THEME from '../constants/theme';

const HoodExpertsSection = ({
  hoodUsers,
  allHoods,
  selectedTargetHoods,
  handleTransferExpert,
  setSelectedUser,
  setHoodModalVisible,
  handleToggleExpertStatus,
  handleDeleteExpert
}) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons
          name="people-outline"
          size={22}
          color={THEME.colors.primary}
        />

        <Text style={styles.sectionTitle}>
          Hood Experts
        </Text>
      </View>

      {hoodUsers.map((user) => (
        <View
          key={user.userId}
          style={styles.expertCard}
        >
          <View style={styles.expertTopRow}>
            <Text style={styles.expertName}>
              {user.userName}
            </Text>

            <TouchableOpacity
  onPress={() =>
    handleToggleExpertStatus(user)
  }
  style={[
    styles.expertToggle,
    user.status === 'ACTIVE'
      ? styles.expertToggleOn
      : styles.expertToggleOff,
  ]}
>
  <View
    style={[
      styles.expertToggleThumb,
      user.status === 'ACTIVE'
        ? styles.thumbRight
        : styles.thumbLeft,
    ]}
  />
</TouchableOpacity>
          </View>

          <View style={styles.pickerWrapper}>
          <TouchableOpacity
  style={styles.selectButton}
  onPress={() => {
    setSelectedUser(user);
    setHoodModalVisible(true);
  }}
>
  <Text style={styles.selectButtonText}>
    {
      allHoods.find(
        hood =>
          hood.id ===
          selectedTargetHoods[user.userId]
      )?.name || 'Select Target Hood'
    }
  </Text>

  <Ionicons
    name="chevron-down"
    size={18}
    color="#666"
  />
</TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.transferButton}
            onPress={() =>
              handleTransferExpert(user)
            }
          >
            <Ionicons
              name="swap-horizontal"
              size={18}
              color="#FFF"
            />

            <Text
              style={styles.transferButtonText}
            >
              Transfer Expert
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
  style={styles.deleteButton}
  onPress={() =>
    handleDeleteExpert(user)
  }
>
  <Ionicons
    name="trash-outline"
    size={18}
    color="#DC2626"
  />

  <Text style={styles.deleteButtonText}>
    Delete Expert
  </Text>
</TouchableOpacity>
        </View>
      ))}
    </View>
  );
};

export default HoodExpertsSection;


const styles = StyleSheet.create({

section: {
  marginTop: 24,
},

sectionHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 16,
},

sectionTitle: {
  fontSize: 20,
  fontWeight: '700',
  marginLeft: 10,
},

expertCard: {
  backgroundColor: '#FFF',
  borderRadius: 16,
  padding: 16,
  marginBottom: 12,
},

expertTopRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
},

expertName: {
  fontSize: 17,
  fontWeight: '700',
  color: '#111827',
},

statusBadge: {
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 5,
},

statusActive: {
  backgroundColor: '#DCFCE7',
},

statusInactive: {
  backgroundColor: '#FEE2E2',
},

statusText: {
  fontWeight: '600',
  fontSize: 12,
},

pickerWrapper: {
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 12,
  overflow: 'hidden',
  backgroundColor: '#F9FAFB',
},

transferButton: {
  marginTop: 14,
  backgroundColor: THEME.colors.primary,
  borderRadius: 12,
  height: 44,
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
},

transferButtonText: {
  color: '#FFF',
  fontWeight: '700',
  marginLeft: 8,
},
selectButton: {
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 12,
  paddingHorizontal: 14,
  height: 48,
  backgroundColor: '#F9FAFB',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},

selectButtonText: {
  fontSize: 14,
  color: '#111827',
},
expertToggle: {
  width: 44,
  height: 24,
  borderRadius: 12,
  padding: 2,
},

expertToggleOn: {
  backgroundColor: '#22C55E',
},

expertToggleOff: {
  backgroundColor: '#D1D5DB',
},

expertToggleThumb: {
  width: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: '#FFF',
},

thumbRight: {
  alignSelf: 'flex-end',
},

thumbLeft: {
  alignSelf: 'flex-start',
},
deleteButton: {
  marginTop: 10,
  height: 44,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#FECACA',
  backgroundColor: '#FEF2F2',

  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
},

deleteButtonText: {
  marginLeft: 8,
  fontWeight: '700',
  color: '#DC2626',
},
    })