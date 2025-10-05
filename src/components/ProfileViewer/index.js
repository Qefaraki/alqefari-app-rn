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

const PRE_EDIT_KEY = 'profileViewer.preEditModalDismissed';

const ProfileViewer = ({ person, onClose, onNavigateToProfile, onUpdate }) => {
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
  const scrollY = useRef(new Animated.Value(0)).current;
  const viewOpacity = useRef(new Animated.Value(1)).current;
  const editOpacity = useRef(new Animated.Value(0)).current;
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

  useEffect(() => {
    bottomSheetRef.current?.snapToIndex?.(0);
  }, [person?.id]);

  useEffect(() => {
    const loadMarriages = async () => {
      if (!person?.id || typeof profilesService?.getPersonMarriages !== 'function') {
        setMarriages([]);
        return;
      }
      try {
        const data = await profilesService.getPersonMarriages(person.id);
        setMarriages(data || []);
      } catch (error) {
        console.warn('Failed to load marriages', error);
        setMarriages([]);
      }
    };
    loadMarriages();
  }, [person?.id]);

  useAnimatedReaction(
    () => animatedPosition.value,
    (current, previous) => {
      if (current === previous) return;
      const progress = Math.max(0, Math.min(1, 1 - current / screenHeight));

      if (profileSheetProgress) {
        profileSheetProgress.value = progress;
      }
    },
    [profileSheetProgress, screenHeight],
  );

  // Fade animation when switching between view and edit modes
  useEffect(() => {
    Animated.parallel([
      Animated.timing(viewOpacity, {
        toValue: mode === 'view' ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(editOpacity, {
        toValue: mode === 'edit' ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [mode, viewOpacity, editOpacity]);

  // Cleanup handled by parent component

  const canEdit = accessMode !== 'readonly';

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

  const handleMenuPress = useCallback(() => {
    const options = [
      canEdit
        ? {
            text: 'تحرير الملف',
            onPress: () => handleEditPress(),
          }
        : null,
      { text: 'إغلاق', style: 'cancel' },
    ].filter(Boolean);

    Alert.alert(person?.name || 'الملف', 'اختر الإجراء', options);
  }, [canEdit, person]);

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

  if (!person) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>لا يوجد ملف محدد.</Text>
      </View>
    );
  }

  const viewModeContent = (
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

        <PersonalCard person={person} />
        <DatesCard person={person} />
        <ProfessionalCard person={person} />
        <ContactCard person={person} />
        <FamilyCard
          father={metrics.father}
          mother={metrics.mother}
          marriages={marriages}
          children={metrics.children}
          person={person}
          onNavigate={onNavigateToProfile}
          showMarriages={isAdminMode}
        />
        <TimelineCard timeline={person?.timeline} />
        <PhotosCard person={person} accessMode={accessMode} />
    </BottomSheetScrollView>
  );

  const editModeContent = (
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
          {activeTab === 'general' ? (
            <TabGeneral form={form} updateField={form.updateField} />
          ) : null}
          {activeTab === 'details' ? (
            <TabDetails form={form} updateField={form.updateField} />
          ) : null}
          {activeTab === 'family' ? (
            <TabFamily
              father={metrics.father}
              mother={metrics.mother}
              children={metrics.children}
              marriages={marriages}
            />
          ) : null}
          {activeTab === 'contact' ? (
            <TabContact form={form} updateField={form.updateField} />
          ) : null}
        </TabsHost>
      </BottomSheetScrollView>
    </View>
  );

  return (
    <>
      <BottomSheet
        ref={bottomSheetRef}
        index={currentSnapIndex}
        snapPoints={snapPoints}
        enablePanDownToClose={mode !== 'edit'}
        backdropComponent={renderBackdrop}
        handleComponent={handleComponent}
        animatedPosition={animatedPosition}
        animateOnMount={false}
        onClose={() => {
          onClose?.();
        }}
        onChange={handleSheetChange}
        backgroundStyle={styles.sheetBackground}
      >
        <View style={{ flex: 1 }}>
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: viewOpacity,
              zIndex: mode === 'view' ? 1 : 0,
            }}
            pointerEvents={mode === 'view' ? 'auto' : 'none'}
          >
            {viewModeContent}
          </Animated.View>

          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: editOpacity,
              zIndex: mode === 'edit' ? 1 : 0,
            }}
            pointerEvents={mode === 'edit' ? 'auto' : 'none'}
          >
            {editModeContent}
          </Animated.View>
        </View>
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
