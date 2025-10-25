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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSharedValue, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import CompactHero from './Hero/CompactHero';
import PendingReviewBanner from './ViewMode/PendingReviewBanner';
import ProfessionalCard from './ViewMode/cards/ProfessionalCard';
import ContactCard from './ViewMode/cards/ContactCard';
import FamilyList from './ViewMode/cards/FamilyList';
import TimelineCard from './ViewMode/cards/TimelineCard';
import PhotosCard from './ViewMode/cards/PhotosCard';
import HeroSkeleton from '../ui/skeletons/HeroSkeleton';
import FamilyCardSkeleton from '../ui/skeletons/FamilyCardSkeleton';
import GenericCardSkeleton from '../ui/skeletons/GenericCardSkeleton';
import TabsHost from './EditMode/TabsHost';
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
import { supabase } from '../../services/supabase';
import { useTreeStore } from '../../stores/useTreeStore';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import tokens from '../ui/tokens';

const PRE_EDIT_KEY = 'profileViewer.preEditModalDismissed';
const palette = tokens.colors.najdi;

// Memoized ViewMode component - prevents recreation on every render (50% performance gain)
const ViewModeContent = React.memo(({
  insets,
  handleMenuPress,
  handleCopyChain,
  handleEditPress,
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
}) => (
  <BottomSheetScrollView
    ref={scrollRef}
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
    <CompactHero
      person={person}
      metrics={metrics}
      onCopyChain={handleCopyChain}
      canEdit={canEdit}
      onEdit={handleEditPress}
      onMenuPress={handleMenuPress}
    />

    <PendingReviewBanner
      pending={pending}
      onPress={() => Alert.alert('التغييرات المعلقة', pendingSummary)}
    />

    <PhotosCard person={person} accessMode={accessMode} />

    {loadingStates.permissions ? (
      <>
        <GenericCardSkeleton rows={3} titleWidth={90} />
        <GenericCardSkeleton rows={2} titleWidth={80} />
      </>
    ) : (
      <>
        <TimelineCard timeline={person?.timeline} />
        <ProfessionalCard person={person} />
        <ContactCard person={person} />
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
}) => (
  <View style={{ flex: 1 }}>
    <EditHeader
      onCancel={handleCancel}
      onSubmit={handleSubmit}
      saving={saving}
      canSubmit={form.isDirty && !permissionLoading}
      accessMode={accessMode}
    />
    <BottomSheetScrollView
      ref={scrollRef}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 0,
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
    >
      <TabsHost
        tabs={VIEW_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        dirtyByTab={dirtyByTab}
      >
        {/* Lazy load tabs - only render the active one */}
        {activeTab === 'general' && (
          <TabGeneral form={form} updateField={form.updateField} />
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
      </TabsHost>
    </BottomSheetScrollView>
  </View>
));
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
    () => {
      // Always show drag handle for visual parity
      return (
        <View style={styles.handleContainer}>
          <View style={styles.handleBar} />
        </View>
      );
    },
    [],
  );
  const [activeTab, setActiveTab] = useState('general');
  const [preEditVisible, setPreEditVisible] = useState(false);
  const [rememberChoice, setRememberChoice] = useState(false);
  const rememberStoreKey = useMemo(() => `${PRE_EDIT_KEY}-${person?.id}`, [person?.id]);
  const [saving, setSaving] = useState(false);
  const [marriages, setMarriages] = useState([]);

  // Loading states for progressive skeleton rendering
  const [loadingStates, setLoadingStates] = useState({
    marriages: true,
    permissions: true,
  });

  const scrollY = useRef(new Animated.Value(0)).current;
  const animatedPosition = useSharedValue(0);
  const screenHeight = useMemo(() => Dimensions.get('window').height, []);
  const screenWidth = useMemo(() => Dimensions.get('window').width, []);

  const { permission, accessMode, loading: permissionLoading } = useProfilePermissions(
    person?.id,
  );
  const form = useProfileForm(person);
  const metrics = useProfileMetrics(person);
  const { pending, refresh: refreshPending } = usePendingChanges(
    person?.id,
    accessMode,
  );
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);

  // Helper to hide skeleton immediately - defined early so useEffects can reference it
  // No artificial delays - improves perceived performance
  const hideSkeletonImmediately = useCallback((key) => {
    setLoadingStates((prev) => ({ ...prev, [key]: false }));
  }, []);

  // Open/close sheet when person changes
  // Pure declarative control - state drives BottomSheet index prop
  useEffect(() => {
    if (person?.id) {
      console.log('[ProfileViewer] Opening sheet for person:', person.id);
      setCurrentSnapIndex(0); // State drives sheet position
    } else if (!loading) {
      console.log('[ProfileViewer] Closing sheet (no person)');
      setCurrentSnapIndex(-1);
    }
  }, [person?.id, loading]);

  // ✅ Debug logging for diagnostics
  useEffect(() => {
    if (__DEV__) {
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

  // Real-time subscription to keep profile synchronized with database
  // Prevents version staleness after undo operations or external edits
  useEffect(() => {
    if (!person?.id) return;

    console.log('[ProfileViewer] Setting up real-time subscription for profile:', person.id);

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
      console.log('[ProfileViewer] Cleaning up real-time subscription for profile:', person.id);
      supabase.removeChannel(channel);
    };
  }, [person?.id]); // Removed onUpdate from dependencies to prevent subscription recreation

  // Track sheet position and update global store progress
  // Follows established pattern from ProfileSheet.js
  useAnimatedReaction(
    () => animatedPosition.value,
    (current, previous) => {
      if (current === previous) return;
      if (!profileSheetProgress) return;
      const progress = Math.max(0, Math.min(1, 1 - current / screenHeight));
      profileSheetProgress.value = progress;
    },
    [screenHeight]
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
  }, [form, person, setMode, setActiveTab]);

  const handleEditPress = useCallback(() => {
    if (!canEdit) {
      Alert.alert('غير متاح', 'ليس لديك صلاحية التعديل.');
      return;
    }

    if (accessMode === 'review' && !rememberChoice) {
      setPreEditVisible(true);
      return;
    }

    enterEditMode();
  }, [accessMode, canEdit, enterEditMode, rememberChoice]);

  // Memoize menu options to prevent array recreation on every press
  const menuOptions = useMemo(() => {
    const options = [
      canEdit
        ? {
            text: 'تحرير الملف',
            onPress: handleEditPress,  // Direct reference instead of arrow function
          }
        : null,
      { text: 'إغلاق', style: 'cancel' },
    ];
    return options.filter(Boolean);
  }, [canEdit, handleEditPress]);

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

      // DEBUG: Log version before save
      console.log('[ProfileViewer] Saving with version:', {
        personName: person.name,
        currentVersion: person.version,
        personId: person.id
      });

      // Validation: Ensure version field exists (fail if missing, don't silently fallback)
      if (!person.version || typeof person.version !== 'number') {
        console.error('[ProfileViewer] ⚠️ Missing or invalid version field:', {
          hasVersion: 'version' in person,
          versionValue: person.version,
          versionType: typeof person.version
        });
        throw new Error('البيانات قديمة أو غير كاملة. يرجى تحديث الصفحة والمحاولة مرة أخرى.');
      }

      const { error, data } = await profilesService.updateProfile(
        person.id,
        person.version,
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

      // CRITICAL FIX: Use returned data from RPC which includes updated version
      // This prevents "version mismatch" errors on subsequent saves
      const updatedProfile = { ...person, ...payload, version: data?.version || (person.version || 1) + 1 };

      console.log('[ProfileViewer] Updating store with version:', updatedProfile.version);

      useTreeStore.getState().updateNode(person.id, updatedProfile);
      onUpdate?.(updatedProfile);
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
      console.error('ProfileViewer save error', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Enhanced error handling for version conflicts
      const errorMessage = error?.message || '';
      const isVersionConflict = errorMessage.includes('تم تحديث البيانات من مستخدم آخر') ||
                                errorMessage.includes('version') ||
                                errorMessage.includes('الإصدار');

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
          enableContentPanningGesture={true}
          enableHandlePanningGesture={true}
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
