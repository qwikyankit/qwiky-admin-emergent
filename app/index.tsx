import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from "@react-navigation/native";
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
  Modal,
  useWindowDimensions,
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
  isLoggedIn,
  fetchBookings,  
  fetchHoodExperts,
  fetchHoodItems,
  fetchHoods,
  getErrorMessage,
  logout,
} from '../services/api';
import THEME from '../constants/theme';

const STATUS_FILTERS = ['ALL', 'CONFIRMED', 'IN_PROGRESS', 'SETTLED', 'CANCELLED', 'FAILED', 'PAYMENT_PENDING'];
const PAGE_SIZE = 100;

export default function Home() {
  const router = useRouter();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const compactDatePicker = viewportWidth < 480 || viewportHeight < 720;
  const stackDatePickerActions = viewportWidth < 360;
  const [checkingAuth, setCheckingAuth] =
  useState(true);
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [pendingFilter, setPendingFilter] = useState('ALL');
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
  const [accountMenuVisible, setAccountMenuVisible] = useState(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [hoodSearchQuery, setHoodSearchQuery] = useState('');
  const [hoodStats, setHoodStats] = useState<Record<string, any>>({});

  const DATE_FILTERS = [
  'ALL',
  'TODAY',
  'TOMORROW',
  'DAY_AFTER',
  'CUSTOM'
];

const [activeDateFilter, setActiveDateFilter] = useState('TODAY');
const [pendingDateFilter, setPendingDateFilter] = useState('TODAY');
const [appliedCustomStartDate, setAppliedCustomStartDate] = useState<Date | null>(null);
const [appliedCustomEndDate, setAppliedCustomEndDate] = useState<Date | null>(null);
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
  filterBookings(bookings, searchQuery, activeFilter);
}, [bookings, searchQuery, activeFilter, activeDateFilter, appliedCustomStartDate, appliedCustomEndDate]);

useEffect(() => {
  const checkAuth = async () => {
    try {
      const loggedIn = await isLoggedIn();
      if (!loggedIn) {
        router.replace("/login");
        return;
      }
      setCheckingAuth(false);
    } catch {
      router.replace("/login");
    }
  };

  checkAuth();
}, []);

useEffect(() => {
  if (!checkingAuth) {
    loadHoods();
  }
}, [checkingAuth]);


const loadHoods = async () => {
  try {
    setAccessDenied(false);
    setError(null);
    setLoading(true);
    const data = await fetchHoods();
    setHoods(data || []);

    if (!data?.length) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    // Set default hood
    const defaultHood =
      data.find((h: any) => h.id === DEFAULT_HOOD_ID) ||
      data[0];

    if (defaultHood) {
      setSelectedHoodId(defaultHood.id);
      setSelectedHoodName(defaultHood.name);
    }

    const statsEntries = await Promise.all(
      (data || []).map(async (hood: any) => {
        try {
          const [experts, items] = await Promise.all([
            fetchHoodExperts(hood.id),
            fetchHoodItems(hood.id),
          ]);
          const expertList = experts || [];
          const itemList = items || [];
          const activeExperts = expertList.filter(
            expert => String(expert.status || '').toUpperCase() === 'ACTIVE',
          ).length;
          const categoryIds = new Set(
            expertList.flatMap(expert =>
              (expert.expertises || expert.expertiseList || expert.hoodUserExpertises || [])
                .map(expertise => expertise.categoryId)
                .filter(Boolean),
            ),
          );
          return [
            hood.id,
            {
              experts: {
                total: expertList.length,
                active: activeExperts,
                inactive: expertList.length - activeExperts,
                categories: categoryIds.size,
              },
              items: {
                total: itemList.length,
                available: itemList.filter(item => Boolean(item.isAvailable)).length,
                unavailable: itemList.filter(item => !item.isAvailable).length,
              },
            },
          ];
        } catch {
          return [hood.id, null];
        }
      }),
    );
    setHoodStats(Object.fromEntries(statsEntries));
  } catch (err: any) {
    const forbidden = err?.response?.status === 403;
    if (forbidden) {
      setAccessDenied(true);
      setError(null);
    } else {
      setError(getErrorMessage(err));
    }
    setLoading(false);
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
        setBookings(prev => {
          const byBookingId = new Map();
          [...prev, ...bookingsList].forEach(item => {
            const key = item.bookingId || item.bookingCode;
            if (key) byBookingId.set(key, item);
          });
          return Array.from(byBookingId.values());
        });
      } else {
        const byBookingId = new Map();
        bookingsList.forEach(item => {
          const key = item.bookingId || item.bookingCode;
          if (key) byBookingId.set(key, item);
        });
        setBookings(Array.from(byBookingId.values()));
      }
    } catch (err: any) {
      console.error('Failed to fetch bookings:', err);
      if (err?.response?.status === 403) {
        setAccessDenied(true);
        setError(null);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (!checkingAuth && selectedHoodId) {
        loadBookings(0, false);
      }
    }, [checkingAuth, selectedHoodId])
  );

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
        if (!appliedCustomStartDate) return true;

        const start = normalizeDate(appliedCustomStartDate);
        const end = normalizeDate(
          appliedCustomEndDate || appliedCustomStartDate
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

  // ✅ SORT BY CREATED DATE (LATEST FIRST)
  filtered.sort((a, b) => {
    const aCreated = new Date(a?.createdAt || 0);
    const bCreated = new Date(b?.createdAt || 0);

    return bCreated - aCreated; // newest first
  });

  setFilteredBookings(filtered);
};

  const handleSearch = (text: string) => {
    setSearchQuery(text);
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

const formatFilterDate = (date: Date | null) =>
  date
    ? date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : 'Select date';

const getActiveDateLabel = () => {
  if (activeDateFilter !== 'CUSTOM') {
    return activeDateFilter.replace('_', ' ');
  }
  return `${formatFilterDate(appliedCustomStartDate)} – ${formatFilterDate(appliedCustomEndDate)}`;
};

const visibleHoods = [...hoods]
  .filter((hood: any) => {
    const query = hoodSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return [hood.name, hood.hoodCode, hood.addressLine1, hood.addressLine2]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(query));
  })
  .sort((first: any, second: any) => {
    if (first.id === selectedHoodId) return -1;
    if (second.id === selectedHoodId) return 1;
    return String(first.name || '').localeCompare(String(second.name || ''));
  });

if (checkingAuth) {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator
        size="large"
        color={THEME.colors.primary}
      />

      <Text
        style={{
          marginTop: 12,
        }}
      >
        Checking session...
      </Text>
    </SafeAreaView>
  );
}
  if (accessDenied) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.accessDeniedContainer}>
          <View style={styles.accessDeniedIcon}>
            <Ionicons name="lock-closed-outline" size={38} color={THEME.colors.primary} />
          </View>
          <Text style={styles.accessDeniedTitle}>Hood access required</Text>
          <Text style={styles.accessDeniedMessage}>
            Your account is signed in, but it does not have access to any hood. Contact an administrator to assign the required permissions.
          </Text>
          <TouchableOpacity style={styles.accessDeniedPrimary} onPress={loadHoods}>
            <Ionicons name="refresh-outline" size={18} color="#FFF" />
            <Text style={styles.accessDeniedPrimaryText}>Check access again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.accessDeniedSecondary}
            onPress={async () => {
              await logout();
              router.replace('/login');
            }}
          >
            <Text style={styles.accessDeniedSecondaryText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  if (loading && bookings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Qwiky Admin</Text>
              <Text style={styles.headerSubtitle}>Booking Management</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.adminSettingsButton}
                onPress={() => router.push('/admin-settings')}
              >
                <Ionicons name="shield-checkmark-outline" size={23} color={THEME.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingsButton}
                disabled={!selectedHoodId}
                onPress={() =>
                  router.push({
                    pathname: '/settings',
                    params: { hoodId: selectedHoodId, hoodName: selectedHoodName },
                  })
                }
              >
                <Ionicons name="settings-outline" size={24} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>
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
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.adminSettingsButton}
                onPress={() => router.push('/admin-settings')}
              >
                <Ionicons name="shield-checkmark-outline" size={23} color={THEME.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingsButton}
                disabled={!selectedHoodId}
                onPress={() =>
                  router.push({
                    pathname: '/settings',
                    params: { hoodId: selectedHoodId, hoodName: selectedHoodName },
                  })
                }
              >
                <Ionicons name="settings-outline" size={24} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <ErrorState
          message={error}
          onRetry={() => (selectedHoodId ? loadBookings() : loadHoods())}
        />
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
              style={styles.accountButton}
              onPress={() => setAccountMenuVisible(true)}
            >
              <View style={styles.accountAvatar}>
                <Ionicons name="person-outline" size={21} color="#FFF" />
              </View>
              <Ionicons name="chevron-down" size={17} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Hood Dropdown */}
      <View style={styles.hoodDropdownWrapper}>
        <TouchableOpacity
          style={styles.hoodDropdownButton}
          onPress={() => {
            setHoodSearchQuery('');
            setShowHoodDropdown(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Select hood"
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
      </View>

      <Modal
        visible={showHoodDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHoodDropdown(false)}
      >
        <View style={styles.hoodPickerOverlay}>
          <View style={styles.hoodPickerSheet}>
            <View style={styles.hoodPickerHeader}>
              <View style={styles.hoodPickerHeading}>
                <Text style={styles.hoodPickerTitle}>Select Hood</Text>
                <Text style={styles.hoodPickerSubtitle}>
                  {hoods.length} {hoods.length === 1 ? 'hood' : 'hoods'} available
                </Text>
              </View>
              <TouchableOpacity
                style={styles.hoodPickerClose}
                onPress={() => setShowHoodDropdown(false)}
                accessibilityLabel="Close hood selector"
              >
                <Ionicons name="close" size={21} color={THEME.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.hoodPickerSearch}>
              <Ionicons name="search-outline" size={19} color={THEME.colors.textMuted} />
              <TextInput
                value={hoodSearchQuery}
                onChangeText={setHoodSearchQuery}
                placeholder="Search by hood name, code or address"
                placeholderTextColor={THEME.colors.textMuted}
                style={styles.hoodPickerSearchInput}
              />
              {Boolean(hoodSearchQuery) && (
                <TouchableOpacity onPress={() => setHoodSearchQuery('')}>
                  <Ionicons name="close-circle" size={19} color={THEME.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.hoodPickerList} showsVerticalScrollIndicator={false}>
              {visibleHoods.map((hood: any) => {
                const selected = hood.id === selectedHoodId;
                return (
                  <TouchableOpacity
                    key={hood.id}
                    style={[styles.hoodPickerOption, selected && styles.hoodPickerOptionSelected]}
                    onPress={() => {
                      setSelectedHoodId(hood.id);
                      setSelectedHoodName(hood.name);
                      setShowHoodDropdown(false);
                    }}
                  >
                    <View style={[styles.hoodPickerIcon, selected && styles.hoodPickerIconSelected]}>
                      <Ionicons
                        name="business-outline"
                        size={19}
                        color={selected ? THEME.colors.primary : THEME.colors.textSecondary}
                      />
                    </View>
                    <View style={styles.hoodPickerOptionCopy}>
                      <Text style={[styles.hoodPickerOptionName, selected && styles.hoodPickerOptionNameSelected]}>
                        {hood.name}
                      </Text>
                      <Text style={styles.hoodPickerOptionMeta} numberOfLines={1}>
                        {[hood.hoodCode, hood.addressLine1].filter(Boolean).join(' · ') || 'Hood'}
                      </Text>
                      {hoodStats[hood.id]?.experts && (
                        <Text style={styles.hoodPickerStats} numberOfLines={1}>
                          {hoodStats[hood.id].experts.total} experts ·{' '}
                          {hoodStats[hood.id].experts.active} active ·{' '}
                          {hoodStats[hood.id].experts.inactive} inactive ·{' '}
                          {hoodStats[hood.id].experts.categories} categories
                        </Text>
                      )}
                    </View>
                    {selected && (
                      <View style={styles.hoodPickerSelectedBadge}>
                        <Ionicons name="checkmark-circle" size={20} color={THEME.colors.primary} />
                        <Text style={styles.hoodPickerSelectedText}>Selected</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              {visibleHoods.length === 0 && (
                <View style={styles.hoodPickerEmpty}>
                  <Ionicons name="search-outline" size={25} color={THEME.colors.textMuted} />
                  <Text style={styles.hoodPickerEmptyTitle}>No hoods found</Text>
                  <Text style={styles.hoodPickerEmptyText}>Try another name, code, or address.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      <View style={styles.compactFilterBar}>
        <TouchableOpacity
          style={styles.filterSummary}
          onPress={() => {
            setPendingDateFilter(activeDateFilter);
            setPendingFilter(activeFilter);
            setFilterMenuVisible(true);
          }}
        >
          <View style={styles.filterSummaryIcon}>
            <Ionicons name="options-outline" size={18} color={THEME.colors.primary} />
          </View>
          <View style={styles.filterSummaryCopy}>
            <Text style={styles.filterSummaryTitle}>Filter bookings</Text>
            <Text style={styles.filterSummaryText}>
              {getActiveDateLabel()} · {activeFilter.replace('_', ' ')}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={19} color={THEME.colors.textSecondary} />
        </TouchableOpacity>
        {(activeDateFilter !== 'TODAY' || activeFilter !== 'ALL') && (
          <TouchableOpacity
            style={styles.quickReset}
            onPress={() => {
              setActiveDateFilter('TODAY');
              setActiveFilter('ALL');
            }}
          >
            <Ionicons name="close" size={18} color={THEME.colors.primary} />
          </TouchableOpacity>
        )}
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
                key={`${booking.bookingId || booking.bookingCode || index}-${booking.services?.[0]?.slotStart || 'no-slot'}-${booking.services?.[0]?.slotEnd || 'no-end'}`}
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

    setPendingDateFilter('CUSTOM');
    setFilterMenuVisible(true);
  }
}}
  />
)}

{Platform.OS === 'web' && webVisible && (
  <View style={styles.webPickerOverlay}>
    <View style={[styles.webPickerBox, compactDatePicker && styles.webPickerBoxCompact]}>
      <View style={[styles.webPickerHeader, compactDatePicker && styles.webPickerHeaderCompact]}>
        <View style={[styles.webPickerIcon, compactDatePicker && styles.webPickerIconCompact]}>
          <Ionicons name="calendar-outline" size={compactDatePicker ? 19 : 22} color={THEME.colors.primary} />
        </View>
        <View style={styles.webPickerHeadingCopy}>
          <Text style={[styles.webPickerTitle, compactDatePicker && styles.webPickerTitleCompact]}>Custom date range</Text>
          <Text style={styles.webPickerSubtitle}>Filter by scheduled service date</Text>
        </View>
      </View>

      <Text style={styles.webPickerLabel}>Start date</Text>
      <input
        type="date"
        value={customStartDate ? customStartDate.toISOString().split('T')[0] : ''}
        onChange={(e) => setCustomStartDate(new Date(e.target.value))}
        style={{
          ...StyleSheet.flatten([
            styles.webInput,
            compactDatePicker && styles.webInputCompact,
          ]),
          boxSizing: 'border-box',
        }}
      />

      <Text style={styles.webPickerLabel}>End date</Text>
      <input
        type="date"
        value={customEndDate ? customEndDate.toISOString().split('T')[0] : ''}
        onChange={(e) => setCustomEndDate(new Date(e.target.value))}
        style={{
          ...StyleSheet.flatten([
            styles.webInput,
            compactDatePicker && styles.webInputCompact,
          ]),
          boxSizing: 'border-box',
        }}
      />

      <View style={[styles.webPickerActions, stackDatePickerActions && styles.webPickerActionsStacked]}>

        <TouchableOpacity
          onPress={() => setWebVisible(false)}
          style={[styles.webPickerButton, styles.webPickerCancel, stackDatePickerActions && styles.webPickerButtonStacked]}
        >
          <Text style={styles.webPickerCancelText}>Cancel</Text>
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
      setPendingDateFilter('CUSTOM');
      setFilterMenuVisible(true);
    }
  }}
  style={[
    styles.webPickerButton,
    styles.webPickerApply,
    !customStartDate && styles.webPickerApplyDisabled,
    stackDatePickerActions && styles.webPickerButtonStacked,
  ]}
><Text style={styles.webPickerApplyText}>Continue</Text></TouchableOpacity>

      </View>

    </View>
  </View>
)}
      <Modal
        visible={filterMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterMenuVisible(false)}
      >
        <View style={styles.filterOverlay}>
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHeader}>
              <View>
                <Text style={styles.filterSheetTitle}>Filter bookings</Text>
                <Text style={styles.filterSheetSubtitle}>Choose filters, then show results</Text>
              </View>
              <TouchableOpacity style={styles.filterClose} onPress={() => setFilterMenuVisible(false)}>
                <Ionicons name="close" size={22} color={THEME.colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sheetGroupLabel}>Service date</Text>
            <View style={styles.sheetOptions}>
              {DATE_FILTERS.map(filter => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.sheetChip, pendingDateFilter === filter && styles.sheetChipActive]}
                  onPress={() => {
                    if (filter === 'CUSTOM') {
                      setFilterMenuVisible(false);
                      setPendingDateFilter('CUSTOM');
                      handleCustomDatePress();
                    } else {
                      setPendingDateFilter(filter);
                    }
                  }}
                >
                  <Text style={[styles.sheetChipText, pendingDateFilter === filter && styles.sheetChipTextActive]}>
                    {filter === 'DAY_AFTER' ? 'DAY AFTER' : filter.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {pendingDateFilter === 'CUSTOM' && (
              <TouchableOpacity
                style={styles.customRangePreview}
                onPress={() => {
                  setFilterMenuVisible(false);
                  handleCustomDatePress();
                }}
              >
                <Ionicons name="calendar-outline" size={18} color={THEME.colors.primary} />
                <View style={styles.customRangeCopy}>
                  <Text style={styles.customRangeLabel}>Selected range</Text>
                  <Text style={styles.customRangeValue}>
                    {formatFilterDate(customStartDate)} – {formatFilterDate(customEndDate)}
                  </Text>
                </View>
                <Text style={styles.customRangeEdit}>Edit</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.sheetGroupLabel}>Booking status</Text>
            <View style={styles.sheetOptions}>
              {STATUS_FILTERS.map(filter => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.sheetChip, pendingFilter === filter && styles.sheetChipActive]}
                  onPress={() => setPendingFilter(filter)}
                >
                  <Text style={[styles.sheetChipText, pendingFilter === filter && styles.sheetChipTextActive]}>
                    {filter.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.filterSheetActions}>
              <TouchableOpacity
                style={styles.resetSheetButton}
                onPress={() => {
                  setPendingDateFilter('TODAY');
                  setPendingFilter('ALL');
                }}
              >
                <Text style={styles.resetSheetText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applySheetButton}
                onPress={() => {
                  if (pendingDateFilter === 'CUSTOM') {
                    if (!customStartDate || !customEndDate) {
                      showToast('Select both start and end dates', 'warning');
                      return;
                    }
                    setAppliedCustomStartDate(customStartDate);
                    setAppliedCustomEndDate(customEndDate);
                  }
                  setActiveDateFilter(pendingDateFilter);
                  setActiveFilter(pendingFilter);
                  setFilterMenuVisible(false);
                }}
              >
                <Text style={styles.applySheetText}>Show results</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={accountMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountMenuVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.accountOverlay}
          onPress={() => setAccountMenuVisible(false)}
        >
          <View style={styles.accountSheet}>
            <View style={styles.accountHeader}>
              <View style={styles.accountLargeAvatar}>
                <Ionicons name="person-outline" size={25} color="#FFF" />
              </View>
              <View>
                <Text style={styles.accountTitle}>Admin account</Text>
                <Text style={styles.accountSubtitle}>{selectedHoodName || 'No hood selected'}</Text>
              </View>
            </View>

            {[
              {
                icon: 'notifications-outline',
                label: 'Notifications',
                action: () => router.push('/notification'),
              },
              {
                icon: 'add-circle-outline',
                label: 'Create assisted booking',
                disabled: !selectedHoodId,
                action: () =>
                  router.push({
                    pathname: '/assisted-booking',
                    params: { hoodId: selectedHoodId },
                  }),
              },
              {
                icon: 'settings-outline',
                label: 'Selected hood settings',
                disabled: !selectedHoodId,
                action: () =>
                  router.push({
                    pathname: '/settings',
                    params: { hoodId: selectedHoodId, hoodName: selectedHoodName },
                  }),
              },
              {
                icon: 'shield-checkmark-outline',
                label: 'Admin settings',
                action: () => router.push('/admin-settings'),
              },
            ].map(item => (
              <TouchableOpacity
                key={item.label}
                disabled={item.disabled}
                style={[styles.accountMenuItem, item.disabled && styles.accountMenuItemDisabled]}
                onPress={() => {
                  setAccountMenuVisible(false);
                  item.action();
                }}
              >
                <View style={styles.accountMenuIcon}>
                  <Ionicons name={item.icon} size={20} color={THEME.colors.primary} />
                </View>
                <Text style={styles.accountMenuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  accessDeniedContainer: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessDeniedIcon: {
    width: 78,
    height: 78,
    marginBottom: 20,
    borderRadius: 24,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessDeniedTitle: {
    color: THEME.colors.text,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  accessDeniedMessage: {
    maxWidth: 420,
    marginTop: 9,
    color: THEME.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  accessDeniedPrimary: {
    minHeight: 46,
    marginTop: 24,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: THEME.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  accessDeniedPrimaryText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  accessDeniedSecondary: { marginTop: 10, paddingHorizontal: 20, paddingVertical: 11 },
  accessDeniedSecondaryText: { color: THEME.colors.textSecondary, fontSize: 13, fontWeight: '700' },
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
  accountButton: {
    height: 44,
    paddingHorizontal: 7,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  accountAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountOverlay: {
    flex: 1,
    padding: 18,
    backgroundColor: 'rgba(15,23,42,0.35)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  accountSheet: {
    width: '100%',
    maxWidth: 360,
    marginTop: 55,
    padding: 15,
    borderRadius: 19,
    backgroundColor: '#FFF',
  },
  accountHeader: {
    padding: 8,
    paddingBottom: 15,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  accountLargeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTitle: { fontSize: 16, fontWeight: '800', color: THEME.colors.text },
  accountSubtitle: { marginTop: 3, fontSize: 11, color: THEME.colors.textSecondary },
  accountMenuItem: {
    minHeight: 52,
    paddingHorizontal: 8,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountMenuItemDisabled: { opacity: 0.4 },
  accountMenuIcon: {
    width: 36,
    height: 36,
    marginRight: 9,
    borderRadius: 10,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountMenuLabel: { flex: 1, color: THEME.colors.text, fontWeight: '700' },
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
  adminSettingsButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
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
  filterPanel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  filterHeadingRow: {
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterHeadingText: { color: THEME.colors.text, fontSize: 14, fontWeight: '800' },
  clearFilters: { color: THEME.colors.primary, fontSize: 12, fontWeight: '800' },
  filterGroupLabel: {
    marginTop: 7,
    marginBottom: 7,
    color: THEME.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  compactFilterBar: {
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 12,
    backgroundColor: THEME.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterSummary: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F8F7FC',
    borderWidth: 1,
    borderColor: '#EEEAF7',
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterSummaryIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  filterSummaryCopy: { flex: 1, marginHorizontal: 9 },
  filterSummaryTitle: { color: THEME.colors.text, fontSize: 13, fontWeight: '800' },
  filterSummaryText: { marginTop: 2, color: THEME.colors.primary, fontSize: 10, fontWeight: '700' },
  quickReset: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  filterOverlay: { flex: 1, padding: 18, backgroundColor: 'rgba(15,23,42,0.45)', alignItems: 'center', justifyContent: 'center' },
  filterSheet: { width: '100%', maxWidth: 440, padding: 19, borderRadius: 20, backgroundColor: '#FFF' },
  filterSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterSheetTitle: { color: THEME.colors.text, fontSize: 20, fontWeight: '900' },
  filterSheetSubtitle: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 11 },
  filterClose: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sheetGroupLabel: { marginTop: 20, marginBottom: 9, color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  sheetOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, backgroundColor: '#F3F4F6' },
  sheetChipActive: { backgroundColor: THEME.colors.primary },
  sheetChipText: { color: THEME.colors.textSecondary, fontSize: 11, fontWeight: '800' },
  sheetChipTextActive: { color: '#FFF' },
  customRangePreview: { marginTop: 12, minHeight: 58, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: '#E9D5FF', backgroundColor: '#FAF5FF', flexDirection: 'row', alignItems: 'center' },
  customRangeCopy: { flex: 1, marginHorizontal: 10 },
  customRangeLabel: { color: THEME.colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  customRangeValue: { marginTop: 3, color: THEME.colors.text, fontSize: 12, fontWeight: '800' },
  customRangeEdit: { color: THEME.colors.primary, fontSize: 11, fontWeight: '800' },
  filterSheetActions: { marginTop: 23, flexDirection: 'row', gap: 10 },
  resetSheetButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  resetSheetText: { color: THEME.colors.textSecondary, fontWeight: '800' },
  applySheetButton: { flex: 2, minHeight: 46, borderRadius: 12, backgroundColor: THEME.colors.primary, alignItems: 'center', justifyContent: 'center' },
  applySheetText: { color: '#FFF', fontWeight: '800' },
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

hoodPickerOverlay: {
  flex: 1,
  padding: 18,
  backgroundColor: 'rgba(15,23,42,0.5)',
  alignItems: 'center',
  justifyContent: 'center',
},
hoodPickerSheet: {
  width: '100%',
  maxWidth: 450,
  maxHeight: '82%',
  padding: 18,
  borderRadius: 22,
  backgroundColor: '#FFF',
},
hoodPickerHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},
hoodPickerHeading: { flex: 1, paddingRight: 12 },
hoodPickerTitle: { color: THEME.colors.text, fontSize: 21, fontWeight: '900' },
hoodPickerSubtitle: { marginTop: 3, color: THEME.colors.textSecondary, fontSize: 11 },
hoodPickerClose: {
  width: 38,
  height: 38,
  borderRadius: 11,
  backgroundColor: '#F3F4F6',
  alignItems: 'center',
  justifyContent: 'center',
},
hoodPickerSearch: {
  minHeight: 48,
  marginTop: 16,
  paddingHorizontal: 12,
  borderRadius: 13,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  backgroundColor: '#F8F7FC',
  flexDirection: 'row',
  alignItems: 'center',
},
hoodPickerSearchInput: {
  flex: 1,
  marginHorizontal: 9,
  color: THEME.colors.text,
  fontSize: 13,
},
hoodPickerList: { marginTop: 11 },
hoodPickerOption: {
  minHeight: 68,
  paddingVertical: 10,
  paddingHorizontal: 10,
  borderRadius: 13,
  borderWidth: 1,
  borderColor: 'transparent',
  flexDirection: 'row',
  alignItems: 'center',
},
hoodPickerOptionSelected: {
  borderColor: '#E9D5FF',
  backgroundColor: '#FAF5FF',
},
hoodPickerIcon: {
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: '#F3F4F6',
  alignItems: 'center',
  justifyContent: 'center',
},
hoodPickerIconSelected: { backgroundColor: '#F3E8FF' },
hoodPickerOptionCopy: { flex: 1, marginHorizontal: 10 },
hoodPickerOptionName: { color: THEME.colors.text, fontSize: 14, fontWeight: '700' },
hoodPickerOptionNameSelected: { color: THEME.colors.primary, fontWeight: '900' },
hoodPickerOptionMeta: { marginTop: 3, color: THEME.colors.textMuted, fontSize: 10 },
hoodPickerStats: { marginTop: 4, color: THEME.colors.primary, fontSize: 9, fontWeight: '700' },
hoodPickerSelectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
hoodPickerSelectedText: { color: THEME.colors.primary, fontSize: 10, fontWeight: '800' },
hoodPickerEmpty: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
hoodPickerEmptyTitle: { marginTop: 8, color: THEME.colors.text, fontSize: 14, fontWeight: '800' },
hoodPickerEmptyText: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 11 },
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
  padding: 20,
  backgroundColor: 'rgba(15,23,42,0.58)',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 999
},

webPickerBox: {
  width: '92%',
  maxWidth: 400,
  maxHeight: '90%',
  backgroundColor: '#FFF',
  borderRadius: 22,
  padding: 22
},
webPickerBoxCompact: {
  width: '94%',
  padding: 16,
  borderRadius: 18
},

webPickerHeader: {
  marginBottom: 20,
  flexDirection: 'row',
  alignItems: 'center'
},
webPickerHeaderCompact: {
  marginBottom: 12
},
webPickerIcon: {
  width: 44,
  height: 44,
  marginRight: 12,
  borderRadius: 13,
  backgroundColor: '#F3E8FF',
  alignItems: 'center',
  justifyContent: 'center'
},
webPickerIconCompact: {
  width: 38,
  height: 38,
  marginRight: 10,
  borderRadius: 11
},
webPickerHeadingCopy: {
  flex: 1
},
webPickerTitle: {
  color: THEME.colors.text,
  fontSize: 20,
  fontWeight: '900'
},
webPickerTitleCompact: {
  fontSize: 17
},
webPickerSubtitle: {
  marginTop: 3,
  color: THEME.colors.textSecondary,
  fontSize: 11
},
webPickerLabel: {
  marginTop: 12,
  marginBottom: 7,
  color: THEME.colors.textSecondary,
  fontSize: 11,
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: 0.6
},
webInput: {
  width: '100%',
  minHeight: 48,
  padding: 12,
  color: THEME.colors.text,
  fontSize: 15,
  fontWeight: '600',
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#DDD6E8',
  backgroundColor: '#F8F7FC'
},
webInputCompact: {
  minHeight: 42,
  padding: 9,
  fontSize: 14
},
webPickerActions: {
  marginTop: 24,
  flexDirection: 'row',
  gap: 10
},
webPickerActionsStacked: {
  flexDirection: 'column-reverse'
},
webPickerButton: {
  minHeight: 48,
  borderRadius: 12,
  alignItems: 'center',
  justifyContent: 'center'
},
webPickerButtonStacked: {
  flex: 0,
  width: '100%'
},
webPickerCancel: {
  flex: 1,
  backgroundColor: '#F3F4F6'
},
webPickerCancelText: {
  color: THEME.colors.textSecondary,
  fontWeight: '800'
},
webPickerApply: {
  flex: 2,
  backgroundColor: THEME.colors.primary
},
webPickerApplyDisabled: {
  opacity: 0.4
},
webPickerApplyText: {
  color: '#FFF',
  fontWeight: '800'
},
notificationButton: {
  padding: 8,
  borderRadius: 12,
  backgroundColor: '#EEF2FF',
},
});
