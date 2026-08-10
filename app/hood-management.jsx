import React, { useCallback, useEffect, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from '../components/Toast';
import ConfirmationModal from '../components/ConfirmationModal';
import THEME from '../constants/theme';
import {
  createHood,
  fetchHoods,
  getErrorMessage,
  updateHood,
} from '../services/api';

const EMPTY_HOOD = {
  hoodCode: '',
  name: '',
  cityId: '',
  addressLine1: '',
  addressLine2: '',
  latitude: '',
  longitude: '',
  defaultDispatchTimeMinutes: '20',
  paymentTypes: ['PRE_PAYMENT'],
  serviceableRadiusKm: '1',
  status: 'ACTIVE',
  operatingMode: 'ACTIVE',
};

const ToggleSetting = ({ title, description, value, onChange, disabled = false }) => {
  const active = value === 'ACTIVE';
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <TouchableOpacity
        accessibilityRole="switch"
        accessibilityState={{ checked: active, disabled }}
        disabled={disabled}
        onPress={() => onChange(active ? 'INACTIVE' : 'ACTIVE')}
        style={[
          styles.toggleTrack,
          active ? styles.toggleOn : styles.toggleOff,
          disabled && styles.toggleDisabled,
        ]}
      >
        <View style={[styles.toggleThumb, active ? styles.toggleThumbRight : styles.toggleThumbLeft]} />
      </TouchableOpacity>
    </View>
  );
};

const HoodRadiusPreview = ({ values }) => {
  const latitude = Number(values.latitude);
  const longitude = Number(values.longitude);
  const radiusKm = Number(values.serviceableRadiusKm);
  const valid =
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    Number.isFinite(radiusKm) &&
    radiusKm > 0;

  if (!valid) {
    return (
      <View style={styles.mapEmpty}>
        <Ionicons name="map-outline" size={26} color={THEME.colors.textMuted} />
        <Text style={styles.mapEmptyTitle}>Service-area preview</Text>
        <Text style={styles.mapEmptyText}>
          Enter valid coordinates and a serviceable radius to preview the hood coverage.
        </Text>
      </View>
    );
  }

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.mapEmpty}>
        <Ionicons name="location-outline" size={26} color={THEME.colors.primary} />
        <Text style={styles.mapEmptyTitle}>{radiusKm} km serviceable radius</Text>
        <Text style={styles.mapEmptyText}>{latitude}, {longitude}</Text>
      </View>
    );
  }

  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    'AIzaSyCnEy2SOjryaHzkyz0EemSMIcghwl6QpoU';
  if (!googleMapsApiKey) {
    return (
      <View style={styles.mapEmpty}>
        <Ionicons name="warning-outline" size={26} color="#D97706" />
        <Text style={styles.mapEmptyTitle}>Google Maps key required</Text>
        <Text style={styles.mapEmptyText}>
          Configure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to enable the service-area preview.
        </Text>
      </View>
    );
  }

  const label = [values.name, values.addressLine1, values.addressLine2]
    .filter(Boolean)
    .join(' · ');
  const mapHtml = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #map { width: 100%; height: 100%; margin: 0; }
      body { font-family: system-ui, sans-serif; }
      #error {
        display: none;
        position: absolute;
        inset: 0;
        padding: 24px;
        background: #f8f7fc;
        color: #5f556b;
        align-items: center;
        justify-content: center;
        text-align: center;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div id="error">Google Maps could not load. Check that the Maps JavaScript API is enabled and this domain is allowed for the API key.</div>
    <script>
      const latitude = ${JSON.stringify(latitude)};
      const longitude = ${JSON.stringify(longitude)};
      const radiusMetres = ${JSON.stringify(radiusKm * 1000)};
      const label = ${JSON.stringify(label || 'Hood centre')};
      const showMapError = () => {
        document.getElementById('map').style.display = 'none';
        document.getElementById('error').style.display = 'flex';
      };
      window.gm_authFailure = showMapError;
      window.initMap = () => {
        try {
          const centre = { lat: latitude, lng: longitude };
          const map = new google.maps.Map(document.getElementById('map'), {
            center: centre,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true
          });
          const circle = new google.maps.Circle({
            map,
            center: centre,
            radius: radiusMetres,
            strokeColor: '#5B2A91',
            strokeOpacity: 0.9,
            strokeWeight: 2,
            fillColor: '#7C3AED',
            fillOpacity: 0.2
          });
          const marker = new google.maps.Marker({ map, position: centre, title: label });
          const infoWindow = new google.maps.InfoWindow({ content: label });
          marker.addListener('click', () => infoWindow.open({ anchor: marker, map }));
          map.fitBounds(circle.getBounds(), 28);
        } catch (error) {
          showMapError();
        }
      };
    </script>
    <script
      async
      defer
      src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&callback=initMap&v=weekly"
      onerror="showMapError()"
    ></script>
  </body>
</html>`;

  return (
    <View style={styles.mapPreview}>
      <View style={styles.mapPreviewHeader}>
        <View>
          <Text style={styles.mapPreviewTitle}>Service-area preview</Text>
          <Text style={styles.mapPreviewSubtitle}>
            {radiusKm} km from the hood centre
          </Text>
        </View>
        <View style={styles.radiusBadge}>
          <Text style={styles.radiusBadgeText}>{radiusKm} km</Text>
        </View>
      </View>
      <iframe
        title="Hood serviceable radius map"
        srcDoc={mapHtml}
        style={{
          display: 'block',
          width: '100%',
          height: 280,
          border: 0,
          borderRadius: 12,
        }}
      />
      <Text style={styles.mapCoordinates}>{latitude}, {longitude}</Text>
    </View>
  );
};

export default function HoodManagement() {
  const router = useRouter();
  const [hoods, setHoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [pendingToggle, setPendingToggle] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const loadHoods = useCallback(async () => {
    try {
      setLoading(true);
      setHoods((await fetchHoods({ includeInactive: true })) || []);
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHoods();
  }, [loadHoods]);

  const openCreate = () =>
    setForm({
      editing: false,
      id: null,
      originalOperatingMode: null,
      values: { ...EMPTY_HOOD },
    });

  const openEdit = hood =>
    setForm({
      editing: true,
      id: hood.id,
      originalOperatingMode: hood.operatingMode || 'ACTIVE',
      values: {
        ...EMPTY_HOOD,
        ...hood,
        latitude: hood.latitude == null ? '' : String(hood.latitude),
        longitude: hood.longitude == null ? '' : String(hood.longitude),
        defaultDispatchTimeMinutes: String(hood.defaultDispatchTimeMinutes ?? 20),
        serviceableRadiusKm: String(hood.serviceableRadiusKm ?? 1),
        paymentTypes: hood.paymentTypes?.length ? hood.paymentTypes : ['PRE_PAYMENT'],
      },
    });

  const change = (field, value) =>
    setForm(current => ({ ...current, values: { ...current.values, [field]: value } }));

  const validate = () => {
    const values = form.values;
    if (!form.editing && !values.hoodCode.trim()) return 'Hood code is required';
    if (!form.editing && !values.name.trim()) return 'Hood name is required';
    if (!form.editing && !values.cityId.trim()) return 'City ID is required';
    if (!values.addressLine1.trim()) return 'Address line 1 is required';
    if (!values.latitude.trim()) return 'Latitude is required';
    if (!values.longitude.trim()) return 'Longitude is required';
    const latitude = Number(values.latitude);
    const longitude = Number(values.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return 'Enter a valid latitude';
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return 'Enter a valid longitude';
    const dispatchTime = Number(values.defaultDispatchTimeMinutes);
    const serviceableRadius = Number(values.serviceableRadiusKm);
    if (!Number.isFinite(dispatchTime) || dispatchTime < 0) return 'Enter a valid dispatch time';
    if (!Number.isFinite(serviceableRadius) || serviceableRadius <= 0) return 'Serviceable radius must be greater than zero';
    if (!values.paymentTypes.length) return 'Select at least one payment type';
    return null;
  };

  const save = async () => {
    const validationMessage = validate();
    if (validationMessage) {
      setToast({ visible: true, message: validationMessage, type: 'error' });
      return;
    }
    const values = form.values;
    const shared = {
      addressLine1: values.addressLine1.trim(),
      addressLine2: values.addressLine2.trim(),
      latitude: Number(values.latitude),
      longitude: Number(values.longitude),
      defaultDispatchTimeMinutes: Number(values.defaultDispatchTimeMinutes),
      paymentTypes: values.paymentTypes,
      serviceableRadiusKm: Number(values.serviceableRadiusKm),
      status: values.status,
      operatingMode: values.operatingMode,
    };
    try {
      setSaving(true);
      if (form.editing) {
        const updatedHood = await updateHood(form.id, shared);
        setHoods(current =>
          current.map(hood =>
            hood.id === form.id
              ? { ...hood, ...shared, ...(updatedHood || {}) }
              : hood,
          ),
        );
      } else {
        await createHood({
          hoodCode: values.hoodCode.trim().toUpperCase(),
          name: values.name.trim(),
          cityId: values.cityId.trim(),
          ...shared,
        });
      }
      setForm(null);
      setPendingToggle(null);
      setToast({
        visible: true,
        message: `Hood ${form.editing ? 'updated' : 'created'} successfully`,
        type: 'success',
      });
      if (!form.editing) await loadHoods();
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const requestToggle = (field, value) => {
    setPendingToggle({ field, value });
  };

  const confirmToggle = async () => {
    if (!pendingToggle || !form) return;
    const { field, value } = pendingToggle;

    if (!form.editing) {
      change(field, value);
      setPendingToggle(null);
      return;
    }

    try {
      setSaving(true);
      const updatedHood = await updateHood(form.id, { [field]: value });
      const statusRemoved = field === 'status' && value === 'INACTIVE';
      if (statusRemoved) {
        setHoods(current => current.filter(hood => hood.id !== form.id));
        setForm(null);
      } else {
        setHoods(current =>
          current.map(hood =>
            hood.id === form.id
              ? { ...hood, ...(updatedHood || {}), [field]: value }
              : hood,
          ),
        );
        setForm(current => ({
          ...current,
          ...(field === 'operatingMode' ? { originalOperatingMode: value } : {}),
          values: { ...current.values, [field]: value },
        }));
      }
      setPendingToggle(null);
      setToast({
        visible: true,
        message: statusRemoved
          ? 'Hood removed. Contact an administrator if it must be restored.'
          : `Hood ${field === 'status' ? 'status' : 'operating mode'} updated`,
        type: 'success',
      });
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const togglePaymentType = paymentType => {
    const selected = form.values.paymentTypes.includes(paymentType);
    change(
      'paymentTypes',
      selected
        ? form.values.paymentTypes.filter(value => value !== paymentType)
        : [...form.values.paymentTypes, paymentType],
    );
  };

  const input = (label, field, options = {}) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        editable={!options.createOnly || !form.editing}
        value={form.values[field]}
        onChangeText={value => change(field, value)}
        placeholder={label}
        keyboardType={options.numeric ? 'decimal-pad' : 'default'}
        multiline={options.multiline}
        style={[
          styles.input,
          options.multiline && styles.multiline,
          options.createOnly && form.editing && styles.disabledInput,
        ]}
      />
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(current => ({ ...current, visible: false }))}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/admin-settings')} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Hood Management</Text>
          <Text style={styles.subtitle}>System-level service areas</Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={styles.addButton}>
          <Ionicons name="add" size={21} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={THEME.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {hoods.map(hood => (
            <View key={hood.id} style={styles.card}>
              <View style={styles.icon}>
                <Ionicons name="business-outline" size={22} color={THEME.colors.primary} />
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.hoodName}>{hood.name}</Text>
                <Text style={styles.meta}>
                  {hood.hoodCode || 'No code'} · Status {hood.status || 'unavailable'} · Mode {hood.operatingMode || 'unavailable'}
                </Text>
                <Text style={styles.meta}>
                  {hood.serviceableRadiusKm ?? '—'} km radius · {hood.defaultDispatchTimeMinutes ?? '—'} min dispatch
                </Text>
                {(hood.addressLine1 || hood.addressLine2) && (
                  <Text style={styles.address} numberOfLines={2}>
                    {[hood.addressLine1, hood.addressLine2].filter(Boolean).join(', ')}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => openEdit(hood)} style={styles.editButton}>
                <Ionicons name="create-outline" size={19} color={THEME.colors.primary} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={Boolean(form)} animationType="slide">
        <SafeAreaView style={styles.formScreen}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => {
              setPendingToggle(null);
              setForm(null);
            }}>
              <Ionicons name="close" size={25} color={THEME.colors.text} />
            </TouchableOpacity>
            <Text style={styles.formTitle}>{form?.editing ? 'Update Hood' : 'Create Hood'}</Text>
            <TouchableOpacity disabled={saving} onPress={save}>
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          {form && (
            <ScrollView contentContainerStyle={styles.formContent}>
              {input('Hood code', 'hoodCode', { createOnly: true })}
              {input('Hood name', 'name', { createOnly: true })}
              {input('City ID', 'cityId', { createOnly: true })}
              {input('Address line 1', 'addressLine1')}
              {input('Address line 2', 'addressLine2', { multiline: true })}
              <View style={styles.twoColumns}>
                <View style={styles.column}>{input('Latitude', 'latitude', { numeric: true })}</View>
                <View style={styles.column}>{input('Longitude', 'longitude', { numeric: true })}</View>
              </View>
              {input('Default dispatch time (minutes)', 'defaultDispatchTimeMinutes', { numeric: true })}
              {input('Serviceable radius (km)', 'serviceableRadiusKm', { numeric: true })}
              <HoodRadiusPreview values={form.values} />

              <Text style={styles.label}>Payment types</Text>
              <View style={styles.choiceRow}>
                {['PRE_PAYMENT', 'POST_PAYMENT'].map(paymentType => (
                  <TouchableOpacity
                    key={paymentType}
                    onPress={() => togglePaymentType(paymentType)}
                    style={[
                      styles.choice,
                      form.values.paymentTypes.includes(paymentType) && styles.selectedChoice,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        form.values.paymentTypes.includes(paymentType) && styles.selectedChoiceText,
                      ]}
                    >
                      {paymentType.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <ToggleSetting
                title="Status"
                description="Turning this off removes the hood immediately. Restoration requires administrator support."
                value={form.values.status}
                onChange={value => requestToggle('status', value)}
              />
              <ToggleSetting
                title="Operating mode"
                description={
                  form.values.operatingMode === 'INACTIVE'
                    ? 'This hood is unavailable to end users. Turn it on to resume operations.'
                    : 'Turning this off makes the hood unavailable to end users. It can be enabled again later.'
                }
                value={form.values.operatingMode}
                onChange={value => requestToggle('operatingMode', value)}
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      <ConfirmationModal
        visible={Boolean(pendingToggle)}
        title={pendingToggle?.field === 'status' ? 'Update hood status?' : 'Update operating mode?'}
        message={
          pendingToggle?.field === 'status'
            ? pendingToggle?.value === 'INACTIVE'
              ? 'This will remove the hood immediately. You will need to contact an administrator to restore it. Do you want to continue?'
              : 'This will restore the hood status immediately. Do you want to continue?'
            : pendingToggle?.value === 'INACTIVE'
              ? 'This hood will become unavailable to end users immediately. You can enable it again later.'
              : 'This hood will become available to end users immediately. Do you want to continue?'
        }
        confirmText={
          pendingToggle?.field === 'status' && pendingToggle?.value === 'INACTIVE'
            ? 'Remove hood'
            : 'Confirm update'
        }
        confirmColor={pendingToggle?.value === 'INACTIVE' ? '#DC2626' : THEME.colors.primary}
        icon={pendingToggle?.value === 'INACTIVE' ? 'warning-outline' : 'checkmark-circle-outline'}
        loading={saving}
        onCancel={() => setPendingToggle(null)}
        onConfirm={confirmToggle}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  back: { padding: 8 },
  headerCopy: { flex: 1, marginLeft: 4 },
  title: { fontSize: 20, fontWeight: '800', color: THEME.colors.text },
  subtitle: { marginTop: 2, fontSize: 12, color: THEME.colors.textSecondary },
  addButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 15, paddingBottom: 40 },
  card: { minHeight: 91, marginBottom: 11, padding: 14, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 47, height: 47, borderRadius: 14, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, marginHorizontal: 12 },
  hoodName: { fontSize: 16, fontWeight: '800', color: THEME.colors.text },
  meta: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 11 },
  address: { marginTop: 6, color: THEME.colors.text, fontSize: 11, lineHeight: 16 },
  editButton: { width: 39, height: 39, borderRadius: 10, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  formScreen: { flex: 1, backgroundColor: THEME.colors.background },
  formHeader: { height: 60, paddingHorizontal: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formTitle: { fontSize: 18, fontWeight: '800', color: THEME.colors.text },
  saveText: { padding: 8, color: THEME.colors.primary, fontWeight: '800' },
  formContent: { padding: 16, paddingBottom: 42 },
  label: { marginTop: 9, marginBottom: 6, color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#FFF' },
  multiline: { minHeight: 76, paddingTop: 12, textAlignVertical: 'top' },
  disabledInput: { backgroundColor: '#F3F4F6', color: THEME.colors.textMuted },
  twoColumns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1 },
  mapEmpty: { minHeight: 142, marginTop: 16, padding: 20, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D8D0E5', backgroundColor: '#F8F7FC', alignItems: 'center', justifyContent: 'center' },
  mapEmptyTitle: { marginTop: 9, color: THEME.colors.text, fontSize: 14, fontWeight: '800' },
  mapEmptyText: { marginTop: 5, maxWidth: 310, color: THEME.colors.textSecondary, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  mapPreview: { marginTop: 16, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E9D5FF', backgroundColor: '#FFF' },
  mapPreviewHeader: { marginBottom: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mapPreviewTitle: { color: THEME.colors.text, fontSize: 14, fontWeight: '800' },
  mapPreviewSubtitle: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 11 },
  radiusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F3E8FF' },
  radiusBadgeText: { color: THEME.colors.primary, fontSize: 11, fontWeight: '800' },
  mapCoordinates: { marginTop: 8, color: THEME.colors.textMuted, fontSize: 10, textAlign: 'center' },
  choiceRow: { flexDirection: 'row', gap: 9 },
  choice: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: '#F3F4F6' },
  selectedChoice: { backgroundColor: THEME.colors.primary },
  choiceText: { color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '800' },
  selectedChoiceText: { color: '#FFF' },
  toggleRow: { minHeight: 74, marginTop: 14, padding: 14, borderRadius: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: THEME.colors.text, fontWeight: '800' },
  toggleDescription: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 11, lineHeight: 16 },
  toggleTrack: { width: 48, height: 28, padding: 3, borderRadius: 14, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#22C55E' },
  toggleOff: { backgroundColor: '#D1D5DB' },
  toggleDisabled: { opacity: 0.55 },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', elevation: 2 },
  toggleThumbLeft: { alignSelf: 'flex-start' },
  toggleThumbRight: { alignSelf: 'flex-end' },
});
