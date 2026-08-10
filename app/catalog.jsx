import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import ConfirmationModal from '../components/ConfirmationModal';
import Toast from '../components/Toast';
import THEME from '../constants/theme';
import {
  createCategory,
  createItem,
  createProduct,
  createSubcategory,
  deleteItem,
  deleteProduct,
  fetchCategories,
  fetchItems,
  fetchProducts,
  fetchSubcategories,
  getErrorMessage,
  updateCategory,
  updateItem,
  updateProduct,
} from '../services/api';

const EMPTY = {
  category: { name: '', slug: '', description: '', sequenceNumber: '1', iconUrl: '', imageUrl: '', status: 'ACTIVE' },
  subcategory: { categoryId: '', name: '', slug: '', description: '', sequenceNumber: '1', status: 'ACTIVE' },
  product: { name: '', description: '', tnc: '', unit: 'NA', imageUrl: '', timeToServiceMinutes: '60', status: 'ACTIVE' },
  item: { categoryId: '', subcategoryId: '', productId: '', sequenceNumber: '1', maxQuantity: '', status: 'ACTIVE', itemCode: '', defaultPrice: '', taxRate: '18', estimatedTimeMinutes: '60' },
};

const numeric = (value, nullable = false) =>
  value === '' && nullable ? null : Number(value);

const labelFor = (list, id) =>
  id ? list.find(entry => entry.id === id)?.name || 'Unknown' : '';

const StatusToggle = ({ value, onChange }) => {
  const active = value === 'ACTIVE';
  return (
    <View style={styles.toggleRow}>
      <View>
        <Text style={styles.toggleTitle}>Status</Text>
        <Text style={styles.toggleDescription}>
          {active ? 'Available for admin and customer flows' : 'Hidden from active use'}
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="switch"
        accessibilityState={{ checked: active }}
        onPress={() => onChange(active ? 'INACTIVE' : 'ACTIVE')}
        style={[styles.toggleTrack, active ? styles.toggleOn : styles.toggleOff]}
      >
        <View style={[styles.toggleThumb, active ? styles.toggleThumbRight : styles.toggleThumbLeft]} />
      </TouchableOpacity>
    </View>
  );
};

export default function Catalog() {
  const router = useRouter();
  const [tab, setTab] = useState('hierarchy');
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [picker, setPicker] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const [categoryData, subcategoryData, productData, itemData] = await Promise.all([
        fetchCategories(),
        fetchSubcategories(),
        fetchProducts(),
        fetchItems(),
      ]);
      setCategories(categoryData || []);
      setSubcategories(subcategoryData || []);
      setProducts(productData || []);
      setItems(itemData || []);
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const availableSubcategories = useMemo(
    () =>
      subcategories.filter(
        subcategory =>
          !form?.values?.categoryId || subcategory.categoryId === form.values.categoryId,
      ),
    [form?.values?.categoryId, subcategories],
  );

  const openForm = (type, record = null, defaults = {}) => {
    const values = record
      ? Object.fromEntries(
          Object.entries({ ...EMPTY[type], ...record }).map(([key, value]) => [
            key,
            value == null ? '' : String(value),
          ]),
        )
      : { ...EMPTY[type], ...defaults };
    setForm({ type, editing: Boolean(record), id: record?.id, values });
  };

  const change = (field, value) =>
    setForm(current => ({ ...current, values: { ...current.values, [field]: value } }));

  const validate = () => {
    const values = form.values;
    if (!values.name?.trim() && form.type !== 'item') return 'Name is required';
    if (form.type === 'subcategory' && !values.categoryId) return 'Select a category';
    if (form.type === 'item') {
      if (!values.categoryId || !values.subcategoryId || !values.productId) {
        return 'Category, subcategory and product are required';
      }
      if (values.defaultPrice === '' || Number(values.defaultPrice) < 0) return 'Enter a valid price';
      if (Number(values.taxRate) < 0) return 'Enter a valid tax rate';
      if (Number(values.estimatedTimeMinutes) <= 0) return 'Service time must be greater than zero';
    }
    if (form.type === 'product' && Number(values.timeToServiceMinutes) <= 0) {
      return 'Service time must be greater than zero';
    }
    return null;
  };

  const save = async () => {
    const errorMessage = validate();
    if (errorMessage) {
      setToast({ visible: true, message: errorMessage, type: 'error' });
      return;
    }
    const { type, editing, id, values } = form;
    try {
      setSaving(true);
      if (type === 'category') {
        const payload = {
          name: values.name.trim(),
          sequenceNumber: numeric(values.sequenceNumber),
          slug: values.slug.trim(),
          description: values.description.trim() || undefined,
          iconUrl: values.iconUrl.trim() || undefined,
          imageUrl: values.imageUrl.trim() || undefined,
          status: values.status,
        };
        if (editing) await updateCategory(id, payload);
        else await createCategory(payload);
      } else if (type === 'subcategory') {
        await createSubcategory({
          categoryId: values.categoryId,
          name: values.name.trim(),
          slug: values.slug.trim(),
          description: values.description.trim(),
          status: values.status,
          sequenceNumber: numeric(values.sequenceNumber),
        });
      } else if (type === 'product') {
        const payload = {
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          tnc: values.tnc.trim() || undefined,
          unit: values.unit.trim() || 'NA',
          imageUrl: values.imageUrl.trim() || undefined,
          status: values.status,
          timeToServiceMinutes: numeric(values.timeToServiceMinutes),
        };
        if (editing) await updateProduct(id, payload);
        else await createProduct(payload);
      } else {
        const payload = {
          categoryId: values.categoryId,
          subcategoryId: values.subcategoryId,
          productId: values.productId,
          sequenceNumber: numeric(values.sequenceNumber),
          maxQuantity: numeric(values.maxQuantity, true),
          status: values.status,
          itemCode: values.itemCode.trim() || null,
          defaultPrice: numeric(values.defaultPrice),
          taxRate: numeric(values.taxRate),
          estimatedTimeMinutes: numeric(values.estimatedTimeMinutes),
        };
        if (editing) await updateItem(id, payload);
        else await createItem(payload);
      }
      setForm(null);
      setToast({ visible: true, message: `${type} ${editing ? 'updated' : 'created'} successfully`, type: 'success' });
      await loadCatalog();
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      setSaving(true);
      if (deleteTarget.type === 'product') await deleteProduct(deleteTarget.id);
      else await deleteItem(deleteTarget.id);
      setDeleteTarget(null);
      setToast({ visible: true, message: 'Deleted successfully', type: 'success' });
      await loadCatalog();
    } catch (error) {
      setToast({ visible: true, message: getErrorMessage(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const renderHierarchy = () => (
    <>
      {categories.map(category => {
        const childSubcategories = subcategories.filter(child => child.categoryId === category.id);
        const isExpanded = expanded[category.id];
        return (
          <View key={category.id} style={styles.categoryCard}>
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded(current => ({ ...current, [category.id]: !isExpanded }))}
              >
                <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={20} color={THEME.colors.primary} />
              </TouchableOpacity>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{category.name}</Text>
                <Text style={styles.rowMeta}>{childSubcategories.length} subcategories · {category.status}</Text>
              </View>
              <TouchableOpacity onPress={() => openForm('subcategory', null, { categoryId: category.id })} style={styles.smallAction}>
                <Ionicons name="add" size={19} color={THEME.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openForm('category', category)} style={styles.smallAction}>
                <Ionicons name="create-outline" size={18} color={THEME.colors.primary} />
              </TouchableOpacity>
            </View>
            {isExpanded && childSubcategories.map(subcategory => {
              const childItems = items.filter(item => item.subcategoryId === subcategory.id);
              return (
                <View key={subcategory.id} style={styles.subcategory}>
                  <View style={styles.row}>
                    <View style={styles.treeLine} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.subcategoryTitle}>{subcategory.name}</Text>
                      <Text style={styles.rowMeta}>{childItems.length} items</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() =>
                        openForm('item', null, {
                          categoryId: category.id,
                          subcategoryId: subcategory.id,
                        })
                      }
                      style={styles.addItemButton}
                    >
                      <Ionicons name="add-circle-outline" size={17} color={THEME.colors.primary} />
                      <Text style={styles.addItemText}>Item</Text>
                    </TouchableOpacity>
                  </View>
                  {childItems.map(item => (
                    <View key={item.id} style={styles.itemRow}>
                      <Ionicons name="cube-outline" size={16} color={THEME.colors.textSecondary} />
                      <View style={styles.rowCopy}>
                        <Text style={styles.itemName}>{labelFor(products, item.productId)}</Text>
                        <Text style={styles.rowMeta}>₹{item.defaultPrice} · {item.estimatedTimeMinutes} min · {item.status}</Text>
                      </View>
                      <TouchableOpacity onPress={() => openForm('item', item)} style={styles.smallAction}>
                        <Ionicons name="create-outline" size={17} color={THEME.colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setDeleteTarget({ type: 'item', id: item.id })} style={styles.smallAction}>
                        <Ionicons name="trash-outline" size={17} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        );
      })}
    </>
  );

  const renderProducts = () => (
    <>
      {products.map(product => (
        <View key={product.id} style={styles.productCard}>
          <View style={styles.productIcon}>
            <Ionicons name="cube-outline" size={22} color={THEME.colors.primary} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{product.name}</Text>
            <Text style={styles.rowMeta}>
              {product.timeToServiceMinutes ? `${product.timeToServiceMinutes} min · ` : ''}{product.status}
            </Text>
          </View>
          <TouchableOpacity onPress={() => openForm('product', product)} style={styles.smallAction}>
            <Ionicons name="create-outline" size={18} color={THEME.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDeleteTarget({ type: 'product', id: product.id })} style={styles.smallAction}>
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ))}
    </>
  );

  const selector = (label, field, options) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setPicker({ field, label, options })}>
        <Text style={form.values[field] ? styles.selectorValue : styles.placeholder}>
          {labelFor(options, form.values[field]) || `Select ${label.toLowerCase()}`}
        </Text>
        <Ionicons name="chevron-down" size={18} color={THEME.colors.textSecondary} />
      </TouchableOpacity>
    </>
  );

  const input = (label, field, options = {}) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={form.values[field]}
        onChangeText={value => change(field, value)}
        placeholder={options.placeholder || label}
        keyboardType={options.numeric ? 'decimal-pad' : 'default'}
        multiline={options.multiline}
        style={[styles.input, options.multiline && styles.multiline]}
      />
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(current => ({ ...current, visible: false }))} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/admin-settings')} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={THEME.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Catalog Management</Text>
          <Text style={styles.subtitle}>Category → Subcategory → Product → Item</Text>
        </View>
        <TouchableOpacity onPress={() => openForm(tab === 'products' ? 'product' : 'category')} style={styles.addButton}>
          <Ionicons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
      <View style={styles.tabs}>
        {[
          ['hierarchy', 'Catalog hierarchy'],
          ['products', 'Product library'],
        ].map(([value, label]) => (
          <TouchableOpacity key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.activeTab]}>
            <Text style={[styles.tabText, tab === value && styles.activeTabText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={THEME.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'hierarchy' ? renderHierarchy() : renderProducts()}
        </ScrollView>
      )}

      <Modal visible={Boolean(form)} animationType="slide">
        <SafeAreaView style={styles.formScreen}>
          <View style={styles.formHeader}>
            <TouchableOpacity onPress={() => setForm(null)}><Ionicons name="close" size={25} color={THEME.colors.text} /></TouchableOpacity>
            <Text style={styles.formTitle}>{form?.editing ? 'Edit' : 'Create'} {form?.type}</Text>
            <TouchableOpacity disabled={saving} onPress={save}><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text></TouchableOpacity>
          </View>
          {form && (
            <ScrollView contentContainerStyle={styles.formContent}>
              {form.type === 'category' && <>
                {input('Name', 'name')}{input('Slug', 'slug')}{input('Sequence number', 'sequenceNumber', { numeric: true })}
                {input('Description', 'description', { multiline: true })}{input('Icon URL', 'iconUrl')}{input('Image URL', 'imageUrl')}
              </>}
              {form.type === 'subcategory' && <>
                {selector('Category', 'categoryId', categories)}{input('Name', 'name')}{input('Slug', 'slug')}
                {input('Description', 'description', { multiline: true })}{input('Sequence number', 'sequenceNumber', { numeric: true })}
              </>}
              {form.type === 'product' && <>
                {input('Name', 'name')}{input('Description', 'description', { multiline: true })}{input('Terms and conditions', 'tnc', { multiline: true })}
                {input('Unit', 'unit')}{input('Image URL', 'imageUrl')}{input('Service time in minutes', 'timeToServiceMinutes', { numeric: true })}
              </>}
              {form.type === 'item' && <>
                {selector('Category', 'categoryId', categories)}
                {selector('Subcategory', 'subcategoryId', availableSubcategories)}
                {selector('Product', 'productId', products)}
                {input('Sequence number', 'sequenceNumber', { numeric: true })}{input('Item code (optional)', 'itemCode')}
                {input('Default price', 'defaultPrice', { numeric: true })}{input('Tax rate', 'taxRate', { numeric: true })}
                {input('Estimated time in minutes', 'estimatedTimeMinutes', { numeric: true })}{input('Maximum quantity (optional)', 'maxQuantity', { numeric: true })}
              </>}
              <StatusToggle value={form.values.status} onChange={value => change('status', value)} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={Boolean(picker)} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.formTitle}>Select {picker?.label}</Text>
            <ScrollView style={styles.pickerList}>
              {(picker?.options || []).map(option => (
                <TouchableOpacity key={option.id} style={styles.pickerOption} onPress={() => {
                  change(picker.field, option.id);
                  if (picker.field === 'categoryId') change('subcategoryId', '');
                  setPicker(null);
                }}>
                  <Text style={styles.selectorValue}>{option.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setPicker(null)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.type || ''}?`}
        message="This action cannot be undone and may fail when other catalog records depend on it."
        confirmText="Delete"
        confirmColor="#DC2626"
        loading={saving}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
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
  tabs: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FFF' },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  activeTab: { backgroundColor: THEME.colors.primary },
  tabText: { color: THEME.colors.textSecondary, fontWeight: '700' },
  activeTabText: { color: '#FFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 40 },
  categoryCard: { marginBottom: 11, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border, overflow: 'hidden' },
  row: { minHeight: 66, padding: 12, flexDirection: 'row', alignItems: 'center' },
  expandButton: { padding: 6, marginRight: 4 },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '800', color: THEME.colors.text },
  rowMeta: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 11 },
  smallAction: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  subcategory: { marginHorizontal: 12, marginBottom: 10, borderRadius: 12, backgroundColor: '#F8FAFC', overflow: 'hidden' },
  treeLine: { width: 4, height: 34, marginRight: 10, borderRadius: 2, backgroundColor: '#D8B4FE' },
  subcategoryTitle: { fontSize: 14, fontWeight: '800', color: THEME.colors.text },
  addItemButton: { flexDirection: 'row', gap: 4, alignItems: 'center', padding: 7 },
  addItemText: { color: THEME.colors.primary, fontSize: 11, fontWeight: '800' },
  itemRow: { minHeight: 57, paddingHorizontal: 13, borderTopWidth: 1, borderTopColor: '#E5E7EB', flexDirection: 'row', gap: 9, alignItems: 'center' },
  itemName: { color: THEME.colors.text, fontWeight: '700' },
  productCard: { minHeight: 75, marginBottom: 10, padding: 13, borderRadius: 15, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center' },
  productIcon: { width: 43, height: 43, marginRight: 11, borderRadius: 13, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  formScreen: { flex: 1, backgroundColor: THEME.colors.background },
  formHeader: { height: 60, paddingHorizontal: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formTitle: { fontSize: 18, fontWeight: '800', color: THEME.colors.text, textTransform: 'capitalize' },
  saveText: { padding: 8, color: THEME.colors.primary, fontWeight: '800' },
  formContent: { padding: 16, paddingBottom: 40 },
  label: { marginTop: 8, marginBottom: 6, color: THEME.colors.textSecondary, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#FFF' },
  multiline: { minHeight: 82, paddingTop: 12, textAlignVertical: 'top' },
  selector: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: THEME.colors.border, borderRadius: 11, backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center' },
  selectorValue: { flex: 1, color: THEME.colors.text, fontWeight: '600' },
  placeholder: { flex: 1, color: THEME.colors.textMuted },
  toggleRow: { minHeight: 74, marginTop: 18, padding: 14, borderRadius: 13, backgroundColor: '#FFF', borderWidth: 1, borderColor: THEME.colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleTitle: { color: THEME.colors.text, fontWeight: '800' },
  toggleDescription: { marginTop: 4, maxWidth: 250, color: THEME.colors.textSecondary, fontSize: 11 },
  toggleTrack: { width: 48, height: 28, padding: 3, borderRadius: 14, justifyContent: 'center' },
  toggleOn: { backgroundColor: '#22C55E' },
  toggleOff: { backgroundColor: '#D1D5DB' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF', elevation: 2 },
  toggleThumbLeft: { alignSelf: 'flex-start' },
  toggleThumbRight: { alignSelf: 'flex-end' },
  overlay: { flex: 1, padding: 22, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center' },
  pickerCard: { width: '100%', maxWidth: 400, maxHeight: '75%', padding: 20, borderRadius: 19, backgroundColor: '#FFF' },
  pickerList: { marginTop: 12 },
  pickerOption: { minHeight: 48, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', justifyContent: 'center' },
  closeText: { marginTop: 15, textAlign: 'right', color: THEME.colors.primary, fontWeight: '800' },
});
