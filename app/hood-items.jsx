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
import Toast from '../components/Toast';
import THEME from '../constants/theme';
import {
  createHoodItem,
  fetchHoodItems,
  fetchItems,
  fetchProducts,
  getErrorMessage,
  updateHoodItem,
} from '../services/api';

export default function HoodItems() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hoodId = Array.isArray(params.hoodId) ? params.hoodId[0] : params.hoodId;
  const hoodName = Array.isArray(params.hoodName) ? params.hoodName[0] : params.hoodName;
  const [items, setItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [priceItem, setPriceItem] = useState(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [createOfferPrice, setCreateOfferPrice] = useState('');
  const [createAvailable, setCreateAvailable] = useState(true);
  const [offerPrice, setOfferPrice] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const returnToSettings = () =>
    router.replace({
      pathname: '/settings',
      params: { hoodId, hoodName },
    });

  const showToast = (message, type = 'info') =>
    setToast({ visible: true, message, type });

  const loadItems = useCallback(async () => {
    if (!hoodId) return;
    try {
      setLoading(true);
      const [data, itemData, productData] = await Promise.all([
        fetchHoodItems(hoodId),
        fetchItems(),
        fetchProducts(),
      ]);
      setItems(
        [...(data || [])].sort(
          (a, b) => (a.sequenceNumber || 999) - (b.sequenceNumber || 999),
        ),
      );
      setCatalogItems(itemData || []);
      setProducts(productData || []);
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [hoodId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const updateItem = async (item, changes, successMessage) => {
    try {
      setSavingId(item.id);
      await updateHoodItem(item.id, {
        hoodId: item.hoodId || hoodId,
        itemId: item.itemId,
        isAvailable: changes.isAvailable ?? item.isAvailable,
        offerPrice:
          changes.offerPrice ?? item.offerPrice ?? item.itemDefaultPrice,
      });
      showToast(successMessage, 'success');
      await loadItems();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSavingId(null);
    }
  };

  const savePrice = async () => {
    const price = Number(offerPrice);
    if (!Number.isFinite(price) || price < 0) {
      showToast('Enter a valid non-negative offer price', 'error');
      return;
    }
    const item = priceItem;
    setPriceItem(null);
    await updateItem(item, { offerPrice: price }, 'Offer price updated');
  };

  const availableCatalogItems = catalogItems.filter(
    catalogItem => !items.some(hoodItem => hoodItem.itemId === catalogItem.id),
  );

  const productName = catalogItem =>
    products.find(product => product.id === catalogItem.productId)?.name ||
    catalogItem.itemCode ||
    'Catalog item';

  const openCreate = () => {
    setSelectedItemId('');
    setCreateOfferPrice('');
    setCreateAvailable(true);
    setCreateVisible(true);
  };

  const saveHoodItem = async () => {
    if (!selectedItemId) {
      showToast('Select an item from the catalog', 'error');
      return;
    }
    const price = Number(createOfferPrice);
    if (!Number.isFinite(price) || price < 0) {
      showToast('Enter a valid non-negative offer price', 'error');
      return;
    }
    try {
      setSavingId('create');
      await createHoodItem({
        hoodId,
        itemId: selectedItemId,
        offerPrice: price,
        isAvailable: createAvailable,
      });
      setCreateVisible(false);
      showToast('Hood item created successfully', 'success');
      await loadItems();
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast(current => ({ ...current, visible: false }))}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={returnToSettings} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Hood Items</Text>
          <Text style={styles.subtitle}>{hoodName || 'Selected hood'}</Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={styles.addButton}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={THEME.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {!items.length && (
            <View style={styles.emptyCard}>
              <Ionicons name="pricetags-outline" size={40} color={THEME.colors.textSecondary} />
              <Text style={styles.emptyTitle}>No hood items</Text>
              <Text style={styles.emptyText}>Item creation can be added to this page next.</Text>
            </View>
          )}
          {items.map(item => {
            const currentPrice = item.offerPrice ?? item.itemDefaultPrice;
            const discount =
              item.offerPrice != null
                ? Math.max(0, Number(item.itemDefaultPrice) - Number(item.offerPrice))
                : 0;
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.itemIcon}>
                    <Ionicons name="pricetag-outline" size={20} color={THEME.colors.primary} />
                  </View>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemName}>{item.productName || item.itemName || 'Service item'}</Text>
                    <Text style={styles.itemStatus}>
                      {item.isAvailable ? 'Available for booking' : 'Unavailable'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="switch"
                    accessibilityState={{ checked: Boolean(item.isAvailable) }}
                    disabled={savingId === item.id}
                    onPress={() =>
                      updateItem(
                        item,
                        { isAvailable: !item.isAvailable },
                        item.isAvailable ? 'Item marked unavailable' : 'Item is available',
                      )
                    }
                    style={[styles.switchTrack, item.isAvailable ? styles.availableTrack : styles.unavailableTrack]}
                  >
                    <View style={[styles.switchThumb, item.isAvailable ? styles.thumbRight : styles.thumbLeft]} />
                  </TouchableOpacity>
                </View>
                <View style={styles.priceArea}>
                  <View>
                    <Text style={styles.priceLabel}>Current price</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.price}>₹{currentPrice}</Text>
                      {discount > 0 && (
                        <Text style={styles.defaultPrice}>₹{item.itemDefaultPrice}</Text>
                      )}
                    </View>
                    {discount > 0 && <Text style={styles.savings}>Customer saves ₹{discount}</Text>}
                  </View>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => {
                      setPriceItem(item);
                      setOfferPrice(String(currentPrice ?? ''));
                    }}
                  >
                    <Ionicons name="create-outline" size={18} color={THEME.colors.primary} />
                    <Text style={styles.editButtonText}>Edit price</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={Boolean(priceItem)} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update offer price</Text>
            <Text style={styles.modalSubtitle}>{priceItem?.productName || priceItem?.itemName}</Text>
            <TextInput
              autoFocus
              keyboardType="decimal-pad"
              value={offerPrice}
              onChangeText={setOfferPrice}
              placeholder="Offer price"
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setPriceItem(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={savePrice} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={createVisible} animationType="slide">
        <SafeAreaView style={styles.createScreen}>
          <View style={styles.createHeader}>
            <TouchableOpacity onPress={() => setCreateVisible(false)}>
              <Ionicons name="close" size={25} color={THEME.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create hood item</Text>
            <TouchableOpacity disabled={savingId === 'create'} onPress={saveHoodItem}>
              <Text style={styles.saveText}>{savingId === 'create' ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.createContent}>
            <Text style={styles.fieldLabel}>Select catalog item</Text>
            {!availableCatalogItems.length ? (
              <View style={styles.noItemsCard}>
                <Text style={styles.noItemsText}>Every catalog item is already linked to this hood.</Text>
              </View>
            ) : (
              availableCatalogItems.map(catalogItem => (
                <TouchableOpacity
                  key={catalogItem.id}
                  onPress={() => {
                    setSelectedItemId(catalogItem.id);
                    setCreateOfferPrice(String(catalogItem.defaultPrice ?? ''));
                  }}
                  style={[
                    styles.catalogItem,
                    selectedItemId === catalogItem.id && styles.catalogItemSelected,
                  ]}
                >
                  <View style={styles.catalogRadio}>
                    {selectedItemId === catalogItem.id && <View style={styles.catalogRadioInner} />}
                  </View>
                  <View style={styles.itemCopy}>
                    <Text style={styles.itemName}>{productName(catalogItem)}</Text>
                    <Text style={styles.itemStatus}>
                      ₹{catalogItem.defaultPrice} · {catalogItem.estimatedTimeMinutes} min
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <Text style={styles.fieldLabel}>Offer price</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={createOfferPrice}
              onChangeText={setCreateOfferPrice}
              placeholder="Offer price"
              style={styles.input}
            />

            <View style={styles.availabilityRow}>
              <View>
                <Text style={styles.availabilityTitle}>Available for booking</Text>
                <Text style={styles.availabilityDescription}>
                  The item can be disabled later from its card.
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="switch"
                accessibilityState={{ checked: createAvailable }}
                onPress={() => setCreateAvailable(current => !current)}
                style={[
                  styles.switchTrack,
                  createAvailable ? styles.availableTrack : styles.unavailableTrack,
                ]}
              >
                <View style={[styles.switchThumb, createAvailable ? styles.thumbRight : styles.thumbLeft]} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border },
  iconButton: { padding: 8 },
  headerCopy: { flex: 1, marginLeft: 4 },
  title: { fontSize: 20, fontWeight: '800', color: THEME.colors.text },
  subtitle: { marginTop: 2, fontSize: 13, color: THEME.colors.textSecondary },
  addButton: { height: 40, paddingHorizontal: 13, borderRadius: 11, backgroundColor: THEME.colors.primary, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addButtonText: { color: '#FFF', fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  emptyCard: { alignItems: 'center', padding: 30, borderRadius: 18, backgroundColor: '#FFF' },
  emptyTitle: { marginTop: 10, fontSize: 18, fontWeight: '800', color: THEME.colors.text },
  emptyText: { marginTop: 5, textAlign: 'center', color: THEME.colors.textSecondary },
  card: { padding: 16, marginBottom: 12, borderRadius: 17, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  itemIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, marginHorizontal: 11 },
  itemName: { fontSize: 16, fontWeight: '800', color: THEME.colors.text },
  itemStatus: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 12 },
  switchTrack: { width: 46, height: 26, padding: 3, borderRadius: 13, justifyContent: 'center' },
  availableTrack: { backgroundColor: '#22C55E' },
  unavailableTrack: { backgroundColor: '#D1D5DB' },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF', elevation: 2 },
  thumbLeft: { alignSelf: 'flex-start' },
  thumbRight: { alignSelf: 'flex-end' },
  priceArea: { marginTop: 15, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  price: { fontSize: 23, fontWeight: '900', color: THEME.colors.text },
  defaultPrice: { color: THEME.colors.textMuted, textDecorationLine: 'line-through' },
  savings: { marginTop: 2, color: '#166534', fontSize: 11, fontWeight: '700' },
  editButton: { height: 39, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F3E8FF', flexDirection: 'row', alignItems: 'center', gap: 6 },
  editButtonText: { color: THEME.colors.primary, fontWeight: '800' },
  overlay: { flex: 1, padding: 22, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 400, padding: 20, borderRadius: 19, backgroundColor: '#FFF' },
  modalTitle: { fontSize: 19, fontWeight: '800', color: THEME.colors.text },
  modalSubtitle: { marginTop: 5, color: THEME.colors.textSecondary },
  input: { height: 48, marginTop: 18, paddingHorizontal: 13, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, fontSize: 17 },
  modalActions: { marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 20 },
  cancelText: { color: THEME.colors.textSecondary, fontWeight: '700' },
  primaryButton: { minHeight: 42, paddingHorizontal: 16, borderRadius: 11, backgroundColor: THEME.colors.primary, justifyContent: 'center' },
  primaryButtonText: { color: '#FFF', fontWeight: '800' },
  createScreen: { flex: 1, backgroundColor: THEME.colors.background },
  createHeader: { height: 60, paddingHorizontal: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveText: { padding: 8, color: THEME.colors.primary, fontWeight: '800' },
  createContent: { padding: 16, paddingBottom: 40 },
  fieldLabel: { marginTop: 12, marginBottom: 7, color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '800' },
  catalogItem: { minHeight: 64, padding: 12, marginBottom: 8, borderRadius: 13, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' },
  catalogItemSelected: { borderColor: THEME.colors.primary, backgroundColor: '#FAF5FF' },
  catalogRadio: { width: 20, height: 20, marginRight: 11, borderRadius: 10, borderWidth: 2, borderColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
  catalogRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: THEME.colors.primary },
  noItemsCard: { padding: 18, borderRadius: 13, backgroundColor: '#FFF' },
  noItemsText: { textAlign: 'center', color: THEME.colors.textSecondary },
  availabilityRow: { minHeight: 76, marginTop: 18, padding: 14, borderRadius: 13, borderWidth: 1, borderColor: THEME.colors.border, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  availabilityTitle: { color: THEME.colors.text, fontWeight: '800' },
  availabilityDescription: { marginTop: 4, maxWidth: 245, color: THEME.colors.textSecondary, fontSize: 11 },
});
