import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDateRangePicker } from '../utils/useDateRangePicker';
import BookingCard from '../components/BookingCard';
import { BookingListSkeleton } from '../components/Loader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Toast from '../components/Toast';
import NewBookingBanner from '../components/NewBookingBanner';
import { 
  fetchBookings,  
  fetchHoods,
  getErrorMessage 
} from '../services/api';import THEME from '../constants/theme';

const STATUS_FILTERS = ['ALL', 'CONFIRMED', 'SETTLED', 'CANCELLED', 'FAILED', 'PAYMENT_PENDING'];
const PAGE_SIZE = 20;

export default function Home() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as const });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [showHoodDropdown, setShowHoodDropdown] = useState(false);
  // New booking notification
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const lastKnownCount = useRef(0);
  const [hoods, setHoods] = useState([]);
  const [selectedHoodId, setSelectedHoodId] = useState(null);
  const [selectedHoodName, setSelectedHoodName] = useState('');

  const DATE_FILTERS = [
  'ALL',
  'TODAY',
  'TOMORROW',
  'DAY_AFTER',
  'CUSTOM'
];

const [activeDateFilter, setActiveDateFilter] = useState('TODAY');
// for custom range
const DEFAULT_HOOD_ID = process.env.EXPO_PUBLIC_DEFAULT_HOOD_ID;

const {
  customStartDate,
  customEndDate,
  setCustomStartDate,   // ✅ ADD
  setCustomEndDate,     // ✅ ADD
  showDatePicker,
  pickerType,
  webVisible,
  setWebVisible,
  openPicker,
  onDateChange,
  applyWebDates
} = useDateRangePicker();

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Exit App',
        'Are you sure you want to exit?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', onPress: () => BackHandler.exitApp() },
        ]
      );
      return true;
    });

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (selectedHoodId) {
      loadBookings(0, false);
    }
  }, [selectedHoodId]);

useEffect(() => {
  filterBookings(bookings, searchQuery, activeFilter);
}, [bookings, searchQuery, activeFilter, activeDateFilter, customStartDate, customEndDate]);


  useEffect(() => {
   loadHoods();
  }, []);


  const loadHoods = async () => {
  try {
    const data = await fetchHoods();
    setHoods(data || []);

    // Set default hood
    const defaultHood =
      data.find((h: any) => h.id === DEFAULT_HOOD_ID) ||
      data[0];

    if (defaultHood) {
      setSelectedHoodId(defaultHood.id);
      setSelectedHoodName(defaultHood.name);
    }
  } catch (err: any) {
    showToast(getErrorMessage(err), 'error');
  }
};

  const loadBookings = async (page: number = 0, append: boolean = false) => {
      // 🔒 Prevent calling API with null hood
      if (!selectedHoodId) {
        console.log('Skipping fetchBookings: selectedHoodId not ready');
        return;
      }
    try {
      if (!append) {
        setLoading(true);
        setCurrentPage(0);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      
    const data = await fetchBookings(
      selectedHoodId,
      page,
      PAGE_SIZE
    );  
    const bookingsList = data?._embedded?.bookingDetailsResponses || [];
    const pageInfo = data?.page || {};
    const total = pageInfo.totalPages ?? 0;
      setTotalPages(pageInfo.totalPages || 0);
      setTotalElements(pageInfo.totalElements || 0);
      setHasMore(page < total - 1);
      setCurrentPage(page);
      
      // Update last known count
      lastKnownCount.current = pageInfo.totalElements || 0;
      setNewBookingsCount(0);
      
      if (append) {
        setBookings(prev => [...prev, ...bookingsList]);
      } else {
        setBookings(bookingsList);
      }
    } catch (err: any) {
      console.error('Failed to fetch bookings:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (!selectedHoodId) return;
    if (loadingMore || loading) return;
    if (!hasMore) return;

    loadBookings(currentPage + 1, true);
  };

  const onRefresh = useCallback(() => {
    if (!selectedHoodId) return;

    setRefreshing(true);
    setNewBookingsCount(0);
    loadBookings(0, false);
  }, [selectedHoodId]);

  const handleNewBookingsBannerPress = () => {
    onRefresh();
  };
 
const normalizeDate = (date) => {
  const d = new Date(date);

  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );
};

const filterBookings = (data, search, status) => {
  let filtered = [...data];

  // ✅ STATUS FILTER
  if (status !== 'ALL') {
    filtered = filtered.filter(
      (b) => b.status?.toUpperCase() === status.toUpperCase()
    );
  }

  // ✅ DATE FILTER (BASED ON slotStart)
  const today = normalizeDate(new Date());

  filtered = filtered.filter((b) => {
    const slotStart = b?.services?.[0]?.slotStart;
    if (!slotStart) return false;

    const bookingDate = normalizeDate(slotStart);

    switch (activeDateFilter) {
      case 'TODAY':
        return bookingDate.getTime() === today.getTime();

      case 'TOMORROW': {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return bookingDate.getTime() === tomorrow.getTime();
      }

      case 'DAY_AFTER': {
        const dayAfter = new Date(today);
        dayAfter.setDate(today.getDate() + 2);
        return bookingDate.getTime() === dayAfter.getTime();
      }

      case 'CUSTOM': {
        if (!customStartDate) return true;

        const start = normalizeDate(customStartDate);
        const end = normalizeDate(
          customEndDate ? customEndDate : new Date()
        );

        return bookingDate >= start && bookingDate <= end;
      }

      case 'ALL':
      default:
        return true;
    }
  });

  // ✅ SEARCH FILTER
  if (search.trim()) {
    const searchLower = search.toLowerCase().trim();

    filtered = filtered.filter(
      (b) =>
        b.bookingId?.toLowerCase().includes(searchLower) ||
        b.bookingCode?.toLowerCase().includes(searchLower) ||
        b.phone?.toLowerCase().includes(searchLower) ||
        b.userId?.toLowerCase().includes(searchLower)
    );
  }

  // ✅ DATE-ONLY SORTING (NO TIME PRIORITY)
  filtered.sort((a, b) => {
    const aDate = normalizeDate(a?.services?.[0]?.slotStart || 0);
    const bDate = normalizeDate(b?.services?.[0]?.slotStart || 0);

    // 👉 CUSTOM RANGE (PAST) → ascending (oldest first)
    if (activeDateFilter === 'CUSTOM' && customStartDate) {
      const end = normalizeDate(customEndDate || new Date());
      const todayDate = normalizeDate(new Date());

      if (end < todayDate) {
        return aDate - bDate;
      }
    }

    // 👉 DEFAULT → latest date first
    return bDate - aDate;
  });

  setFilteredBookings(filtered);
};

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
  };

  const handleBookingPress = (booking: any) => {
    router.push({
      pathname: '/booking/[id]',
      params: { id: booking.bookingId, booking: JSON.stringify(booking) },
    });
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ visible: true, message, type });
  };

  const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: any) => {
    const paddingToBottom = 50;
    return layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  };

const handleCustomDatePress = () => {
  openPicker('start');
};


  if (loading && bookings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Qwiky Admin</Text>
              <Text style={styles.headerSubtitle}>Booking Management</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() =>
                router.push({
                  pathname: '/settings',
                  params: {
                    hoodId: selectedHoodId,
                    hoodName: selectedHoodName,
                  },
                })
              }
            >
              <Ionicons name="settings-outline" size={24} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <BookingListSkeleton />
  </SafeAreaView>
    );
  }

  if (error && bookings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Qwiky Admin</Text>
              <Text style={styles.headerSubtitle}>Booking Management</Text>
            </View>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() =>
                router.push({
                  pathname: '/settings',
                  params: {
                    hoodId: selectedHoodId,
                    hoodName: selectedHoodName,
                  },
                })
              }
            >
              <Ionicons name="settings-outline" size={24} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        <ErrorState message={error} onRetry={() => loadBookings()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Qwiky Admin</Text>
           <Text style={styles.headerSubtitle}>
Showing {filteredBookings.length} of {totalElements} bookings
          </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={THEME.colors.primary} />
              ) : (
                <Ionicons name="refresh" size={22} color={THEME.colors.primary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.assistedButton}
              disabled={!selectedHoodId}
              onPress={() =>
                router.push({
                  pathname: '/assisted-booking',
                  params: { hoodId: selectedHoodId }
                })
              }
            >
            <Ionicons name="add-circle-outline" size={24} color={THEME.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsButton}
              disabled={!selectedHoodId}
              onPress={() =>
                router.push({
                  pathname: '/settings',
                  params: {
                    hoodId: selectedHoodId,
                    hoodName: selectedHoodName,
                  },
                })
              }
            >
              <Ionicons name="settings-outline" size={24} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Hood Dropdown */}
      <View style={styles.hoodDropdownWrapper}>
        <TouchableOpacity
          style={styles.hoodDropdownButton}
          onPress={() => setShowHoodDropdown(!showHoodDropdown)}
        >
          <Text style={styles.hoodDropdownText}>
            {selectedHoodName || 'Select Hood'}
          </Text>
          <Ionicons
            name={showHoodDropdown ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#FFF"
          />
        </TouchableOpacity>

        {showHoodDropdown && (
          <View style={styles.hoodDropdownList}>
            {hoods.map((hood: any) => (
              <TouchableOpacity
                key={hood.id}
                style={styles.hoodDropdownItem}
                onPress={() => {
                  setSelectedHoodId(hood.id);
                  setSelectedHoodName(hood.name);
                  setShowHoodDropdown(false);
                }}
              >
                <Text style={styles.hoodDropdownItemText}>
                  {hood.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={THEME.colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by Booking ID or Code"
            placeholderTextColor={THEME.colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter Chips */}
      {/* Today Toggle */}
 <View style={styles.dateFilterContainer}>
  <ScrollView horizontal showsHorizontalScrollIndicator={false}>

    {DATE_FILTERS.map((filter) => (
      <TouchableOpacity
        key={filter}
        style={[
          styles.dateChip,
          activeDateFilter === filter && styles.dateChipActive
        ]}
       onPress={() => {
  if (filter === 'CUSTOM') {
  setActiveDateFilter('CUSTOM');
  handleCustomDatePress();
} else {
    setActiveDateFilter(filter);
  }
}}
      >
        <Text
          style={[
            styles.dateChipText,
            activeDateFilter === filter && styles.dateChipTextActive
          ]}
        >
         {filter === 'CUSTOM' && customStartDate
  ? `${customStartDate.toLocaleDateString()} - ${
      (customEndDate || new Date()).toLocaleDateString()
    }`
  : filter === 'DAY_AFTER'
  ? 'DAY AFTER TOMORROW'
  : filter.replace('_', ' ')}
        </Text>
      </TouchableOpacity>
    ))}

  </ScrollView>
</View>
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {STATUS_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                activeFilter === filter && styles.filterChipActive,
              ]}
              onPress={() => handleFilterChange(filter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter && styles.filterChipTextActive,
                ]}
              >
                {filter.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* New Bookings Banner */}
      <NewBookingBanner 
        newCount={newBookingsCount} 
        onPress={handleNewBookingsBannerPress} 
      />

      {/* Booking List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME.colors.primary]}
            tintColor={THEME.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          if (isCloseToBottom(nativeEvent)) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
       {!loading && filteredBookings.length === 0 ? (
          <EmptyState
            title={searchQuery || activeFilter !== 'ALL' ? 'No Matches Found' : 'No Bookings'}
            message={
              searchQuery || activeFilter !== 'ALL'
                ? 'Try adjusting your search or filters'
                : 'There are no bookings to display'
            }
          />
        ) : (
          <>
            {filteredBookings.map((booking, index) => (
              <BookingCard
                key={booking.bookingId || index}
                booking={booking}
                onPress={() => handleBookingPress(booking)}
              />
            ))}
            
            {/* Load More Indicator */}
            {loadingMore && (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={THEME.colors.primary} />
                <Text style={styles.loadingMoreText}>Loading more...</Text>
              </View>
            )}
            
            {/* Pagination Info */}
            {!hasMore && bookings.length > 0 && (
              <View style={styles.paginationInfo}>
                <Text style={styles.paginationText}>
                  Showing all {totalElements} bookings
                </Text>
              </View>
            )}
          </>
        )}
        <View style={styles.listFooter} />
      </ScrollView>
    
    {/* MOBILE DATE PICKER */}
{showDatePicker && Platform.OS !== 'web' && (
  <DateTimePicker
    value={
      pickerType === 'start'
        ? customStartDate || new Date()
        : customEndDate || new Date()
    }
    mode="date"
    display={Platform.OS === 'ios' ? 'inline' : 'default'}
    onChange={(event, selectedDate) => {
  if (!selectedDate) {
    setShowDatePicker(false);
    return;
  }

  if (pickerType === 'start') {
    onDateChange(event, selectedDate);

    // 👉 open END picker automatically
    setTimeout(() => {
      openPicker('end');
    }, 200);

  } else {
    onDateChange(event, selectedDate);

    // 👉 apply filter after end selected
    setActiveDateFilter('CUSTOM');
  }
}}
  />
)}

{Platform.OS === 'web' && webVisible && (
  <View style={styles.webPickerOverlay}>
    <View style={styles.webPickerBox}>

      <Text style={styles.webPickerTitle}>
        Select Date Range
      </Text>

      <Text>Start Date</Text>
      <input
        type="date"
        value={customStartDate ? customStartDate.toISOString().split('T')[0] : ''}
        onChange={(e) => setCustomStartDate(new Date(e.target.value))}
        style={styles.webInput}
      />

      <Text style={{ marginTop: 12 }}>End Date</Text>
      <input
        type="date"
        value={customEndDate ? customEndDate.toISOString().split('T')[0] : ''}
        onChange={(e) => setCustomEndDate(new Date(e.target.value))}
        style={styles.webInput}
      />

      <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>

        <TouchableOpacity
          onPress={() => setWebVisible(false)}
          style={[styles.webPickerClose, { backgroundColor: '#999' }]}
        >
          <Text style={{ color: '#FFF' }}>Cancel</Text>
        </TouchableOpacity>

     <TouchableOpacity
  disabled={!customStartDate}
  onPress={() => {
    const success = applyWebDates(
      customStartDate,
      customEndDate,
      showToast
    );

    if (success) {
      setActiveDateFilter('CUSTOM');
    }
  }}
  style={[
    styles.webPickerClose,
    {
      backgroundColor: customStartDate
        ? THEME.colors.primary
        : '#CCC'
    }
  ]}
><Text style={{ color: '#FFF' }}>Apply</Text></TouchableOpacity>

      </View>

    </View>
  </View>
)}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: THEME.colors.secondary,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: THEME.colors.text,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: THEME.colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFF',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingTop: 8,
    flexGrow: 1,
  },
  listFooter: {
    height: 24,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: THEME.colors.textMuted,
  },
  paginationInfo: {
    alignItems: 'center',
    padding: 16,
  },
  paginationText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
  },
    hoodSelectorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME.colors.surface,
  },
  hoodChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },

  hoodChipActive: {
    backgroundColor: THEME.colors.primary,
  },

  hoodChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },

  hoodChipTextActive: {
    color: '#FFF',
  },
  hoodDropdownWrapper: {
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: THEME.colors.surface,
},
hoodDropdownButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: THEME.colors.primary,
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 24,
},

hoodDropdownText: {
  color: '#FFF',
  fontWeight: '600',
  fontSize: 14,
},

hoodDropdownList: {
  marginTop: 8,
  backgroundColor: '#FFF',
  borderRadius: 12,
  elevation: 3,
  overflow: 'hidden',
},

hoodDropdownItem: {
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderBottomWidth: 1,
  borderBottomColor: '#F1F1F1',
},

hoodDropdownItemText: {
  fontSize: 14,
  color: THEME.colors.text,
},
assistedButton: {
  padding: 8,
  borderRadius: 12,
  backgroundColor: '#EEF2FF',
},
todayToggleContainer: {
  flexDirection: 'row',
  paddingHorizontal: 16,
  paddingBottom: 10,
  backgroundColor: THEME.colors.surface,
  gap: 8
},

todayToggle: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 20,
  backgroundColor: '#F5F5F5'
},

todayToggleActive: {
  backgroundColor: THEME.colors.primary
},

todayToggleText: {
  fontSize: 13,
  fontWeight: '600',
  color: THEME.colors.textSecondary
},

todayToggleTextActive: {
  color: '#FFF'
},
dateFilterContainer: {
  paddingHorizontal: 16,
  paddingVertical: 10,
  backgroundColor: THEME.colors.surface,
},

dateChip: {
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: 20,
  backgroundColor: '#F5F5F5',
  marginRight: 8,
},

dateChipActive: {
  backgroundColor: THEME.colors.primary,
},

dateChipText: {
  fontSize: 12,
  fontWeight: '600',
  color: THEME.colors.textSecondary,
},

dateChipTextActive: {
  color: '#FFF',
},
webPickerOverlay: {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 999
},

webPickerBox: {
  width: 300,
  backgroundColor: '#FFF',
  borderRadius: 12,
  padding: 16
},

webPickerTitle: {
  fontSize: 16,
  fontWeight: '600'
},

webPickerClose: {
  marginTop: 16,
  backgroundColor: '#333',
  padding: 10,
  borderRadius: 8,
  alignItems: 'center'
},
webInput: {
  padding: 10,
  fontSize: 16,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#ccc',
  marginTop: 6
},
});
