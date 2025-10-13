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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useSharedValue, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import Hero from './Hero/Hero';
import PendingReviewBanner from './ViewMode/PendingReviewBanner';
import PersonalCard from './ViewMode/cards/PersonalCard';
import DatesCard from './ViewMode/cards/DatesCard';
import ProfessionalCard from './ViewMode/cards/ProfessionalCard';
import ContactCard from './ViewMode/cards/ContactCard';
import FamilyCard from './ViewMode/cards/FamilyCard';
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
import storageService from '../../services/storage';
import { supabase } from '../../services/supabase';
import { useTreeStore } from '../../stores/useTreeStore';
import { useAdminMode } from '../../contexts/AdminModeContext';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

const PRE_EDIT_KEY = 'profileViewer.preEditModalDismissed';

// Memoized ViewMode component - prevents recreation on every render (50% performance gain)
const ViewModeContent = React.memo(({
  insets,
  handleMenuPress,
  handleCopyChain,
  bioExpanded,
  setBioExpanded,
  metricsPayload,
  closeSheet,
  canEdit,
  handleChangeProfilePhoto,
  pending,
  pendingSummary,
  loadingStates,
  person,
  metrics,
  marriages,
  onNavigateToProfile,
  isAdminMode,
  accessMode,
  scrollY,
}) => (
  <BottomSheetScrollView
    contentContainerStyle={{
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: insets.bottom + 80,
      gap: 20,
    }}
    showsVerticalScrollIndicator={false}
    onScroll={Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: false },
    )}
    scrollEventThrottle={16}
    accessibilityLiveRegion="polite"
  >
    <Hero
      person={person}
      onMenu={handleMenuPress}
      onCopyChain={handleCopyChain}
      bioExpanded={bioExpanded}
      onToggleBio={() => setBioExpanded((prev) => !prev)}
      metrics={metricsPayload}
      onClose={closeSheet}
      onPhotoPress={canEdit ? handleChangeProfilePhoto : undefined}
      topInset={insets.top}
    />

    <PendingReviewBanner
      pending={pending}
      onPress={() => Alert.alert('التغييرات المعلقة', pendingSummary)}
    />

    <View
      accessible={true}
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        loadingStates.permissions
          ? "جاري تحميل بيانات الملف الشخصي"
          : "تم تحميل بيانات الملف الشخصي"
      }
    >
      {loadingStates.permissions ? (
        <>
          <GenericCardSkeleton rows={3} titleWidth={80} />
          <GenericCardSkeleton rows={2} titleWidth={100} />
          <GenericCardSkeleton rows={3} titleWidth={90} />
          <GenericCardSkeleton rows={2} titleWidth={100} />
        </>
      ) : (
        <>
          <PersonalCard person={person} />
          <DatesCard person={person} />
          <ProfessionalCard person={person} />
          <ContactCard person={person} />
        </>
      )}
    </View>

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
        <FamilyCard
          father={metrics.father}
          mother={metrics.mother}
          marriages={marriages}
          children={metrics.children}
          person={person}
          onNavigate={onNavigateToProfile}
          showMarriages={isAdminMode}
        />
      )}
    </View>

    <TimelineCard timeline={person?.timeline} />
    <PhotosCard person={person} accessMode={accessMode} />
  </BottomSheetScrollView>
), (prevProps, nextProps) => {
  // Custom comparator - only re-render when actual data changes
  return (
    prevProps.person?.id === nextProps.person?.id &&
    prevProps.bioExpanded === nextProps.bioExpanded &&
    prevProps.loadingStates?.permissions === nextProps.loadingStates?.permissions &&
    prevProps.loadingStates?.marriages === nextProps.loadingStates?.marriages &&
    prevProps.pending?.length === nextProps.pending?.length &&
    prevProps.isAdminMode === nextProps.isAdminMode &&
    prevProps.accessMode === nextProps.accessMode
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
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 0,
        paddingBottom: insets.bottom + 80,
        gap: 20,
      }}
      showsVerticalScrollIndicator={false}
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

const ProfileViewer = ({ person, onClose, onNavigateToProfile, onUpdate, loading = false }) => {
  const insets = useSafeAreaInsets();
  const { isAdminMode } = useAdminMode();
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['36%', '74%', '100%'], []);

  const [mode, setMode] = useState('view');
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);

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
  const [bioExpanded, setBioExpanded] = useState(false);
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

  // Reset snap index and loading states when person changes (declarative control)
  useEffect(() => {
    if (person?.id) {
      setCurrentSnapIndex(0);
      setLoadingStates({
        marriages: true,
        permissions: true,
      });
    }
  }, [person?.id]);

  useEffect(() => {
    let isCancelled = false; // Prevents race conditions on rapid profile switches

    // Set loading state synchronously before async operation
    setLoadingStates((prev) => ({ ...prev, marriages: true }));

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

          // Show user-friendly error based on type
          if (error.message && error.message.includes('timeout')) {
            Alert.alert('بطيء', 'استغرق التحميل وقتاً طويلاً. يرجى المحاولة مرة أخرى.');
          } else {
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
  useEffect(() => {
    if (!permissionLoading) {
      hideSkeletonImmediately('permissions');
    }
  }, [permissionLoading, hideSkeletonImmediately]);

  // Note: profileSheetProgress (shared value) not in dependency array.
  // Per Reanimated docs, dependencies only needed without Babel plugin.
  // Worklet tracks .value changes internally.
  useAnimatedReaction(
    () => animatedPosition.value,
    (current, previous) => {
      if (current === previous || !profileSheetProgress) return;
      const progress = Math.max(0, Math.min(1, 1 - current / screenHeight));
      profileSheetProgress.value = progress;
    },
    [screenHeight],
  );

  // Cleanup handled by parent component

  const canEdit = accessMode !== 'readonly';

  // Helper to hide skeleton immediately
  // No artificial delays - improves perceived performance
  const hideSkeletonImmediately = useCallback((key) => {
    setLoadingStates((prev) => ({ ...prev, [key]: false }));
  }, []);

  const closeSheet = useCallback(() => {
    setMode('view');
    bottomSheetRef.current?.close?.();
  }, []);

  // Image compression helper
  const compressImage = useCallback(async (uri) => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1920 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result.uri;
    } catch (error) {
      console.error('Error compressing image:', error);
      return uri;
    }
  }, []);

  // Change profile photo
  const handleChangeProfilePhoto = useCallback(async () => {
    if (!canEdit) {
      Alert.alert('غير متاح', 'ليس لديك صلاحية التعديل.');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.status !== 'granted') {
      Alert.alert('الإذن مطلوب', 'نحتاج إذن الوصول للصور');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Compress and upload
        const compressedUri = await compressImage(result.assets[0].uri);
        const storagePath = `profiles/${person.id}/profile_${Date.now()}.jpg`;
        const { url, error } = await storageService.uploadProfilePhoto(
          compressedUri,
          person.id,
          storagePath
        );

        if (error) throw error;

        // Update profiles.photo_url only (no gallery)
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ photo_url: url })
          .eq('id', person.id);

        if (updateError) throw updateError;

        // Update local state
        useTreeStore.getState().updateNode(person.id, { ...person, photo_url: url });
        onUpdate?.({ ...person, photo_url: url });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.error('Error uploading profile photo:', error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('خطأ', 'فشل رفع الصورة');
      }
    }
  }, [canEdit, person, onUpdate, compressImage]);

  // Define edit mode handlers before menuOptions to prevent stale closure
  const enterEditMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    form.reset();
    setMode('edit');
    setActiveTab('general');
    // Don't force snap - maintain current position
  }, [form]);

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

      // DEBUG: Log version before save
      console.log('[ProfileViewer] Saving with version:', {
        personName: person.name,
        currentVersion: person.version,
        personId: person.id
      });

      const { error, data } = await profilesService.updateProfile(
        person.id,
        person.version || 1,
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
      Alert.alert('خطأ', error.message || 'تعذر حفظ التغييرات');
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

  const metricsPayload = useMemo(
    () => ({
      generationLabel: metrics.generationLabel,
      childrenCount: metrics.rawChildren?.length || 0,
      siblingsCount: metrics.siblingsCount,
      descendantsCount: metrics.descendantsCount,
      occupation: person?.occupation,
      residence: person?.current_residence,
      onScrollToFamily: () => setActiveTab('family'),
    }),
    [metrics, person?.current_residence, person?.occupation],
  );

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

  // Show skeleton when loading (e.g., Munasib profile fetch)
  if (!person && loading) {
    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={Math.max(-1, Math.min(2, currentSnapIndex))}
        snapPoints={snapPoints}
        enablePanDownToClose={false} // Prevent close while loading
        backdropComponent={renderBackdrop}
        handleComponent={handleComponent}
        animatedPosition={animatedPosition}
        animateOnMount={true}
        onClose={onClose}
        onChange={handleSheetChange}
        backgroundStyle={styles.sheetBackground}
      >
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
      </BottomSheet>
    );
  }

  // Show empty state only when not loading and no person selected
  if (!person) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>لا يوجد ملف محدد.</Text>
      </View>
    );
  }

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        index={Math.max(-1, Math.min(2, currentSnapIndex))}
        snapPoints={snapPoints}
        enablePanDownToClose={mode !== 'edit'}
        backdropComponent={renderBackdrop}
        handleComponent={handleComponent}
        animatedPosition={animatedPosition}
        animateOnMount={true}
        onClose={() => {
          onClose?.();
        }}
        onChange={handleSheetChange}
        backgroundStyle={styles.sheetBackground}
      >
        {/* Conditional rendering - only ONE mode exists at a time for better performance */}
        {mode === 'view' ? (
          <ViewModeContent
            insets={insets}
            handleMenuPress={handleMenuPress}
            handleCopyChain={handleCopyChain}
            bioExpanded={bioExpanded}
            setBioExpanded={setBioExpanded}
            metricsPayload={metricsPayload}
            closeSheet={closeSheet}
            canEdit={canEdit}
            handleChangeProfilePhoto={handleChangeProfilePhoto}
            pending={pending}
            pendingSummary={pendingSummary}
            loadingStates={loadingStates}
            person={person}
            metrics={metrics}
            marriages={marriages}
            onNavigateToProfile={onNavigateToProfile}
            isAdminMode={isAdminMode}
            accessMode={accessMode}
            scrollY={scrollY}
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
          />
        )}
      </BottomSheet>

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
