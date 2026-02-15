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
  AppState,
  ActivityIndicator,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import BookingCard from '../components/BookingCard';
import { BookingListSkeleton } from '../components/Loader';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import Toast from '../components/Toast';
import NewBookingBanner from '../components/NewBookingBanner';
import { fetchBookings, fetchBookingsCount, getErrorMessage } from '../services/api';
import THEME from '../constants/theme';

const STATUS_FILTERS = ['ALL', 'CONFIRMED', 'SETTLED', 'CANCELLED', 'FAILED', 'PAYMENT_PENDING'];
const PAGE_SIZE = 20;
const POLLING_INTERVAL = 30000; // 30 seconds

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
  
  // New booking notification
  const [newBookingsCount, setNewBookingsCount] = useState(0);
  const lastKnownCount = useRef(0);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);

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

  // App state change handler for polling
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to foreground - check for new bookings
        checkForNewBookings();
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // Start polling when component mounts
  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, []);

  const startPolling = () => {
    stopPolling();
    pollingRef.current = setInterval(checkForNewBookings, POLLING_INTERVAL);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const checkForNewBookings = async () => {
    try {
      const { totalCount } = await fetchBookingsCount();
      if (lastKnownCount.current > 0 && totalCount > lastKnownCount.current) {
        setNewBookingsCount(totalCount - lastKnownCount.current);
      }
    } catch (err) {
      // Silent fail for polling
    }
  };

  const loadBookings = async (page: number = 0, append: boolean = false) => {
    try {
      if (!append) {
        setLoading(true);
        setCurrentPage(0);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      
      const data = await fetchBookings(page, PAGE_SIZE);
      const bookingsList = data?._embedded?.bookingDetailsResponses || [];
      const pageInfo = data?.page || {};
      
      setTotalPages(pageInfo.totalPages || 0);
      setTotalElements(pageInfo.totalElements || 0);
      setHasMore((page + 1) < (pageInfo.totalPages || 0));
      setCurrentPage(page);
      
      // Update last known count
      lastKnownCount.current = pageInfo.totalElements || 0;
      setNewBookingsCount(0);
      
      if (append) {
        const newBookings = [...bookings, ...bookingsList];
        setBookings(newBookings);
        filterBookings(newBookings, searchQuery, activeFilter);
      } else {
        setBookings(bookingsList);
        filterBookings(bookingsList, searchQuery, activeFilter);
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
    if (!loadingMore && hasMore && !loading) {
      loadBookings(currentPage + 1, true);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setNewBookingsCount(0);
    loadBookings(0, false);
  }, []);

  const handleNewBookingsBannerPress = () => {
    onRefresh();
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const filterBookings = (data: any[], search: string, status: string) => {
    let filtered = [...data];

    if (status !== 'ALL') {
      filtered = filtered.filter(
        (b) => b.status?.toUpperCase() === status.toUpperCase()
      );
    }

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

    setFilteredBookings(filtered);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    filterBookings(bookings, text, activeFilter);
  };

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    filterBookings(bookings, searchQuery, filter);
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
              onPress={() => router.push('/settings')}
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
              onPress={() => router.push('/settings')}
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
              {totalElements} Booking{totalElements !== 1 ? 's' : ''}
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
              style={styles.settingsButton}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={24} color={THEME.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
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
        {filteredBookings.length === 0 ? (
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
});
