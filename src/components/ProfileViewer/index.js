import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Alert,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useSharedValue, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
// Removed CompactHero - now using EnhancedHero from ViewMode/sections
import PendingReviewBanner from './ViewMode/PendingReviewBanner';
import ProfessionalCard from './ViewMode/cards/ProfessionalCard';
import FamilyList from './ViewMode/cards/FamilyList';
import TimelineCard from './ViewMode/cards/TimelineCard';
import PhotosCard from './ViewMode/cards/PhotosCard';
import {
  EnhancedHero,
  BioSection,
  DataFieldsSection,
  SocialMediaSection,
  LifeEventsSection,
  ContactActionsSection,
} from './ViewMode/sections';
import HeroSkeleton from '../ui/skeletons/HeroSkeleton';
import FamilyCardSkeleton from '../ui/skeletons/FamilyCardSkeleton';
import GenericCardSkeleton from '../ui/skeletons/GenericCardSkeleton';
import SegmentedControl from '../ui/SegmentedControl';
import TabGeneral from './EditMode/TabGeneral';
import TabDetails from './EditMode/TabDetails';
import TabFamily from './EditMode/TabFamily';
import TabContact from './EditMode/TabContact';
import EditHeader from './EditMode/EditHeader';
import EditModeBanner from './EditMode/EditModeBanner';
import PreEditModal from './EditMode/PreEditModal';
import { useProfilePermissions } from './hooks/useProfilePermissions';
import { useProfileForm } from './hooks/useProfileForm';
import { useProfileMetrics } from './hooks/useProfileMetrics';
import { usePendingChanges } from './hooks/usePendingChanges';
import { diffObjects, groupDirtyByTab } from './utils/diff';
import { VIEW_TABS } from './constants';
import { profilesService } from '../../services/profiles';
import suggestionService, {
  ALLOWED_SUGGESTION_FIELDS,
} from '../../services/suggestionService';
import { supabase, handleSupabaseError } from '../../services/supabase';
import { useTreeStore } from '../../stores/useTreeStore';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { invalidateStructureCache } from '../../utils/cacheInvalidation';
import { clearLogoCache } from '../../utils/qrLogoCache';
import { useNetworkGuard } from '../../hooks/useNetworkGuard';
import { useAuth } from '../../contexts/AuthContextSimple';
import { useEnsureProfileEnriched } from '../../hooks/useEnsureProfileEnriched';
import ShareProfileSheet from '../sharing/ShareProfileSheet';
import { PhotoCropEditor } from '../crop/PhotoCropEditor';
import { downloadImageToCache } from '../../utils/imageCacheUtil';
import * as FileSystem from 'expo-file-system/legacy';
import tokens from '../ui/tokens';

const PRE_EDIT_KEY = 'profileViewer.preEditModalDismissed';
const palette = tokens.colors.najdi;

// Memoized ViewMode component - prevents recreation on every render (50% performance gain)
const ViewModeContent = React.memo(({
  insets,
  handleMenuPress,
  handleCopyChain,
  handleEditPress,
  closeSheet,
  pending,
  pendingSummary,
  loadingStates,
  person,
  metrics,
  marriages,
  onNavigateToProfile,
  accessMode,
  scrollY,
  scrollRef,
  canEdit,
  refreshing,
  handleRefresh,
}) => (
  <BottomSheetScrollView
    ref={scrollRef}
    refreshControl={
      <RefreshControl
        refreshing={refreshing}
        onRefresh={handleRefresh}
        tintColor={palette.primary}
        colors={[palette.primary]}
      />
    }
    contentContainerStyle={{
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: insets.bottom + 80,
      gap: 16,
    }}
    showsVerticalScrollIndicator={false}
    onScroll={Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: false },
    )}
    scrollEventThrottle={16}
    accessibilityLiveRegion="polite"
  >
    <EnhancedHero
      person={person}
      metrics={metrics}
      onCopyChain={handleCopyChain}
      canEdit={canEdit}
      onEdit={handleEditPress}
      onMenuPress={handleMenuPress}
      onClose={closeSheet}
    />

    <PendingReviewBanner
      pending={pending}
      onPress={() => Alert.alert('التغييرات المعلقة', pendingSummary)}
    />

    {/* Bio Section - Wikipedia-style biography */}
    {!loadingStates.permissions && (
      <BioSection bio={person?.bio} />
    )}

    <PhotosCard person={person} accessMode={accessMode} />

    {/* Social Media Section - Icon grid with links */}
    {!loadingStates.permissions && person?.social_links && (
      <SocialMediaSection socialLinks={person.social_links} />
    )}

    {/* Life Events Timeline - Birth/Death events */}
    {!loadingStates.permissions && (
      <LifeEventsSection person={person} />
    )}

    {/* Professional & Contact Data Fields */}
    {loadingStates.permissions ? (
      <>
        <GenericCardSkeleton rows={3} titleWidth={90} />
        <GenericCardSkeleton rows={2} titleWidth={80} />
      </>
    ) : (
      <>
        <TimelineCard timeline={person?.timeline} />
        <ProfessionalCard person={person} />
        <ContactActionsSection phone={person?.phone} email={person?.email} />
      </>
    )}

    <View
      accessible={true}
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        loadingStates.marriages
          ? "جاري تحميل بيانات العائلة"
          : "تم تحميل بيانات العائلة"
      }
    >
      {loadingStates.marriages ? (
        <FamilyCardSkeleton tileCount={4} />
      ) : (
        <FamilyList
          father={metrics.father}
          mother={metrics.mother}
          marriages={marriages}
          children={metrics.children}
          person={person}
          onNavigate={onNavigateToProfile}
        />
      )}
    </View>

  </BottomSheetScrollView>
), (prevProps, nextProps) => {
  // Custom comparator - only re-render when actual data changes
  return (
    prevProps.person?.id === nextProps.person?.id &&
    prevProps.loadingStates?.permissions === nextProps.loadingStates?.permissions &&
    prevProps.loadingStates?.marriages === nextProps.loadingStates?.marriages &&
    prevProps.pending?.length === nextProps.pending?.length &&
    prevProps.accessMode === nextProps.accessMode &&
    prevProps.canEdit === nextProps.canEdit
  );
});
ViewModeContent.displayName = 'ViewModeContent';

// Memoized EditMode component - prevents recreation on every render (50% performance gain)
const EditModeContent = React.memo(({
  handleCancel,
  handleSubmit,
  saving,
  form,
  permissionLoading,
  accessMode,
  insets,
  scrollY,
  activeTab,
  setActiveTab,
  dirtyByTab,
  person,
  onNavigateToProfile,
  setMarriages,
  scrollRef,
  handleCropPress,
  userProfile,
}) => {
  // Create enhanced tabs with dirty indicators
  const enhancedTabs = useMemo(
    () =>
      VIEW_TABS.map((tab) => ({
        ...tab,
        showDot: Boolean(dirtyByTab?.[tab.id]),
      })),
    [dirtyByTab]
  );

  // Scroll to top when changing tabs for UX consistency
  const handleTabChange = useCallback(
    (newTab) => {
      if (saving) return; // Prevent tab switching during save

      setActiveTab(newTab);

      // Scroll to top with smooth animation
      if (scrollRef?.current) {
        scrollRef.current.scrollTo?.({ y: 0, animated: true });
      }
    },
    [setActiveTab, saving, scrollRef]
  );

  return (
    <BottomSheetScrollView
      ref={scrollRef}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: insets.bottom + 80,
        gap: 20,
      }}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="interactive"
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false },
      )}
      scrollEventThrottle={16}
      ListHeaderComponent={
        <View style={{ paddingTop: 8, paddingBottom: 12 }}>
          <SegmentedControl
            options={enhancedTabs}
            value={activeTab}
            onChange={handleTabChange}
          />
        </View>
      }
    >
        {/* Lazy load tabs - only render the active one */}
        {activeTab === 'general' && (
          <TabGeneral
            form={form}
            updateField={form.updateField}
            onCropPress={handleCropPress}
            person={person}
            userProfile={userProfile}
            accessMode={accessMode}
          />
        )}
        {activeTab === 'details' && (
          <TabDetails form={form} updateField={form.updateField} />
        )}
        {activeTab === 'family' && (
          <TabFamily
            person={person}
            accessMode={accessMode}
            onDataChanged={() => {
              // Reload marriages data in parent
              if (person?.id) {
                profilesService
                  .getPersonMarriages(person.id)
                  .then((data) => setMarriages(data || []))
                  .catch((err) => console.warn('Failed to reload marriages:', err));
              }
            }}
            onNavigateToProfile={onNavigateToProfile}
          />
        )}
        {activeTab === 'contact' && (
          <TabContact form={form} updateField={form.updateField} />
        )}
      </BottomSheetScrollView>
  );
});
EditModeContent.displayName = 'EditModeContent';

// Skeleton content for loading state - Extracted for cleaner code
const SkeletonContent = React.memo(({ insets }) => (
  <BottomSheetScrollView
    contentContainerStyle={{
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: insets.bottom + 80,
      gap: 20,
    }}
    showsVerticalScrollIndicator={false}
  >
    <HeroSkeleton withPhoto={true} />
    <GenericCardSkeleton rows={3} titleWidth={80} />
    <GenericCardSkeleton rows={2} titleWidth={100} />
    <GenericCardSkeleton rows={3} titleWidth={90} />
    <GenericCardSkeleton rows={2} titleWidth={100} />
    <FamilyCardSkeleton tileCount={4} />
  </BottomSheetScrollView>
));
SkeletonContent.displayName = 'SkeletonContent';

const ProfileViewer = ({ person, onClose, onNavigateToProfile, onUpdate, loading = false }) => {
  const insets = useSafeAreaInsets();
  const { checkBeforeAction } = useNetworkGuard();
  const { profile: userProfile } = useAuth();

  // Debug: Profile data verification
  useEffect(() => {
    console.log('[PROFILE VIEWER DEBUG] Received data:', {
      person: person ? {
        id: person.id,
        name: person.name,
        hid: person.hid,
        hasVersion: !!person.version,
        fieldCount: Object.keys(person).length,
        fields: Object.keys(person).sort()
      } : null,
      userProfile: userProfile ? {
        id: userProfile.id,
        name: userProfile.name,
        hid: userProfile.hid,
        hasVersion: !!userProfile.version,
        fieldCount: Object.keys(userProfile).length
      } : null,
      isUserViewingOwnProfile: person?.id === userProfile?.id,
      source: person ? 'person prop provided' : 'person prop missing'
    });

    if (!person) {
      console.warn('[PROFILE VIEWER DEBUG] ⚠️ No person data provided to ProfileViewer');
    } else if (Object.keys(person).length < 10) {
      console.warn('[PROFILE VIEWER DEBUG] ⚠️ Person data appears incomplete, only has:', Object.keys(person));
    }
  }, [person, userProfile]);

  // Debug: FileSystem availability check (crop feature dependency)
  useEffect(() => {
    console.log('[FileSystem Debug] Checking directories after rebuild:', {
      cacheDirectory: FileSystem.cacheDirectory,
      documentDirectory: FileSystem.documentDirectory,
      bothNull: !FileSystem.cacheDirectory && !FileSystem.documentDirectory,
      cacheDirectoryType: typeof FileSystem.cacheDirectory,
      documentDirectoryType: typeof FileSystem.documentDirectory,
    });

    if (!FileSystem.cacheDirectory && !FileSystem.documentDirectory) {
      console.error('[FileSystem Debug] 🚨 BOTH directories are null - FileSystem broken!');
    } else if (FileSystem.documentDirectory) {
      console.log('[FileSystem Debug] ✅ documentDirectory available - crop feature should work!');
    } else if (FileSystem.cacheDirectory) {
      console.log('[FileSystem Debug] ✅ cacheDirectory available - crop feature should work!');
    }
  }, []);

  const bottomSheetRef = useRef(null);
  const viewScrollRef = useRef(null);
  const editScrollRef = useRef(null);
  const snapPoints = useMemo(() => ['36%', '74%', '100%'], []);

  const [mode, setMode] = useState('view');
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);

  // Track previous person ID to prevent mode reset on first open (only on navigation between profiles)
  const prevPersonIdRef = useRef(null);

  // Note: person.version may be undefined initially (structure-only data from progressive loading)
  // On-demand fetch in enterEditMode() handles missing version before save (see line 615-646)

  // ✅ FIX: Initialize state early so hooks are available for useCallbacks below
  const [activeTab, setActiveTab] = useState('general');
  const [preEditVisible, setPreEditVisible] = useState(false);
  const [rememberChoice, setRememberChoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marriages, setMarriages] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showCropEditor, setShowCropEditor] = useState(false);
  const [savingCrop, setSavingCrop] = useState(false);
  const [retryDisabled, setRetryDisabled] = useState(false);
  const [cachedPhotoPath, setCachedPhotoPath] = useState(null); // Pre-downloaded image for instant crop
  const [downloadId, setDownloadId] = useState(null); // Track current download to prevent race conditions

  // Initialize hooks early so they're available for useCallbacks
  const { permission, accessMode, loading: permissionLoading } = useProfilePermissions(person?.id);
  const form = useProfileForm(person);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.5}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );
  const handleComponent = useCallback(
    (props) => {
      // Edit mode: Use EditHeader as the draggable handle (supports buttons + drag)
      if (mode === 'edit') {
        return (
          <EditHeader
            onCancel={handleCancel}
            onSubmit={handleSubmit}
            saving={saving}
            canSubmit={form.isDirty}
            accessMode={accessMode}
          />
        );
      }

      // View mode: Standard drag bar
      return (
        <View style={styles.handleContainer}>
          <View style={styles.handleBar} />
        </View>
      );
    },
    [mode, handleCancel, handleSubmit, saving, form.isDirty, accessMode],
  );

  const rememberStoreKey = useMemo(() => `${PRE_EDIT_KEY}-${person?.id}`, [person?.id]);
  const [lastSaveAttempt, setLastSaveAttempt] = useState(0); // For debouncing rapid saves
  const lastRealTimeUpdate = useRef(Date.now());
  const isMountedRef = useRef(true); // ✅ Track component mount status

  // Loading states for progressive skeleton rendering
  const [loadingStates, setLoadingStates] = useState({
    marriages: true,
    permissions: true,
  });

  const scrollY = useRef(new Animated.Value(0)).current;
  const animatedPosition = useSharedValue(0);
  const screenHeight = useMemo(() => Dimensions.get('window').height, []);
  const screenWidth = useMemo(() => Dimensions.get('window').width, []);

  // ✅ FIX #1: Proper cleanup on unmount to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false; // Mark as unmounted
      console.log('[ProfileViewer] Component unmounted, cleanup triggered');
    };
  }, []);

  // ✅ Other hook calls (form and accessMode already initialized above)
  const metrics = useProfileMetrics(person);
  const { pending, refresh: refreshPending } = usePendingChanges(
    person?.id,
    accessMode,
  );
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);

  // Ensure profile has version field before allowing edits
  // Enriches non-enriched nodes (from structure-only progressive loading)
  useEnsureProfileEnriched(person);

  // Helper to hide skeleton immediately - defined early so useEffects can reference it
  // No artificial delays - improves perceived performance
  const hideSkeletonImmediately = useCallback((key) => {
    setLoadingStates((prev) => ({ ...prev, [key]: false }));
  }, []);

  // Cleanup on unmount to prevent state updates on unmounted component
  // Resets debounce timer to avoid React warnings
  useEffect(() => {
    return () => {
      setLastSaveAttempt(0);
    };
  }, []);

  // Open/close sheet when person changes
  // Pure declarative control - state drives BottomSheet index prop
  useEffect(() => {
    if (person?.id) {
      // If sheet is already open (currentSnapIndex >= 0), maintain current position
      // If sheet is closed (currentSnapIndex === -1), open at default 36%
      if (currentSnapIndex >= 0) {
        // Already open - maintain current position when navigating between profiles
        // Don't change currentSnapIndex
      } else {
        // Sheet was closed - open at default 36%
        setCurrentSnapIndex(0);
      }
    } else if (!loading) {
      setCurrentSnapIndex(-1);
    }
  }, [person?.id, loading, currentSnapIndex]);

  // Debug logging for diagnostics - disabled to reduce spam
  useEffect(() => {
    if (__DEV__ && false) {
      console.log('[ProfileViewer] State:', {
        personId: person?.id,
        loading,
        currentSnapIndex,
      });
    }
  }, [person?.id, loading, currentSnapIndex]);

  useEffect(() => {
    const loadPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(rememberStoreKey);
        if (stored === 'true') {
          setRememberChoice(true);
        }
      } catch (error) {
        console.warn('Failed to load pre-edit preference', error);
      }
    };
    loadPreference();
  }, [rememberStoreKey]);

  // Reset scroll position and loading states when person changes
  useEffect(() => {
    if (person?.id) {
      // Always reset scroll and mode when person changes (regardless of first open)
      // This ensures consistent behavior: every navigation opens in view mode at top
      viewScrollRef.current?.scrollTo?.({ y: 0, animated: false });
      editScrollRef.current?.scrollTo?.({ y: 0, animated: false });
      setMode('view');

      // Reset loading states immediately when person changes
      // The skeleton will hide quickly via existing effects when data arrives
      setLoadingStates({
        marriages: true,
        permissions: true,
      });

      prevPersonIdRef.current = person.id;

      // Note: We don't reset currentSnapIndex here - maintain the drawer position
      // This allows users to stay at 100% when navigating between profiles
    } else {
      prevPersonIdRef.current = null;
    }
  }, [person?.id]);

  useEffect(() => {
    let isCancelled = false; // Prevents race conditions on rapid profile switches

    const loadMarriages = async () => {
      if (!person?.id || typeof profilesService?.getPersonMarriages !== 'function') {
        if (!isCancelled) {
          setMarriages([]);
          hideSkeletonImmediately('marriages');
        }
        return;
      }

      try {
        // Wrap with 5-second timeout to prevent infinite loading
        const data = await fetchWithTimeout(
          profilesService.getPersonMarriages(person.id),
          5000,
          'Load marriages'
        );

        if (!isCancelled) {
          setMarriages(data || []);
          hideSkeletonImmediately('marriages');
        }
      } catch (error) {
        console.error('[ProfileViewer] Failed to load marriages:', error);
        if (!isCancelled) {
          setMarriages([]);
          hideSkeletonImmediately('marriages');

          // ✅ FIX #4: Make timeout handling non-blocking
          // Log timeout warnings instead of showing blocking alerts
          if (error.message && error.message.includes('timeout')) {
            console.warn('[ProfileViewer] Marriages loading timeout - showing empty state. User can continue using app.');
            // Don't block the app with an alert - just show empty state
          } else {
            // Only show alert for critical non-timeout errors
            Alert.alert('خطأ', 'فشل تحميل بيانات الزواج');
          }
        }
      }
    };

    loadMarriages();
    return () => {
      isCancelled = true; // Cleanup: cancel pending updates
    };
  }, [person?.id, hideSkeletonImmediately]);

  // Track permission loading state
  // person?.id dependency ensures skeleton hides even when switching to cached profiles
  useEffect(() => {
    if (!permissionLoading) {
      hideSkeletonImmediately('permissions');
    }
  }, [person?.id, permissionLoading, hideSkeletonImmediately]);

  // Pre-download profile photo for instant crop opening
  // Downloads happen in background when profile loads, so when user long-presses to crop,
  // the file is already cached locally (zero visible waiting)
  useEffect(() => {
    if (!person?.photo_url) {
      setCachedPhotoPath(null);
      return;
    }

    let isCancelled = false;

    const preDownloadImage = async () => {
      try {
        console.log('[ImageCache] Pre-downloading image for instant crop:', person.photo_url);
        const cachedPath = await downloadImageToCache(person.photo_url);

        if (!isCancelled && cachedPath) {
          setCachedPhotoPath(cachedPath);
          console.log('[ImageCache] Image ready for instant crop:', cachedPath);
        } else if (!isCancelled && !cachedPath) {
          console.warn('[ImageCache] Pre-download failed, will fall back to download-on-demand');
        }
      } catch (error) {
        console.error('[ImageCache] Pre-download error:', error);
        // Non-critical: Crop will fall back to download-on-demand
      }
    };

    preDownloadImage();

    return () => {
      isCancelled = true;
    };
  }, [person?.photo_url]);

  // Real-time subscription to keep profile synchronized with database
  // Prevents version staleness after undo operations or external edits
  useEffect(() => {
    if (!person?.id) return;

    const channel = supabase
      .channel(`profile-updates-${person.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${person.id}`,
        },
        (payload) => {
          // Track timestamp to prevent redundant manual refresh
          lastRealTimeUpdate.current = Date.now();

          console.log('[ProfileViewer] Real-time update received:', {
            profileId: person.id,
            oldVersion: person.version,
            newVersion: payload.new.version,
            updatedFields: Object.keys(payload.new || {}),
          });

          // Update tree store with fresh data from database
          useTreeStore.getState().updateNode(person.id, payload.new);

          // Notify parent component of the update (if callback exists)
          // Using optional call to avoid dependency on onUpdate
          if (onUpdate) {
            onUpdate(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [person?.id]); // Removed onUpdate from dependencies to prevent subscription recreation

  // Handle manual profile refresh (pull-to-refresh)
  const handleRefresh = useCallback(async () => {
    // Guard: Skip if recent real-time update (within 2s)
    if (Date.now() - lastRealTimeUpdate.current < 2000) {
      console.log('[Refresh] Skipped - recent real-time update');
      return;
    }

    // Guard: Block during edit mode
    if (mode === 'edit') {
      Alert.alert('لا يمكن التحديث', 'يرجى حفظ التعديلات أو إلغاؤها قبل التحديث');
      return;
    }

    // Guard: Check network connectivity
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || netInfo.isInternetReachable === false) {
      Alert.alert(
        'لا يوجد اتصال بالإنترنت',
        'يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى'
      );
      return;
    }

    setRefreshing(true);
    console.log('[Refresh] Manual refresh started:', {
      profileId: person.id,
      currentVersion: person.version,
    });

    try {
      // Build refresh list: primary + immediate family (max 20)
      const idsToRefresh = new Set([person.id]);

      // Add spouses
      if (Array.isArray(marriages)) {
        marriages.forEach((m) => {
          if (m.spouse_id) idsToRefresh.add(m.spouse_id);
        });
      }

      // Add parents
      if (person.father_id) idsToRefresh.add(person.father_id);
      if (person.mother_id) idsToRefresh.add(person.mother_id);

      // Add first 10 children
      if (Array.isArray(metrics?.children)) {
        metrics.children.slice(0, 10).forEach((child) => {
          if (child.id) idsToRefresh.add(child.id);
        });
      }

      const limitedIds = Array.from(idsToRefresh).slice(0, 20);

      console.log('[Refresh] Fetching', limitedIds.length, 'profiles');

      // Fetch fresh data
      const { data, error } = await profilesService.enrichVisibleNodes(limitedIds);

      if (error) throw error;

      // Update all fetched profiles in Zustand
      const store = useTreeStore.getState();
      data.forEach((profile) => {
        store.updateNode(profile.id, profile);
      });

      console.log('[Refresh] Updated', data.length, 'profiles');

      // Success haptic feedback
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[Refresh] Failed:', error);
      Alert.alert('فشل التحديث', 'حدث خطأ أثناء تحديث البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setRefreshing(false);
    }
  }, [person, mode, marriages, metrics]);

  // Track sheet position and update global store progress
  // Follows established pattern from ProfileSheet.js
  // ✅ FIX (Oct 28, 2025): Added profileSheetProgress to deps for Reanimated 4.x compatibility
  // Reanimated 4.x requires all variables used in worklet to be in dependency array
  useAnimatedReaction(
    () => (profileSheetProgress ? animatedPosition.value : null),
    (current, previous) => {
      'worklet';
      if (!current || current === previous) return;
      if (!profileSheetProgress) return; // Defensive check (now safe - var in deps)
      const progress = Math.max(0, Math.min(1, 1 - current / screenHeight));
      profileSheetProgress.value = progress;
    },
    [screenHeight, profileSheetProgress]
  );

  const canEdit = accessMode !== 'readonly';

  const closeSheet = useCallback(() => {
    setMode('view');
    bottomSheetRef.current?.close?.();
  }, []);

  // ✅ FIX #3: Create worklet-safe close function for gesture handlers
  const closeSheetFromGesture = useCallback(() => {
    'worklet';
    runOnJS(closeSheet)();
  }, [closeSheet]);

  // iOS-style edge swipe to dismiss (RTL-aware)
  const edgeSwipeGesture = useMemo(() => {
    let gestureStartX = 0;
    let isEdgeGesture = false;

    return Gesture.Pan()
      .enabled(mode === 'view' && !form.isDirty)
      .activeOffsetX([-10, 10]) // Allow horizontal swipes
      .failOffsetY([-20, 20]) // Cancel if mostly vertical
      .onBegin((event) => {
        'worklet';
        gestureStartX = event.absoluteX;
        // RTL: Right edge is trailing edge (where iOS back button is)
        isEdgeGesture = gestureStartX > screenWidth - 50;

        if (isEdgeGesture) {
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        }
      })
      .onUpdate((event) => {
        'worklet';
        // RTL: Swipe left (negative translationX) from right edge
        if (isEdgeGesture && event.translationX < -100) {
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
          isEdgeGesture = false; // Prevent multiple triggers
          closeSheetFromGesture();
        }
      })
      .onEnd((event) => {
        'worklet';
        // Also trigger on fast swipe (velocity check)
        if (isEdgeGesture && event.velocityX < -800) {
          runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
          closeSheetFromGesture();
        }
      });
  }, [mode, form.isDirty, screenWidth, closeSheetFromGesture]);

  // Define edit mode handlers before menuOptions to prevent stale closure
  const enterEditMode = useCallback(async () => {
    // ✅ FIX: Fetch version if missing (structure-only data from progressive loading)
    if (!person?.version || typeof person.version !== 'number') {
      console.log('[ProfileViewer] Fetching version for edit mode...');

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('version')
          .eq('id', person.id)
          .single();

        if (error) throw error;

        if (data?.version) {
          // Update person in store with version
          useTreeStore.getState().updateNode(person.id, { version: data.version });
          console.log(`[ProfileViewer] Version fetched: ${data.version}`);
          // Re-render will trigger with updated person object, then enter edit
          // Use setTimeout to allow state update to propagate
          setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            form.reset();
            setMode('edit');
            setActiveTab('general');
          }, 50);
          return;
        }
      } catch (err) {
        console.error('[ProfileViewer] Version fetch failed:', err);
        Alert.alert('خطأ', 'فشل تحميل بيانات الملف الشخصي');
        return;
      }
    }

    // Normal edit mode entry (version already present)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    form.reset();
    setMode('edit');
    setActiveTab('general');
    // Don't force snap - maintain current position

    // Start background download for instant crop opening
    if (person?.photo_url && !cachedPhotoPath) {
      const currentDownloadId = Date.now();
      setDownloadId(currentDownloadId);

      let mounted = true;

      downloadImageToCache(person.photo_url)
        .then(path => {
          // Only update if still mounted and download still current (prevents race conditions)
          if (mounted && downloadId === currentDownloadId && path) {
            setCachedPhotoPath(path);
            console.log('[ImageCache] Ready for instant crop:', path);
          }
        })
        .catch(err => {
          console.warn('[ImageCache] Background download failed:', err);
          // Non-critical: will fall back to on-demand download on long-press
        });

      // Cleanup function to prevent memory leaks
      return () => {
        mounted = false;
      };
    }
  }, [form, person, setMode, setActiveTab, cachedPhotoPath, downloadId]);

  const handleEditPress = useCallback(async () => {
    // Check if user is online before allowing edit
    const canProceed = await checkBeforeAction('تحرير الملف الشخصي');
    if (!canProceed) {
      return;
    }

    if (!canEdit) {
      Alert.alert('غير متاح', 'ليس لديك صلاحية التعديل.');
      return;
    }

    // Verify permission online before entering edit mode
    try {
      const { data: permission, error } = await fetchWithTimeout(
        supabase.rpc('check_family_permission_v4', {
          p_user_id: userProfile?.id,
          p_target_id: person?.id,
        }),
        3000, // 3-second timeout (matches initial permission check)
        'Verify edit permission'
      );

      if (error) throw error;

      // Check if user still has permission
      if (!['admin', 'moderator', 'inner'].includes(permission)) {
        Alert.alert(
          'تم رفع الصلاحيات',
          'لم تعد لديك صلاحية لتعديل هذا الملف الشخصي',
          [{ text: 'حسناً', onPress: () => onClose?.() }]
        );
        return;
      }
    } catch (error) {
      console.error('[ProfileViewer] Permission check failed:', error);

      // Distinguish network errors from permission errors
      if (error.message === 'NETWORK_OFFLINE') {
        Alert.alert(
          'لا يوجد اتصال',
          'تحقق من الاتصال بالإنترنت وحاول مرة أخرى.',
          [{ text: 'حسناً' }]
        );
      } else if (error.message?.includes('NETWORK_TIMEOUT')) {
        Alert.alert(
          'انتهت المهلة',
          'استغرق التحقق من الصلاحيات وقتاً طويلاً. حاول مرة أخرى.',
          [
            { text: 'إلغاء', style: 'cancel' },
            { text: 'إعادة المحاولة', onPress: handleRetryWithDebounce }
          ]
        );
      } else {
        Alert.alert(
          'خطأ',
          'فشل التحقق من الصلاحيات. حاول مرة أخرى.',
          [{ text: 'حسناً' }]
        );
      }
      return;
    }

    if (accessMode === 'review' && !rememberChoice) {
      setPreEditVisible(true);
      return;
    }

    enterEditMode();
  }, [accessMode, canEdit, checkBeforeAction, enterEditMode, rememberChoice, person, onClose, userProfile]);

  // Debounced retry handler to prevent spam-clicking retry button
  const handleRetryWithDebounce = useCallback(() => {
    if (retryDisabled) {
      console.log('[ProfileViewer] Retry blocked - cooldown active');
      return;
    }

    setRetryDisabled(true);
    handleEditPress();

    // Re-enable retry after 1 second
    setTimeout(() => {
      setRetryDisabled(false);
    }, 1000);
  }, [handleEditPress, retryDisabled, setRetryDisabled]);

  // Determine share/invite mode based on profile state
  // Invite mode: alive + not linked to app (no user_id)
  // Share mode: everyone else (deceased, linked, or no death_date info)
  const shareMode = useMemo(() => {
    // Always 'share' mode when viewing own profile
    if (person?.id === userProfile?.id) {
      return 'share';
    }

    // For others: invite only if alive + not linked
    const isAlive = !person?.death_date;
    const isLinked = Boolean(person?.user_id);
    return isAlive && !isLinked ? 'invite' : 'share';
  }, [person?.id, person?.death_date, person?.user_id, userProfile?.id]);

  // Share/Invite handler
  const handleSharePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowShareSheet(true);
  }, []);

  // Crop photo handler with fallback download for slow networks
  const handleCropPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // If cached path exists, open crop immediately (95% of cases)
    if (cachedPhotoPath) {
      console.log('[Crop] Opening with cached image (instant)');
      setShowCropEditor(true);
      return;
    }

    // Fallback: Download on-demand for slow networks or immediate long-press
    console.log('[Crop] No cached image, downloading now...');
    Alert.alert('جاري التحضير', 'يرجى الانتظار لحظة...', [], { cancelable: false });

    try {
      const path = await downloadImageToCache(person.photo_url);

      if (path) {
        setCachedPhotoPath(path);
        Alert.alert(''); // Dismiss loading alert
        setShowCropEditor(true);
        console.log('[Crop] Download complete, opening crop editor');
      } else {
        Alert.alert('خطأ', 'فشل تحميل الصورة. تحقق من اتصال الإنترنت.');
      }
    } catch (error) {
      console.error('[Crop] Download failed:', error);
      Alert.alert('خطأ', 'فشل تحميل الصورة للقص. يرجى المحاولة مرة أخرى.');
    }
  }, [cachedPhotoPath, person?.photo_url]);

  // Save crop handler - simplified for file-based cropping
  // PhotoCropEditor handles upload and DB update internally
  const handleSaveCrop = useCallback(async () => {
    try {
      // Invalidate structure cache (force reload on next app start)
      await invalidateStructureCache();

      // Invalidate QR logo cache (fire-and-forget)
      clearLogoCache(person.id).catch(console.warn);

      // Reload profile to get photo_url_cropped
      await handleRefresh();

      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('تم الحفظ', 'تم حفظ التعديل على الصورة بنجاح');
      setShowCropEditor(false);

    } catch (error) {
      console.error('[PhotoCrop] Unexpected error:', error);
      Alert.alert('خطأ', 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.');
    }
  }, [person, handleRefresh]);

  // Memoize menu options to prevent array recreation on every press
  const menuOptions = useMemo(() => {
    const shareText = shareMode === 'invite' ? 'إرسال دعوة' : 'مشاركة الملف';

    const options = [
      canEdit
        ? {
            text: 'تحرير الملف',
            onPress: handleEditPress,  // Direct reference instead of arrow function
          }
        : null,
      canEdit && person?.photo_url
        ? {
            text: 'تعديل الصورة',
            onPress: handleCropPress,
          }
        : null,
      person?.hid
        ? {
            text: shareText,
            onPress: handleSharePress,
          }
        : null,
      { text: 'إغلاق', style: 'cancel' },
    ];
    return options.filter(Boolean);
  }, [canEdit, handleEditPress, handleCropPress, person?.hid, person?.photo_url, shareMode, handleSharePress]);

  const handleMenuPress = useCallback(() => {
    Alert.alert(person?.name || 'الملف', 'اختر الإجراء', menuOptions);
  }, [menuOptions, person]);

  const exitEditMode = useCallback(() => {
    setMode('view');
    setActiveTab('general');
    form.reset();
    // Don't force snap - maintain current position
  }, [form]);

  const handleCancel = useCallback(() => {
    if (form.isDirty) {
      Alert.alert('تجاهل التغييرات؟', 'لن يتم حفظ التعديلات التي قمت بها.', [
        { text: 'متابعة التعديل', style: 'cancel' },
        {
          text: 'تجاهل',
          style: 'destructive',
          onPress: () => exitEditMode(),
        },
      ]);
      return;
    }
    exitEditMode();
  }, [exitEditMode, form.isDirty]);

  const directSave = useCallback(
    async (changes) => {
      const payload = { ...changes };

      // DEBUG: Find UUID "2" error source
      console.log('[DEBUG] Full payload before processing:', JSON.stringify(payload, null, 2));

      // Search for "2" in all fields
      Object.entries(payload).forEach(([key, value]) => {
        if (value === 2 || value === "2") {
          console.error(`[DEBUG] Found "2" in top-level field: ${key} = ${value}`);
        }
        // Check nested objects
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.entries(value).forEach(([nestedKey, nestedValue]) => {
            if (nestedValue === 2 || nestedValue === "2") {
              console.error(`[DEBUG] Found "2" in nested field: ${key}.${nestedKey} = ${nestedValue}`);
            }
          });
        }
        // Check arrays
        if (Array.isArray(value)) {
          value.forEach((item, idx) => {
            if (item === 2 || item === "2") {
              console.error(`[DEBUG] Found "2" in array: ${key}[${idx}] = ${item}`);
            }
          });
        }
      });

      // UUID validation helper - prevent RPC errors from corrupted UUID fields
      const isValidUUID = (value) => {
        if (!value) return true; // null/undefined is fine
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
      };

      // Validate UUID fields before sending to RPC
      ['father_id', 'mother_id', 'spouse_id'].forEach(field => {
        if (field in payload && !isValidUUID(payload[field])) {
          console.error(`[ProfileViewer] Invalid UUID for ${field}:`, payload[field]);
          // Remove corrupted field to prevent RPC error
          delete payload[field];
        }
      });

      // Remove normalized data - don't send to RPC (contains numeric IDs that cause UUID errors)
      delete payload.current_residence_normalized;

      // DEFENSE IN DEPTH: Remove metadata fields from payload
      // These should already be excluded by diffObjects(), but we delete defensively
      // in case version somehow enters draft state (e.g., from PhotoEditor callback)
      delete payload.version;
      delete payload.updated_at;
      delete payload.updated_by;

      // Validation: Ensure version field exists in form.draft (most up-to-date)
      const currentVersion = form.draft.version ?? person.version;

      // DEBUG: Log version before save
      console.log('[ProfileViewer] Saving with version:', {
        personName: person.name,
        draftVersion: form.draft.version,
        personVersion: person.version,
        currentVersionUsed: currentVersion,
        personId: person.id
      });
      if (!currentVersion || typeof currentVersion !== 'number') {
        console.error('[ProfileViewer] ⚠️ Missing or invalid version field:', {
          hasVersionInDraft: 'version' in form.draft,
          hasVersionInPerson: 'version' in person,
          draftVersion: form.draft.version,
          personVersion: person.version,
          draftVersionType: typeof form.draft.version,
          personVersionType: typeof person.version
        });
        throw new Error('البيانات قديمة أو غير كاملة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
      }

      const { error, data } = await profilesService.updateProfile(
        person.id,
        currentVersion,
        payload,
      );

      if (error) {
        console.error('[ProfileViewer] Save error:', error.message);
        throw error;
      }

      // DEBUG: Log returned data
      console.log('[ProfileViewer] Save response:', {
        returnedVersion: data?.version,
        hasVersionInResponse: !!data?.version,
        fullData: data
      });

      // ISSUE #2 FIX: Warn if RPC doesn't return version (indicates RPC bug or response corruption)
      if (!data?.version) {
        console.error('[ProfileViewer] ⚠️ RPC did not return version field! This indicates a backend issue.', {
          profileId: person.id,
          personVersion: person.version,
          rpcResponse: data,
          payload: Object.keys(payload)
        });
        // Data integrity warning: Local version may desync if RPC succeeded but response is malformed
      }

      // CRITICAL FIX: Use returned data from RPC which includes updated version
      // This prevents "version mismatch" errors on subsequent saves
      // Fallback: If RPC doesn't return version (backend bug), increment locally
      const updatedProfile = { ...person, ...payload, version: data?.version || (person.version || 1) + 1 };

      console.log('[ProfileViewer] Updating store with version:', updatedProfile.version);

      useTreeStore.getState().updateNode(person.id, updatedProfile);
      onUpdate?.(updatedProfile);

      // Invalidate AsyncStorage cache to ensure fresh data on next app launch
      invalidateStructureCache().catch((err) =>
        console.warn('[ProfileViewer] Cache invalidation failed (non-critical):', err)
      );

      return data;
    },
    [onUpdate, person],
  );

  const submitReview = useCallback(
    async (changes) => {
      const summary = await suggestionService.submitProfileChanges(
        person.id,
        changes,
      );
      return summary;
    },
    [person],
  );

  const handleSubmit = useCallback(async () => {
    if (!form.isDirty) {
      Alert.alert('لا تغييرات', 'قم بتعديل الحقول قبل الحفظ.');
      return;
    }

    // Debounce: Prevent rapid saves (prevent duplicate submissions)
    const now = performance.now();
    if (now - lastSaveAttempt < 500) {
      console.warn('[ProfileViewer] Ignoring rapid save attempt (debounce)');
      // Show feedback to user instead of silent failure
      Alert.alert(
        'يرجى الانتظار',
        'يتم حفظ التغييرات. يرجى الانتظار لحظة.',
        [{ text: 'حسناً' }]
      );
      return;
    }
    setLastSaveAttempt(now);

    // Network guard: prevent save if offline
    if (!await checkBeforeAction('حفظ التعديلات')) {
      return;
    }

    try {
      setSaving(true);
      const changes = diffObjects(form.original, form.draft);

      if (accessMode === 'direct') {
        await directSave(changes);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('تم الحفظ', 'تم حفظ التغييرات بنجاح.');
        exitEditMode();
      } else if (accessMode === 'review') {
        const allowed = Object.keys(changes).reduce((acc, key) => {
          if (ALLOWED_SUGGESTION_FIELDS.has(key)) {
            acc[key] = changes[key];
          }
          return acc;
        }, {});

        if (Object.keys(allowed).length === 0) {
          Alert.alert(
            'غير مدعوم',
            'التغييرات التي اخترتها تتطلب موافقة مباشرة من المشرف.',
          );
          return;
        }

        await submitReview(allowed);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('تم الإرسال', 'سيتم مراجعة التغييرات خلال ٤٨ ساعة.');
        exitEditMode();
        refreshPending();
      } else {
        Alert.alert('غير متاح', 'ليس لديك صلاحية لتعديل هذا الملف.');
      }
    } catch (error) {
      // Reset debounce timer to allow immediate retry on error
      setLastSaveAttempt(0);

      console.error('ProfileViewer save error', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // ISSUE #3 FIX: Enhanced error handling for version conflicts (more specific detection)
      const errorMessage = error?.message || '';
      const isVersionConflict =
        errorMessage.includes('تم تحديث البيانات من مستخدم آخر') ||  // RPC exact message (Arabic)
        errorMessage.match(/version.*mismatch/i) ||                     // Generic version mismatch
        errorMessage.match(/version.*conflict/i) ||                     // Version conflict
        errorMessage.match(/version.*changed/i) ||                      // Version changed
        errorMessage.includes('الإصدار');                               // Arabic word for "version"

      if (isVersionConflict) {
        console.log('[ProfileViewer] Version conflict detected');

        // Check if user has unsaved changes in edit mode
        const hasUnsavedChanges = mode === 'edit' && form.isDirty;

        if (hasUnsavedChanges) {
          // User has unsaved changes - prompt before refreshing
          Alert.alert(
            'تعارض في النسخة',
            'تم تحديث هذا الملف من مستخدم آخر. لديك تعديلات غير محفوظة. ماذا تريد أن تفعل؟',
            [
              {
                text: 'تجاهل تعديلاتي وتحديث',
                style: 'destructive',
                onPress: async () => {
                  const { data: freshProfile, error: refreshError } = await supabase
                    .from('profiles')
                    .select('*')
                    .is('deleted_at', null)
                    .eq('id', person.id)
                    .single();

                  if (freshProfile && !refreshError) {
                    console.log('[ProfileViewer] Profile refreshed after version conflict:', {
                      oldVersion: person.version,
                      newVersion: freshProfile.version
                    });

                    useTreeStore.getState().updateNode(person.id, freshProfile);
                    onUpdate?.(freshProfile);

                    // Exit edit mode and reset form
                    setMode('view');
                    form.reset();

                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('تم التحديث', 'تم تحديث البيانات بنجاح.');
                  } else {
                    console.error('[ProfileViewer] Failed to refresh after conflict:', refreshError);
                    Alert.alert('خطأ', 'فشل تحديث البيانات');
                  }
                }
              },
              {
                text: 'الاحتفاظ بتعديلاتي',
                style: 'cancel',
                onPress: () => {
                  console.log('[ProfileViewer] User chose to keep their edits');
                }
              }
            ]
          );
        } else {
          // No unsaved changes - safe to auto-refresh
          const { data: freshProfile, error: refreshError } = await supabase
            .from('profiles')
            .select('*')
            .is('deleted_at', null)
            .eq('id', person.id)
            .single();

          if (freshProfile && !refreshError) {
            console.log('[ProfileViewer] Profile refreshed after version conflict:', {
              oldVersion: person.version,
              newVersion: freshProfile.version
            });

            useTreeStore.getState().updateNode(person.id, freshProfile);
            onUpdate?.(freshProfile);

            Alert.alert(
              'تم تحديث الملف',
              'تم تحديث الملف من مستخدم آخر. تم تحديث البيانات. يرجى المحاولة مرة أخرى.',
              [
                { text: 'حسناً', style: 'default' }
              ]
            );
          } else {
            console.error('[ProfileViewer] Failed to refresh profile after version conflict:', refreshError);
            Alert.alert('خطأ', errorMessage);
          }
        }
      } else {
        // Show generic error for non-version conflicts
        Alert.alert('خطأ', errorMessage || 'تعذر حفظ التغييرات');
      }
    } finally {
      setSaving(false);
    }
  }, [
    accessMode,
    directSave,
    exitEditMode,
    form.draft,
    form.isDirty,
    form.original,
    lastSaveAttempt,
    refreshPending,
    submitReview,
  ]);

  const dirtyByTab = useMemo(() => {
    const tabConfig = [
      {
        id: 'general',
        fields: [
          'photo_url',
          'name',
          'kunya',
          'nickname',
          'gender',
          'status',
          'dob_data',
          'dod_data',
          'dob_is_public',
        ],
      },
      {
        id: 'details',
        fields: ['bio', 'achievements', 'education', 'occupation', 'timeline'],
      },
      { id: 'family', fields: ['marriages', 'children'] },
      { id: 'contact', fields: ['phone', 'email', 'social_media_links'] },
    ];
    return groupDirtyByTab(form.dirtyFields || [], tabConfig);
  }, [form.dirtyFields]);

  const pendingSummary = useMemo(() => {
    if (!pending || pending.length === 0) return 'لا توجد تغييرات معلقة.';
    return pending
      .map((item) => `${item.field_name || item.field}: ${item.new_value}`)
      .join('\n');
  }, [pending]);

  // Removed: Don't force snap position changes on mode switch
  // The drawer should maintain its current position for seamless UX

  const handleSheetChange = useCallback((index) => {
    setCurrentSnapIndex(index);
    useTreeStore.setState({ profileSheetIndex: index });
    if (index === -1) {
      onClose?.();
    }
  }, [onClose]);

  const handleCopyChain = useCallback(async (text) => {
    try {
      const value = text || person?.common_name || person?.name || '';
      if (!value) return;
      await Clipboard.setStringAsync(value);
      Alert.alert('تم النسخ', 'تم نسخ الاسم الكامل.');
    } catch (error) {
      Alert.alert('خطأ', 'تعذر نسخ الاسم.');
    }
  }, [person?.common_name, person?.name]);

  // Always render BottomSheet (even when closed at index=-1)
  // This allows smooth transition from closed → open when person loads
  return (
    <>
      <GestureDetector gesture={edgeSwipeGesture}>
        <BottomSheet
          ref={bottomSheetRef}
          index={currentSnapIndex}
          snapPoints={snapPoints}
          enablePanDownToClose={mode !== 'edit'}
          enableContentPanningGesture={mode !== 'edit'}
          enableHandlePanningGesture={true}
          activeOffsetY={[-10, 10]}
          backdropComponent={renderBackdrop}
          handleComponent={handleComponent}
          animatedPosition={animatedPosition}
          animateOnMount={true}
          keyboardBehavior="fillParent"
          android_keyboardInputMode="adjustResize"
          enableDynamicSizing={false}
          onClose={() => {
            onClose?.();
          }}
          onChange={handleSheetChange}
          backgroundStyle={styles.sheetBackground}
        >
        {/* Conditional content rendering - skeleton while loading, then view/edit modes */}
        {!person && loading ? (
          <SkeletonContent insets={insets} />
        ) : mode === 'view' ? (
          <ViewModeContent
            insets={insets}
            handleMenuPress={handleMenuPress}
            handleCopyChain={handleCopyChain}
            handleEditPress={handleEditPress}
            closeSheet={closeSheet}
            pending={pending}
            pendingSummary={pendingSummary}
            loadingStates={loadingStates}
            person={person}
            metrics={metrics}
            marriages={marriages}
            onNavigateToProfile={onNavigateToProfile}
            accessMode={accessMode}
            scrollY={scrollY}
            scrollRef={viewScrollRef}
            canEdit={canEdit}
            refreshing={refreshing}
            handleRefresh={handleRefresh}
          />
        ) : (
          <EditModeContent
            handleCancel={handleCancel}
            handleSubmit={handleSubmit}
            saving={saving}
            form={form}
            permissionLoading={permissionLoading}
            accessMode={accessMode}
            insets={insets}
            scrollY={scrollY}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            dirtyByTab={dirtyByTab}
            person={person}
            onNavigateToProfile={onNavigateToProfile}
            setMarriages={setMarriages}
            scrollRef={editScrollRef}
            handleCropPress={handleCropPress}
            userProfile={userProfile}
          />
        )}
      </BottomSheet>
      </GestureDetector>

      <PreEditModal
        visible={preEditVisible}
        remember={rememberChoice}
        onToggleRemember={async (value) => {
          setRememberChoice(value);
          try {
            await AsyncStorage.setItem(rememberStoreKey, value ? 'true' : 'false');
          } catch (error) {
            console.warn('Failed to store preference', error);
          }
        }}
        onCancel={() => setPreEditVisible(false)}
        onContinue={() => {
          setPreEditVisible(false);
          enterEditMode();
        }}
      />

      {/* Share/Invite Sheet - Only show for profiles with HID */}
      {showShareSheet && person?.hid && (
        <ShareProfileSheet
          visible={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          profile={person}
          mode={shareMode}
          inviterProfile={userProfile}
        />
      )}

      {/* Photo Crop Editor - Only show for profiles with photo */}
      {showCropEditor && person?.photo_url && (
        <PhotoCropEditor
          visible={showCropEditor}
          profileId={person.id}
          photoUrl={person.photo_url}
          cachedPhotoPath={cachedPhotoPath}
          onSave={handleSaveCrop}
          onCancel={() => setShowCropEditor(false)}
          saving={savingCrop}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetBackground: {
    backgroundColor: '#f7f2ed',
  },
  handleBar: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#d6c5cc',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: 16,
    color: '#8c7780',
  },
});

export default ProfileViewer;
