import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import {
  ALL_JAIPUR_PIN_CODES,
  CORE_JAIPUR_PIN_CODES,
  JAIPUR_PIN_CODES,
} from '../constants/jaipurPinCodes';

export default function PincodeSelector({ selectedPinCodes, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const selected = new Set(selectedPinCodes);
  const allSelected = selectedPinCodes.length === ALL_JAIPUR_PIN_CODES.length;
  const coreSelected =
    selectedPinCodes.length === CORE_JAIPUR_PIN_CODES.length &&
    CORE_JAIPUR_PIN_CODES.every(pinCode => selected.has(pinCode));

  const visibleOptions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return JAIPUR_PIN_CODES;
    return JAIPUR_PIN_CODES.filter(item =>
      item.pinCode.includes(needle) || item.area.toLowerCase().includes(needle),
    );
  }, [search]);

  const togglePinCode = pinCode => {
    if (selected.has(pinCode)) {
      onChange(selectedPinCodes.filter(item => item !== pinCode));
    } else {
      onChange([...selectedPinCodes, pinCode]);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setExpanded(value => !value)} style={styles.summary} activeOpacity={0.8}>
        <View style={styles.summaryIcon}>
          <Ionicons name="location" size={18} color={THEME.colors.primary} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{allSelected ? 'All master PIN codes' : coreSelected ? 'Core Jaipur areas' : `${selectedPinCodes.length} PIN codes selected`}</Text>
          <Text style={styles.summaryText}>{allSelected ? `${ALL_JAIPUR_PIN_CODES.length} areas included` : coreSelected ? '8 default areas selected' : selectedPinCodes.slice(0, 5).join(', ') || 'Choose recipient areas'}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={THEME.colors.textMuted} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.panel}>
          <View style={styles.quickRow}>
            <TouchableOpacity onPress={() => onChange(ALL_JAIPUR_PIN_CODES)} style={[styles.quickButton, allSelected && styles.quickButtonActive]}>
              <Text style={[styles.quickButtonText, allSelected && styles.quickButtonTextActive]}>All ({ALL_JAIPUR_PIN_CODES.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChange(CORE_JAIPUR_PIN_CODES)} style={[styles.quickButton, coreSelected && styles.quickButtonActive]}>
              <Text style={[styles.quickButtonText, coreSelected && styles.quickButtonTextActive]}>Core Jaipur (8)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChange([])} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={17} color={THEME.colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search PIN code or area"
              keyboardType="numbers-and-punctuation"
              style={styles.searchInput}
            />
          </View>

          <ScrollView style={styles.options} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {visibleOptions.map(item => {
              const checked = selected.has(item.pinCode);
              return (
                <TouchableOpacity key={item.pinCode} onPress={() => togglePinCode(item.pinCode)} style={styles.option}>
                  <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={21} color={checked ? THEME.colors.primary : THEME.colors.textMuted} />
                  <View style={styles.optionCopy}>
                    <Text style={styles.pinCode}>{item.pinCode}</Text>
                    <Text style={styles.area}>{item.area}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 12, backgroundColor: '#FFF', overflow: 'hidden' },
  summary: { minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  summaryIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, marginHorizontal: 10 },
  summaryTitle: { color: THEME.colors.text, fontSize: 12, fontWeight: '900' },
  summaryText: { marginTop: 3, color: THEME.colors.textMuted, fontSize: 9 },
  panel: { padding: 11, borderTopWidth: 1, borderTopColor: THEME.colors.border, backgroundColor: '#F8FAFC' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  quickButton: { minHeight: 34, paddingHorizontal: 11, borderRadius: 17, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  quickButtonActive: { borderColor: THEME.colors.primary, backgroundColor: '#F3E8FF' },
  quickButtonText: { color: THEME.colors.textSecondary, fontSize: 10, fontWeight: '800' },
  quickButtonTextActive: { color: THEME.colors.primary },
  clearButton: { minHeight: 34, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  clearButtonText: { color: '#B91C1C', fontSize: 10, fontWeight: '800' },
  searchBox: { minHeight: 42, marginTop: 10, paddingHorizontal: 11, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 9, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, marginLeft: 7, color: THEME.colors.text, fontSize: 12 },
  options: { maxHeight: 240, marginTop: 8 },
  option: { minHeight: 48, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center' },
  optionCopy: { flex: 1, marginLeft: 9 },
  pinCode: { color: THEME.colors.text, fontSize: 11, fontWeight: '900' },
  area: { marginTop: 2, color: THEME.colors.textMuted, fontSize: 9 },
});
