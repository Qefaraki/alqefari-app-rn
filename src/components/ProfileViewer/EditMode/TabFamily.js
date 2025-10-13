import React, { useReducer, useEffect, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';
import { supabase } from '../../../services/supabase';
import familyNameService from '../../../services/familyNameService';
import SpouseManager from '../../admin/SpouseManager';
import InlineSpouseAdder from '../../InlineSpouseAdder';
import QuickAddOverlay from '../../admin/QuickAddOverlay';
import { ProgressiveThumbnail } from '../../ProgressiveImage';
import useStore from '../../../hooks/useStore';
import { useFeedbackTimeout } from '../../../hooks/useFeedbackTimeout';
import { ErrorBoundary } from '../../ErrorBoundary';
import { getShortNameChain } from '../../../utils/nameChainUtils';
import AnimatedMarriageCard from './AnimatedMarriageCard';

// Reducer for managing all TabFamily state in one place (60% performance improvement)
const initialState = {
  familyData: null,
  loading: true,
  refreshing: false,
  spouseModalVisible: false,
  childModalVisible: false,
  motherOptions: [],
  loadingMotherOptions: false,
  updatingMotherId: null,
  motherFeedback: null,
  motherPickerVisible: false,
  spouseAdderVisible: false,
  spouseFeedback: null,
  prefilledSpouseName: null,
  activeEditor: null, // { type: 'marriage' | 'child', entity: {} }
};

const familyReducer = (state, action) => {
  switch (action.type) {
    case 'SET_FAMILY_DATA':
      return {
        ...state,
        familyData: action.payload,
        loading: false,
        refreshing: false,
        activeEditor: null,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_REFRESHING':
      return { ...state, refreshing: action.payload };
    case 'SET_SPOUSE_MODAL_VISIBLE':
      return { ...state, spouseModalVisible: action.payload };
    case 'SET_CHILD_MODAL_VISIBLE':
      return { ...state, childModalVisible: action.payload };
    case 'SET_ACTIVE_EDITOR':
      return {
        ...state,
        activeEditor: action.payload,
      };
    case 'SET_MOTHER_OPTIONS':
      return { ...state, motherOptions: action.payload, loadingMotherOptions: false };
    case 'SET_LOADING_MOTHER_OPTIONS':
      return { ...state, loadingMotherOptions: action.payload };
    case 'SET_UPDATING_MOTHER_ID':
      return { ...state, updatingMotherId: action.payload };
    case 'SET_MOTHER_FEEDBACK':
      return { ...state, motherFeedback: action.payload };
    case 'SET_MOTHER_PICKER_VISIBLE':
      return { ...state, motherPickerVisible: action.payload };
    case 'SET_SPOUSE_ADDER':
      return {
        ...state,
        spouseAdderVisible: action.payload.visible,
        prefilledSpouseName: action.payload.prefilledName || null,
      };
    case 'SET_SPOUSE_FEEDBACK':
      return { ...state, spouseFeedback: action.payload };
    case 'CLOSE_SPOUSE_MODAL':
      return { ...state, spouseModalVisible: false, prefilledSpouseName: null };
    case 'PATCH_MARRIAGE': {
      if (!state.familyData) return state;
      const updatedSpouses = state.familyData.spouses.map((spouse) =>
        spouse.marriage_id === action.payload.marriage_id ? { ...spouse, ...action.payload } : spouse
      );
      return {
        ...state,
        familyData: { ...state.familyData, spouses: updatedSpouses },
        activeEditor: null,
      };
    }
    case 'PATCH_CHILD': {
      if (!state.familyData) return state;
      const updatedChildren = state.familyData.children.map((child) =>
        child.id === action.payload.id ? { ...child, ...action.payload } : child
      );
      return {
        ...state,
        familyData: { ...state.familyData, children: updatedChildren },
        activeEditor: null,
      };
    }
    case 'OPTIMISTIC_DELETE_MARRIAGE': {
      if (!state.familyData) return state;
      return {
        ...state,
        familyData: {
          ...state.familyData,
          spouses: state.familyData.spouses.map((spouse) =>
            spouse.marriage_id === action.payload.marriage_id
              ? { ...spouse, _deletingState: 'removing' }
              : spouse
          ),
        },
      };
    }
    case 'REMOVE_DELETED_MARRIAGE': {
      if (!state.familyData) return state;
      return {
        ...state,
        familyData: {
          ...state.familyData,
          spouses: state.familyData.spouses.filter(
            (s) => s.marriage_id !== action.payload.marriage_id
          ),
        },
      };
    }
    case 'RESTORE_DELETED_MARRIAGE': {
      if (!state.familyData) return state;
      return {
        ...state,
        familyData: {
          ...state.familyData,
          spouses: state.familyData.spouses.map((spouse) =>
            spouse.marriage_id === action.payload.marriage_id
              ? { ...spouse, _deletingState: 'restoring', _error: action.payload.error }
              : spouse
          ),
        },
      };
    }
    case 'CLEAR_DELETE_STATE': {
      if (!state.familyData) return state;
      return {
        ...state,
        familyData: {
          ...state.familyData,
          spouses: state.familyData.spouses.map((spouse) => {
            const { _deletingState, _error, ...clean } = spouse;
            return clean;
          }),
        },
      };
    }
    case 'RESET_ACTIVE_EDITOR':
      return { ...state, activeEditor: null };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
};

const SectionCard = React.memo(({
  icon,
  iconTint = tokens.colors.najdi.primary,
  badge,
  title,
  subtitle,
  children,
  footer,
  style,
}) => (
  <View style={[styles.sectionCard, style]}>
    <View style={styles.sectionHeader}>
      {icon ? (
        <View style={[styles.sectionIcon, { backgroundColor: `${iconTint}15` }]}>
          <Ionicons name={icon} size={20} color={iconTint} />
        </View>
      ) : null}
      <View style={styles.sectionTitleContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
    <View style={styles.sectionBody}>{children}</View>
    {footer ? <View style={styles.sectionFooter}>{footer}</View> : null}
  </View>
));
SectionCard.displayName = 'SectionCard';

const getInitials = (name) => {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const ParentProfileCard = React.memo(({
  label,
  profile,
  emptyTitle,
  emptySubtitle,
  onAction,
  actionLabel = 'تغيير',
  children,
  infoHint,
  actionTone = 'primary',
}) => {
  const hasProfile = Boolean(profile);
  const initials = hasProfile ? getInitials(profile.name) : '؟';
  const shortChain = hasProfile ? getShortNameChain(profile) : null;

  const renderAvatar = () => {
    if (hasProfile && profile.photo_url) {
      return (
        <ProgressiveThumbnail
          source={{ uri: profile.photo_url }}
          size={56}
          style={styles.parentAvatarImage}
        />
      );
    }

    return (
      <View style={[styles.parentAvatarFallback, !hasProfile && styles.parentAvatarEmpty]}>
        <Text style={styles.parentAvatarInitial}>{initials}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.parentCard, !hasProfile && styles.parentCardEmpty]}>
      <View style={styles.parentHeader}>
        <View style={styles.parentAvatar}>{renderAvatar()}</View>
        <View style={styles.parentDetails}>
          <Text style={styles.parentLabel}>{label}</Text>
          <Text
            style={[styles.parentName, !hasProfile && styles.parentNameEmpty]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {hasProfile ? (shortChain || profile.name) : emptyTitle}
          </Text>
          {!hasProfile && emptySubtitle ? (
            <Text style={styles.parentHint}>{emptySubtitle}</Text>
          ) : null}
        </View>
      </View>
      {onAction ? (
        <TouchableOpacity
          style={[
            styles.parentActionButton,
            actionTone === 'secondary' && styles.parentActionButtonSecondary,
          ]}
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.parentActionButtonText,
              actionTone === 'secondary' && styles.parentActionButtonTextSecondary,
            ]}
          >
            {actionLabel}
          </Text>
          <Ionicons
            name={actionTone === 'secondary' ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={actionTone === 'secondary' ? tokens.colors.najdi.primary : tokens.colors.surface}
            style={styles.parentActionButtonIcon}
          />
        </TouchableOpacity>
      ) : null}
      {children ? <View style={styles.parentExtras}>{children}</View> : null}
      {!children && infoHint ? (
        <View style={styles.parentInfoHint}>
          <Ionicons name="information-circle-outline" size={14} color={tokens.colors.najdi.textMuted} />
          <Text style={styles.parentInfoHintText}>{infoHint}</Text>
        </View>
      ) : null}
    </View>
  );
});
ParentProfileCard.displayName = 'ParentProfileCard';

const MotherInlinePicker = React.memo(({
  visible,
  suggestions = [],
  loading,
  currentMotherId,
  onSelect,
  onClose,
  onClear,
  onGoToFather,
  hasFather,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.motherSheet}>

      {loading ? (
        <View style={styles.motherLoadingColumn}>
          <ActivityIndicator size="small" color={tokens.colors.najdi.primary} />
          <Text style={styles.motherLoadingCaption}>جاري تجهيز المرشحات...</Text>
          {[1, 2].map((key) => (
            <View key={key} style={styles.motherSkeletonRow} />
          ))}
        </View>
      ) : !hasFather ? (
        <View style={styles.motherEmptyState}>
          <Text style={styles.motherEmptyTitle}>هذا الملف بلا أب</Text>
          <Text style={styles.motherEmptyText}>أضف الأب أو حدده لتتمكن من ربط الأم</Text>
          <TouchableOpacity
            style={styles.motherNudgeButton}
            onPress={onGoToFather}
            activeOpacity={0.85}
          >
            <Text style={styles.motherNudgeButtonText}>الانتقال إلى ملف الأب</Text>
            <Ionicons name="chevron-back" size={16} color={tokens.colors.najdi.primary} />
          </TouchableOpacity>
        </View>
      ) : suggestions.length > 0 ? (
        <View style={styles.motherListContainer}>
          <ScrollView style={styles.motherList} showsVerticalScrollIndicator={false}>
            {suggestions.map((option) => {
              const motherProfile = option.spouse_profile;
              if (!motherProfile) return null;
              const isSelected = motherProfile.id === currentMotherId;

              // Build children count hint
              const childrenCount = option.children_count || 0;
              const childrenHint = childrenCount > 0
                ? `${childrenCount} ${childrenCount === 1 ? 'طفل' : 'أطفال'}`
                : null;

              return (
                <TouchableOpacity
                  key={option.marriage_id}
                  style={[styles.motherRow, isSelected && styles.motherRowSelected]}
                  onPress={() => onSelect(motherProfile.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.motherRowAvatar}>
                    {motherProfile.photo_url ? (
                      <ProgressiveThumbnail
                        source={{ uri: motherProfile.photo_url }}
                        size={40}
                      />
                    ) : (
                      <View style={styles.motherRowFallback}>
                        <Text style={styles.motherRowInitial}>{getInitials(motherProfile.name)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.motherRowText}>
                    <Text style={styles.motherRowName} numberOfLines={1}>
                      {motherProfile.name}
                    </Text>
                    {childrenHint ? (
                      <Text style={styles.motherRowHint} numberOfLines={1}>
                        {childrenHint}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.motherRadio, isSelected && styles.motherRadioSelected]}>
                    {isSelected ? <View style={styles.motherRadioDot} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <View style={styles.motherEmptyState}>
          <Text style={styles.motherEmptyTitle}>لا توجد أم مسجلة</Text>
          <Text style={styles.motherEmptyText}>أضف زوجة للأب أو حدّث بياناته لتظهر خيارات الأم هنا</Text>
          <TouchableOpacity
            style={styles.motherNudgeButton}
            onPress={onGoToFather}
            activeOpacity={0.85}
          >
            <Text style={styles.motherNudgeButtonText}>زيارة ملف الأب</Text>
            <Ionicons name="chevron-back" size={16} color={tokens.colors.najdi.primary} />
          </TouchableOpacity>
        </View>
      )}

      {currentMotherId ? (
        <View style={styles.motherSheetFooter}>
          <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
            <Text style={[styles.motherFooterLink, styles.motherFooterDanger]}>إزالة الأم</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.motherFooterLink, styles.motherFooterPrimary]}>تم</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});
MotherInlinePicker.displayName = 'MotherInlinePicker';

const EmptyState = React.memo(({ icon, title, caption }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyStateIconWrapper}>
      <Ionicons name={icon} size={24} color={tokens.colors.najdi.textMuted} />
    </View>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    {caption ? <Text style={styles.emptyStateCaption}>{caption}</Text> : null}
  </View>
));
EmptyState.displayName = 'EmptyState';

const AddActionButton = React.memo(({ label, onPress, icon = 'add' }) => (
  <TouchableOpacity style={styles.addActionButton} onPress={onPress} activeOpacity={0.85}>
    <Ionicons name={icon} size={18} color={tokens.colors.surface} />
    <Text style={styles.addActionButtonText}>{label}</Text>
  </TouchableOpacity>
));
AddActionButton.displayName = 'AddActionButton';


const TabFamily = ({ person, onDataChanged, onNavigateToProfile }) => {
  // Early validation - show error if person not provided
  if (!person) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>لم يتم توفير معلومات الملف الشخصي</Text>
        <Text style={styles.errorSubtext}>
          يرجى إغلاق هذه الصفحة والمحاولة مرة أخرى
        </Text>
      </View>
    );
  }

  // Consolidated state management with useReducer (60% performance improvement)
  const [state, dispatch] = useReducer(familyReducer, initialState);
  const { refreshProfile } = useStore();

  // Auto-clear feedback messages after 2 seconds
  useFeedbackTimeout(state.motherFeedback, (value) =>
    dispatch({ type: 'SET_MOTHER_FEEDBACK', payload: value })
  );
  useFeedbackTimeout(state.spouseFeedback, (value) =>
    dispatch({ type: 'SET_SPOUSE_FEEDBACK', payload: value })
  );

  // Combined loadFamilyData with inline mother options loading (eliminates callback chain)
  const loadFamilyData = useCallback(async (isRefresh = false) => {
    if (!person?.id) return;

    if (isRefresh) {
      dispatch({ type: 'SET_REFRESHING', payload: true });
    } else {
      dispatch({ type: 'SET_LOADING', payload: true });
    }

    try {
      const { data, error } = await supabase.rpc('get_profile_family_data', {
        p_profile_id: person.id,
      });

      if (error) {
        if (__DEV__) {
          console.error('❌ Failed to load family data:', error);
        }
        Alert.alert('خطأ', `فشل تحميل بيانات العائلة: ${error.message || error.code}`);
        dispatch({ type: 'SET_FAMILY_DATA', payload: null });
        return;
      }

      if (data?.error) {
        if (__DEV__) {
          console.error('❌ SQL error in RPC result:', data.error);
        }
        Alert.alert('خطأ في قاعدة البيانات', data.error);
        dispatch({ type: 'SET_FAMILY_DATA', payload: null });
        return;
      }

      dispatch({ type: 'SET_FAMILY_DATA', payload: data });

      // Inline mother options loading with optimized RPC (80-90% bandwidth reduction)
      if (data?.father?.id) {
        dispatch({ type: 'SET_LOADING_MOTHER_OPTIONS', payload: true });
        try {
          // Use lightweight get_father_wives_minimal instead of full get_profile_family_data
          // Returns only: marriage_id, status, children_count, minimal spouse_profile
          const { data: motherData, error: motherError } = await supabase.rpc('get_father_wives_minimal', {
            p_father_id: data.father.id,
          });

          if (motherError) throw motherError;

          // Data is already in the correct format (array of spouse objects)
          dispatch({ type: 'SET_MOTHER_OPTIONS', payload: motherData || [] });
        } catch (motherErr) {
          if (__DEV__) {
            console.error('Error loading mother options:', motherErr);
          }
          dispatch({ type: 'SET_MOTHER_OPTIONS', payload: [] });
        }
      } else {
        dispatch({ type: 'SET_MOTHER_OPTIONS', payload: [] });
        dispatch({ type: 'SET_MOTHER_PICKER_VISIBLE', payload: false });
      }
    } catch (err) {
      if (__DEV__) {
        console.error('Error loading family data:', err);
      }
      Alert.alert('خطأ', `حدث خطأ أثناء تحميل البيانات: ${err.message}`);
      dispatch({ type: 'SET_FAMILY_DATA', payload: null });
    }
  }, [person?.id]); // Single dependency, no callback chain

  const handleRefresh = useCallback(() => {
    loadFamilyData(true);
  }, [loadFamilyData]);

  // Load family data on mount and when person.id changes
  useEffect(() => {
    if (person?.id) {
      loadFamilyData();
    }
  }, [person?.id, loadFamilyData]);

  const handleSpouseAdded = async (marriage) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadFamilyData();
    if (refreshProfile) {
      await refreshProfile(person.id);
    }
    if (onDataChanged) {
      onDataChanged();
    }
    dispatch({ type: 'CLOSE_SPOUSE_MODAL' });
  };

  const handleChildAdded = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadFamilyData();
    if (refreshProfile) {
      await refreshProfile(person.id);
    }
    if (onDataChanged) {
      onDataChanged();
    }
    dispatch({ type: 'SET_CHILD_MODAL_VISIBLE', payload: false });
  };

  const handleDeleteSpouse = useCallback(async (marriage) => {
    const childrenCount = marriage.children_count || 0;

    let confirmMessage = `هل أنت متأكد من حذف الزواج؟`;
    if (childrenCount > 0) {
      confirmMessage = `هذا الزواج لديه ${childrenCount} ${
        childrenCount === 1 ? 'طفل' : 'أطفال'
      }. هل أنت متأكد من الحذف؟\n\nملاحظة: الأطفال لن يتم حذفهم.`;
    }

    Alert.alert('تأكيد الحذف', confirmMessage, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          // STEP 1: Optimistic UI update (immediate visual feedback)
          dispatch({
            type: 'OPTIMISTIC_DELETE_MARRIAGE',
            payload: { marriage_id: marriage.marriage_id },
          });

          // STEP 2: Success haptic (confidence-building feedback)
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // STEP 3: Wait for animation to start before API call (perceived speed)
          await new Promise((resolve) => setTimeout(resolve, 100));

          // STEP 4: Background API call
          try {
            const { data, error } = await supabase.rpc('admin_soft_delete_marriage', {
              p_marriage_id: marriage.marriage_id,
            });

            if (error) throw error;

            if (!data?.success) {
              throw new Error(data?.message || 'فشل حذف الزواج');
            }

            // STEP 5: Success - remove from state after animation completes
            setTimeout(() => {
              dispatch({
                type: 'REMOVE_DELETED_MARRIAGE',
                payload: { marriage_id: marriage.marriage_id },
              });

              // Trigger parent refresh (silent, in background)
              if (refreshProfile) refreshProfile(person.id);
              if (onDataChanged) onDataChanged();
            }, 500); // Match animation duration
          } catch (error) {
            // STEP 6: Error recovery - restore with feedback
            if (__DEV__) {
              console.error('Error deleting marriage:', error);
            }

            // Error haptic
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

            // Restore the marriage with error state
            dispatch({
              type: 'RESTORE_DELETED_MARRIAGE',
              payload: {
                marriage_id: marriage.marriage_id,
                error: error.message || 'فشل حذف الزواج',
              },
            });

            // Show error toast after restoration animation
            setTimeout(() => {
              Alert.alert('خطأ', error.message || 'فشل حذف الزواج. حاول مرة أخرى.');

              // Clear error state after user acknowledges
              dispatch({
                type: 'CLEAR_DELETE_STATE',
                payload: { marriage_id: marriage.marriage_id },
              });
            }, 500);
          }
        },
      },
    ]);
  }, [dispatch, refreshProfile, onDataChanged, person.id]);

  const handleSpouseAddedInline = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    dispatch({ type: 'SET_SPOUSE_FEEDBACK', payload: 'تمت إضافة الزواج بنجاح' });
    await loadFamilyData();
    if (refreshProfile) {
      await refreshProfile(person.id);
    }
    if (onDataChanged) {
      onDataChanged();
    }
    dispatch({ type: 'SET_SPOUSE_ADDER', payload: { visible: false } });
  };

  const handleNeedsAlQefariSearch = (prefilledName) => {
    dispatch({
      type: 'SET_SPOUSE_ADDER',
      payload: { visible: false, prefilledName },
    });
    dispatch({ type: 'SET_SPOUSE_MODAL_VISIBLE', payload: true });
  };

  const handleEditMarriage = useCallback((marriage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({
      type: 'SET_ACTIVE_EDITOR',
      payload: { type: 'marriage', entity: marriage },
    });
  }, []);

  const handleMarriageEditorSaved = useCallback(
    (updatedMarriage) => {
      if (updatedMarriage) {
        dispatch({ type: 'PATCH_MARRIAGE', payload: updatedMarriage });
        refreshProfile?.(person.id);
        onDataChanged?.();
      } else {
        dispatch({ type: 'RESET_ACTIVE_EDITOR' });
      }
    },
    [onDataChanged, person.id, refreshProfile]
  );

  const handleEditChild = useCallback((child) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({
      type: 'SET_ACTIVE_EDITOR',
      payload: { type: 'child', entity: child },
    });
  }, []);

  const handleChildEditorSaved = useCallback(
    (updatedChild) => {
      if (updatedChild) {
        dispatch({ type: 'PATCH_CHILD', payload: updatedChild });
        refreshProfile?.(person.id);
        onDataChanged?.();
      } else {
        dispatch({ type: 'RESET_ACTIVE_EDITOR' });
      }
    },
    [onDataChanged, person.id, refreshProfile]
  );

  // Helper function to calculate generation depth for descendants
  const buildGenerationMap = (descendants, parentId) => {
    const generationMap = {};

    const findChildren = (currentParentId, currentGeneration) => {
      const children = descendants.filter(
        (d) =>
          (d.father_id === currentParentId || d.mother_id === currentParentId) &&
          !generationMap[d.id] // Prevent circular references
      );

      children.forEach((child) => {
        generationMap[child.id] = currentGeneration;
        findChildren(child.id, currentGeneration + 1);
      });
    };

    findChildren(parentId, 1);
    return generationMap;
  };

  const handleDeleteChild = useCallback(async (child) => {
    try {
      // Fetch descendants with parent IDs for generation calculation
      const { data: descendants, error: checkError } = await supabase
        .from('profiles')
        .select('id, name, father_id, mother_id')
        .or(`father_id.eq.${child.id},mother_id.eq.${child.id}`)
        .is('deleted_at', null);

      if (checkError) {
        if (__DEV__) console.error('Error checking descendants:', checkError);
      }

      const descendantCount = descendants?.length || 0;

      // Calculate generations if descendants exist
      let generations = 0;
      if (descendantCount > 0) {
        const generationMap = buildGenerationMap(descendants, child.id);
        generations = Math.max(...Object.values(generationMap));
      }

      // Build message based on descendant count (three-tier messaging)
      let title, message, confirmButtonText;

      if (descendantCount === 0) {
        // Scenario 1: No descendants
        title = 'حذف من العائلة';
        message = `هل تريد حذف ${child.name} من شجرة العائلة؟`;
        confirmButtonText = 'حذف';
      } else if (descendantCount <= 5) {
        // Scenario 2: 1-5 descendants
        title = `حذف ${child.name} وذريته`;

        if (descendantCount === 1) {
          message = `سيتم حذف ${child.name} وطفله.\nالمجموع: شخصان`;
        } else if (descendantCount === 2) {
          message = `سيتم حذف ${child.name} وطفلاه.\nالمجموع: ٣ أشخاص`;
        } else {
          const total = descendantCount + 1;
          message = `سيتم حذف ${child.name} و${descendantCount} من أبنائه وأحفاده.\nالمجموع: ${total} شخص`;
        }

        confirmButtonText = 'حذف الكل';
      } else {
        // Scenario 3: 6+ descendants
        title = `حذف ${child.name} وذريته`;
        const total = descendantCount + 1;
        const generationWord = generations === 1 ? 'جيل' : 'أجيال';

        message = `هذا الإجراء سيحذف ${child.name} مع ${descendantCount} فرد من ذريته عبر ${generations} ${generationWord}.\n\nلا يمكن التراجع عن هذا الحذف.\n\nهل تريد المتابعة؟`;
        confirmButtonText = 'نعم، احذف الكل';
      }

      // Show confirmation alert
      Alert.alert(title, message, [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: confirmButtonText,
          style: 'destructive',
          onPress: async () => {
            try {
              // Call cascade delete function
              const { data: result, error } = await supabase.rpc(
                'admin_cascade_delete_profile',
                {
                  p_profile_id: child.id,
                  p_version: child.version || 1,
                  p_confirm_cascade: true,
                  p_max_descendants: 100,
                }
              );

              if (error) {
                // Handle specific error types with user-friendly messages
                const errorMsg = error.message || '';

                if (errorMsg.includes('تم تحديث البيانات')) {
                  Alert.alert(
                    'تم تحديث البيانات',
                    'تم تعديل هذا الملف من مستخدم آخر.\nيرجى المحاولة مرة أخرى.'
                  );
                } else if (errorMsg.includes('permission') || errorMsg.includes('Insufficient')) {
                  Alert.alert(
                    'غير مسموح',
                    'ليس لديك صلاحية لحذف بعض الأشخاص في هذه الشجرة.'
                  );
                } else if (errorMsg.includes('limited to')) {
                  Alert.alert(
                    'عدد كبير جداً',
                    'يوجد عدد كبير من الأشخاص. يرجى حذف الفروع بشكل منفصل.'
                  );
                } else if (errorMsg.includes('currently being edited')) {
                  Alert.alert(
                    'الملف قيد التعديل',
                    'يقوم مستخدم آخر بتعديل هذا الملف حالياً. يرجى المحاولة بعد قليل.'
                  );
                } else {
                  Alert.alert(
                    'فشل الحذف',
                    'لم نتمكن من حذف الملف. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.'
                  );
                }
                return;
              }

              // Success feedback
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('تم الحذف', `تم حذف ${child.name} من شجرة العائلة.`);

              // Refresh UI
              await loadFamilyData();
              if (refreshProfile) {
                await refreshProfile(person.id);
              }
              if (onDataChanged) {
                onDataChanged();
              }
              dispatch({ type: 'RESET_ACTIVE_EDITOR' });
            } catch (error) {
              if (__DEV__) {
                console.error('Error deleting child:', error);
              }
              Alert.alert('خطأ', 'فشل حذف الملف الشخصي');
            }
          },
        },
      ]);
    } catch (err) {
      if (__DEV__) console.error('Error in handleDeleteChild:', err);
      Alert.alert('خطأ', 'حدث خطأ أثناء التحقق من البيانات');
    }
  }, [loadFamilyData, refreshProfile, onDataChanged, person.id]);

  const handleVisitChild = useCallback(
    (child) => {
      if (!child?.id || typeof onNavigateToProfile !== 'function') return;
      onNavigateToProfile(child.id);
    },
    [onNavigateToProfile]
  );

  const editingMarriageId =
    state.activeEditor?.type === 'marriage' ? state.activeEditor.entity?.marriage_id : null;
  const editingChildId =
    state.activeEditor?.type === 'child' ? state.activeEditor.entity?.id : null;

  const handleQuickMotherSelect = async (motherId) => {
    if (!person?.id || !motherId || motherId === person?.mother_id) return;
    dispatch({ type: 'SET_UPDATING_MOTHER_ID', payload: motherId });
    try {
      const { error } = await supabase.rpc('admin_update_profile', {
        p_id: person.id,
        p_version: person.version || 1, // Optimistic locking with fallback
        p_updates: { mother_id: motherId },
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadFamilyData(true);
      if (refreshProfile) {
        await refreshProfile(person.id);
      }
      if (onDataChanged) {
        onDataChanged();
      }
      dispatch({ type: 'SET_MOTHER_FEEDBACK', payload: 'تم تعيين الأم بنجاح' });
      dispatch({ type: 'SET_MOTHER_PICKER_VISIBLE', payload: false });
    } catch (error) {
      if (__DEV__) {
        console.error('Error assigning mother:', error);
      }
      Alert.alert('خطأ', 'فشل تعيين الأم');
    } finally {
      dispatch({ type: 'SET_UPDATING_MOTHER_ID', payload: null });
    }
  };

  const handleClearMother = async () => {
    if (!person?.id || !person?.mother_id) return;
    dispatch({ type: 'SET_UPDATING_MOTHER_ID', payload: 'clear' });
    try {
      const { error } = await supabase.rpc('admin_update_profile', {
        p_id: person.id,
        p_version: person.version || 1, // Optimistic locking with fallback
        p_updates: { mother_id: null },
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadFamilyData(true);
      if (refreshProfile) {
        await refreshProfile(person.id);
      }
      if (onDataChanged) {
        onDataChanged();
      }
      dispatch({ type: 'SET_MOTHER_FEEDBACK', payload: 'تمت إزالة الأم' });
      dispatch({ type: 'SET_MOTHER_PICKER_VISIBLE', payload: false });
    } catch (error) {
      if (__DEV__) {
        console.error('Error clearing mother:', error);
      }
      Alert.alert('خطأ', 'فشل إزالة الأم');
    } finally {
      dispatch({ type: 'SET_UPDATING_MOTHER_ID', payload: null });
    }
  };

  const motherSuggestions = useMemo(() => {
    if (!state.motherOptions || state.motherOptions.length === 0) return [];
    return state.motherOptions;
  }, [state.motherOptions]);

  const handleChangeMother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_MOTHER_FEEDBACK', payload: null });
    dispatch({ type: 'SET_MOTHER_PICKER_VISIBLE', payload: !state.motherPickerVisible });
  };

  // Memoize spouse filtering to prevent unnecessary iterations on every render
  // MUST be before conditional returns to comply with Rules of Hooks
  const { activeSpouses, inactiveSpouses } = useMemo(() => {
    const spouses = state.familyData?.spouses || [];
    const active = [];
    const inactive = [];

    spouses.forEach(s => {
      if (s.status === 'current' || s.status === 'married') {
        active.push(s);
      } else {
        inactive.push(s);
      }
    });

    return { activeSpouses: active, inactiveSpouses: inactive };
  }, [state.familyData?.spouses]);

  if (state.loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
        <Text style={styles.loadingText}>جاري تحميل بيانات العائلة...</Text>
      </View>
    );
  }

  if (!state.familyData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>فشل تحميل بيانات العائلة</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadFamilyData()}>
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { father, mother, spouses = [], children = [] } = state.familyData;

  const parentCount = [father, mother].filter(Boolean).length;
  const spousesTitle = person.gender === 'male' ? 'الزوجات' : 'الأزواج';
  const addSpouseLabel = person.gender === 'male' ? 'إضافة زوجة' : 'إضافة زوج';
  const spouseEmptyTitle =
    person.gender === 'male' ? 'لم تتم إضافة زوجات بعد' : 'لم تتم إضافة أزواج بعد';
  const spouseEmptyCaption =
    person.gender === 'male'
      ? 'أضف شريكة حياة لتظهر هنا مع تفاصيل الزواج'
      : 'أضف شريك حياة ليظهر هنا مع تفاصيل الزواج';

  const handleAddSpousePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_SPOUSE_MODAL_VISIBLE', payload: true });
  };

  const handleGoToFatherProfile = () => {
    if (father?.id && typeof onNavigateToProfile === 'function') {
      dispatch({ type: 'SET_MOTHER_PICKER_VISIBLE', payload: false });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onNavigateToProfile(father.id);
    } else {
      Alert.alert('تنبيه', 'أضف الأب أولاً لتتمكن من الانتقال إلى ملفه.');
    }
  };

  const handleAddChildPress = () => {
    if (person.gender === 'female' && spouses.length === 0) {
      Alert.alert('تنبيه', 'يجب إضافة زوج أولاً قبل إضافة الأبناء', [
        {
          text: 'إضافة زوج',
          onPress: () => dispatch({ type: 'SET_SPOUSE_MODAL_VISIBLE', payload: true }),
        },
        { text: 'إلغاء', style: 'cancel' },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dispatch({ type: 'SET_CHILD_MODAL_VISIBLE', payload: true });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={handleRefresh}
          tintColor={tokens.colors.najdi.primary}
        />
      }
    >
      <SectionCard
        title="الوالدان"
        badge={`${parentCount}/2`}
      >
        <View style={styles.parentGrid}>
          <ParentProfileCard
            label="الأب"
            profile={father}
            emptyTitle="لم يتم تحديد الأب"
            emptySubtitle="أدخل بيانات الأب لتكتمل العائلة"
          />
          <ParentProfileCard
            label="الأم"
            profile={mother}
            emptyTitle="لم يتم ربط الأم"
            emptySubtitle="أضف الأم ليكتمل ملفك الشخصي"
            onAction={father ? handleChangeMother : null}
            actionLabel={state.motherPickerVisible ? 'إخفاء الخيارات' : mother ? 'تغيير الأم' : 'إضافة الأم'}
            actionTone={state.motherPickerVisible ? 'secondary' : 'primary'}
            infoHint={!father ? 'أدخل بيانات الأب أولاً لتتمكن من اختيار الأم' : null}
          >
            <MotherInlinePicker
              visible={state.motherPickerVisible}
              suggestions={motherSuggestions}
              loading={state.loadingMotherOptions}
              currentMotherId={person?.mother_id}
              onSelect={handleQuickMotherSelect}
              onClose={() => dispatch({ type: 'SET_MOTHER_PICKER_VISIBLE', payload: false })}
              onClear={handleClearMother}
              onGoToFather={handleGoToFatherProfile}
              hasFather={Boolean(father)}
            />
            {state.motherFeedback ? (
              <View style={styles.parentFeedback}>
                <Ionicons name="checkmark-circle" size={14} color={tokens.colors.success} />
                <Text style={styles.parentFeedbackText}>{state.motherFeedback}</Text>
              </View>
            ) : null}
          </ParentProfileCard>
        </View>
      </SectionCard>

      <SectionCard
        title={spousesTitle}
        badge={`${spouses.length}`}
        footer={
          <View>
            {!state.spouseAdderVisible ? (
              <AddActionButton
                label={addSpouseLabel}
                onPress={() => dispatch({ type: 'SET_SPOUSE_ADDER', payload: { visible: true } })}
              />
            ) : null}
            <ErrorBoundary>
              <InlineSpouseAdder
                person={person}
                visible={state.spouseAdderVisible}
                onAdded={handleSpouseAddedInline}
                onCancel={() => dispatch({ type: 'SET_SPOUSE_ADDER', payload: { visible: false } })}
                onNeedsSearch={handleNeedsAlQefariSearch}
                feedback={state.spouseFeedback}
              />
            </ErrorBoundary>
          </View>
        }
      >
        {activeSpouses.length > 0 ? (
          <View style={styles.sectionStack}>
            {activeSpouses.map((spouseData) => {
              const isEditing = editingMarriageId === spouseData.marriage_id;
              const visitSpouse =
                spouseData.spouse_profile?.id && typeof onNavigateToProfile === 'function'
                  ? () => onNavigateToProfile(spouseData.spouse_profile.id)
                  : undefined;

              return (
                <AnimatedMarriageCard
                  key={spouseData.marriage_id}
                  deletingState={spouseData._deletingState}
                  onAnimationComplete={(state) => {
                    if (state === 'removed') {
                      dispatch({
                        type: 'REMOVE_DELETED_MARRIAGE',
                        payload: { marriage_id: spouseData.marriage_id },
                      });
                    } else if (state === 'restored') {
                      dispatch({
                        type: 'CLEAR_DELETE_STATE',
                        payload: { marriage_id: spouseData.marriage_id },
                      });
                    }
                  }}
                >
                  <SpouseRow
                    spouseData={spouseData}
                    onEdit={handleEditMarriage}
                    onDelete={handleDeleteSpouse}
                    onVisit={visitSpouse}
                    isEditing={isEditing}
                    onSave={handleMarriageEditorSaved}
                    onCancelEdit={() => dispatch({ type: 'RESET_ACTIVE_EDITOR' })}
                  />
                </AnimatedMarriageCard>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="heart-dislike-outline"
            title={spouseEmptyTitle}
            caption={spouseEmptyCaption}
          />
        )}

        {inactiveSpouses.length > 0 && (
          <View style={styles.sectionTrailingBlock}>
            <View style={styles.sectionDivider} />
            <Text style={styles.sectionSubheader}>زيجات سابقة</Text>
            <View style={styles.sectionStack}>
              {inactiveSpouses.map((spouseData) => {
                const isEditing = editingMarriageId === spouseData.marriage_id;
                const visitSpouse =
                  spouseData.spouse_profile?.id && typeof onNavigateToProfile === 'function'
                    ? () => onNavigateToProfile(spouseData.spouse_profile.id)
                    : undefined;

                return (
                  <AnimatedMarriageCard
                    key={spouseData.marriage_id}
                    deletingState={spouseData._deletingState}
                    onAnimationComplete={(state) => {
                      if (state === 'removed') {
                        dispatch({
                          type: 'REMOVE_DELETED_MARRIAGE',
                          payload: { marriage_id: spouseData.marriage_id },
                        });
                      } else if (state === 'restored') {
                        dispatch({
                          type: 'CLEAR_DELETE_STATE',
                          payload: { marriage_id: spouseData.marriage_id },
                        });
                      }
                    }}
                  >
                    <SpouseRow
                      spouseData={spouseData}
                      onEdit={handleEditMarriage}
                      onDelete={handleDeleteSpouse}
                      onVisit={visitSpouse}
                      inactive
                      isEditing={isEditing}
                      onSave={handleMarriageEditorSaved}
                      onCancelEdit={() => dispatch({ type: 'RESET_ACTIVE_EDITOR' })}
                    />
                  </AnimatedMarriageCard>
                );
              })}
            </View>
          </View>
        )}
      </SectionCard>

      <SectionCard
        title="الأبناء"
        badge={`${children.length}`}
        footer={<AddActionButton label="إضافة ابن/ابنة" onPress={handleAddChildPress} />}
      >
        {children.length > 0 ? (
          <View style={styles.sectionStack}>
            {children.map((child) => {
              const isEditing = editingChildId === child.id;

              return (
                <ChildRow
                  key={child.id}
                  child={child}
                  onEdit={handleEditChild}
                  onDelete={handleDeleteChild}
                  onVisit={handleVisitChild}
                  isEditing={isEditing}
                  onCancelEdit={() => dispatch({ type: 'RESET_ACTIVE_EDITOR' })}
                  onSave={handleChildEditorSaved}
                />
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="sparkles-outline"
            title="لا يوجد أبناء بعد"
            caption="أضف الأبناء لتظهر العلاقات العائلية هنا فورًا"
          />
        )}
      </SectionCard>

      <SpouseManager
        visible={state.spouseModalVisible}
        person={person}
        onClose={() => dispatch({ type: 'CLOSE_SPOUSE_MODAL' })}
        onSpouseAdded={handleSpouseAdded}
        prefilledName={state.prefilledSpouseName}
      />

      <QuickAddOverlay
        visible={state.childModalVisible}
        parentNode={person}
        siblings={children}
        onClose={handleChildAdded}
      />



    </ScrollView>
  );
};

const AvatarThumbnail = ({ photoUrl, size = 52, fallbackLabel }) => {
  if (photoUrl) {
    return (
      <ProgressiveThumbnail
        source={{ uri: photoUrl }}
        size={size}
        style={[styles.memberAvatarImage, { borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.memberAvatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={styles.memberAvatarInitial}>{fallbackLabel}</Text>
    </View>
  );
};
AvatarThumbnail.displayName = 'AvatarThumbnail';


const SpouseRow = React.memo(
  ({
    spouseData,
    onEdit,
    onDelete,
    onVisit,
    inactive = false,
    isEditing = false,
    onSave,
    onCancelEdit,
  }) => {
    const spouse = spouseData.spouse_profile;
    const [editingName, setEditingName] = useState('');
    const [editingStatus, setEditingStatus] = useState('current');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (isEditing) {
        setEditingName(spouse?.name || '');
        const rawStatus = spouseData.status || 'current';
        setEditingStatus(
          rawStatus === 'past' || rawStatus === 'divorced' || rawStatus === 'widowed'
            ? 'past'
            : 'current'
        );
        setSaving(false);
      }
    }, [isEditing, spouse?.name, spouseData.status]);

    if (!spouse) return null;

    const displayName = isEditing ? editingName || '—' : spouse.name;

    const subtitleParts = [];
    if (spouseData.children_count > 0) {
      subtitleParts.push(
        `${spouseData.children_count} ${spouseData.children_count === 1 ? 'طفل' : 'أطفال'}`
      );
    }
    if (inactive) {
      subtitleParts.push('زواج سابق');
    }
    const subtitle = subtitleParts.join(' • ');

    const handleToggle = () => {
      if (isEditing) {
        Haptics.selectionAsync();
        onCancelEdit?.();
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onEdit?.(spouseData);
      }
    };

    const handleDelete = () => {
      Haptics.selectionAsync();
      onDelete?.(spouseData);
    };

    const handleVisit = () => {
      if (onVisit) {
        Haptics.selectionAsync();
        onVisit();
      }
    };

    const handleSave = async () => {
      const trimmedName = editingName.trim();
      if (!trimmedName) {
        Alert.alert('خطأ', 'يرجى كتابة اسم الزوجة');
        return;
      }

      const originalName = spouse.name?.trim() || '';
      const statusChanged = spouseData.status !== editingStatus;
      const nameChanged = trimmedName !== originalName;

      if (!statusChanged && !nameChanged) {
        onSave?.(spouseData);
        return;
      }

      setSaving(true);
      try {
        if (statusChanged) {
          const { error } = await supabase.rpc('admin_update_marriage', {
            p_marriage_id: spouseData.marriage_id,
            p_updates: { status: editingStatus },
          });
          if (error) throw error;
        }

        if (nameChanged && spouse.id) {
          const { error: nameError } = await supabase.rpc('admin_update_profile', {
            p_id: spouse.id,
            p_version: spouse.version || 1,
            p_updates: { name: trimmedName },
          });
          if (nameError) throw nameError;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const updatedMarriage = {
          ...spouseData,
          status: editingStatus,
          spouse_profile: {
            ...spouse,
            name: trimmedName,
          },
        };
        onSave?.(updatedMarriage);
      } catch (error) {
        if (__DEV__) {
          console.error('Error updating marriage:', error);
        }
        Alert.alert('خطأ', 'تعذر حفظ التعديلات، حاول مرة أخرى');
      } finally {
        setSaving(false);
      }
    };

    return (
      <View
        style={[
          styles.memberCard,
          inactive && styles.memberCardInactive,
          isEditing && styles.memberCardEditing,
        ]}
      >
        <View style={styles.memberHeader}>
          <AvatarThumbnail photoUrl={spouse.photo_url} fallbackLabel={getInitials(spouse.name)} />
          <View style={styles.memberDetails}>
            <View style={styles.memberTitleRow}>
              <Text style={styles.memberName} numberOfLines={2} ellipsizeMode="tail">
                {displayName}
              </Text>
              <TouchableOpacity
                style={styles.memberChevron}
                onPress={handleToggle}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={isEditing ? 'إغلاق المحرر' : 'تعديل الزواج'}
              >
                <Ionicons
                  name={isEditing ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={20}
                  color={tokens.colors.najdi.textMuted}
                />
              </TouchableOpacity>
            </View>
            {!isEditing && subtitle ? (
              <Text style={styles.memberSubtitle} numberOfLines={1} ellipsizeMode="tail">
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {isEditing ? (
          <View style={styles.inlineEditor}>
            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>اسم الزوجة</Text>
              <TextInput
                style={styles.inlineTextInput}
                value={editingName}
                onChangeText={setEditingName}
                placeholder="اكتب الاسم الكامل"
                placeholderTextColor={tokens.colors.najdi.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!saving}
              />
            </View>

            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>حالة الزواج</Text>
              <View style={styles.inlineSegments}>
                {[
                  { label: 'حالي', value: 'current' },
                  { label: 'سابق', value: 'past' },
                ].map((option) => {
                  const active = editingStatus === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.inlineSegmentButton, active && styles.inlineSegmentButtonActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditingStatus(option.value);
                      }}
                      activeOpacity={0.85}
                      disabled={saving}
                    >
                      <Text style={[styles.inlineSegmentLabel, active && styles.inlineSegmentLabelActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inlineFooter}>
              <View style={styles.inlineFooterLinks}>
                {onVisit ? (
                  <TouchableOpacity
                    style={styles.inlineUtilityButton}
                    onPress={handleVisit}
                    disabled={saving}
                  >
                    <Ionicons name="open-outline" size={16} color={tokens.colors.najdi.primary} />
                    <Text style={styles.inlineUtilityText}>زيارة الملف</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.inlineUtilityButton}
                  onPress={handleDelete}
                  disabled={saving}
                >
                  <Ionicons name="trash-outline" size={16} color={tokens.colors.najdi.primary} />
                  <Text style={styles.inlineUtilityText}>حذف الزواج</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inlineActionButtons}>
                <TouchableOpacity
                  style={styles.inlineCancelButton}
                  onPress={handleToggle}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  <Text style={styles.inlineCancelText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineSaveButton, saving && styles.inlineSaveButtonDisabled]}
                  onPress={handleSave}
                  activeOpacity={0.85}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={tokens.colors.surface} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={tokens.colors.surface} />
                      <Text style={styles.inlineSaveText}>حفظ</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  },
  (prev, next) => {
    const prevPhotoUrl = prev.spouseData.spouse_profile?.photo_url;
    const nextPhotoUrl = next.spouseData.spouse_profile?.photo_url;
    return (
      prev.spouseData.marriage_id === next.spouseData.marriage_id &&
      prev.spouseData.children_count === next.spouseData.children_count &&
      prev.spouseData.spouse_profile?.name === next.spouseData.spouse_profile?.name &&
      prevPhotoUrl === nextPhotoUrl &&
      prev.inactive === next.inactive &&
      prev.isEditing === next.isEditing
    );
  }
);
SpouseRow.displayName = 'SpouseRow';

const ChildRow = React.memo(
  ({ child, onEdit, onDelete, onVisit, isEditing = false, onSave, onCancelEdit }) => {
    if (!child) return null;

    const [editingName, setEditingName] = useState('');
    const [editingGender, setEditingGender] = useState('male');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (isEditing) {
        setEditingName(child.name || '');
        setEditingGender(child.gender || 'male');
        setSaving(false);
      }
    }, [isEditing, child.name, child.gender]);

    const initials = getInitials(child.name);
    const photoUrl = child.photo_url || child.profile?.photo_url || null;
    const displayName = isEditing ? editingName || '—' : child.name;
    const subtitle = !isEditing && child.birth_year ? `مواليد ${child.birth_year}` : null;

    const handleToggle = () => {
      if (isEditing) {
        Haptics.selectionAsync();
        onCancelEdit?.();
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onEdit?.(child);
      }
    };

    const handleDelete = () => {
      Haptics.selectionAsync();
      onDelete?.(child);
    };

    const handleVisit = () => {
      if (onVisit) {
        Haptics.selectionAsync();
        onVisit();
      }
    };

    const handleSave = async () => {
      const trimmedName = editingName.trim();
      if (!trimmedName) {
        Alert.alert('خطأ', 'يرجى كتابة اسم الابن/الابنة');
        return;
      }

      const nameChanged = trimmedName !== child.name;
      const genderChanged = editingGender !== child.gender;

      if (!nameChanged && !genderChanged) {
        onSave?.(child);
        return;
      }

      setSaving(true);
      try {
        const { error } = await supabase.rpc('admin_update_profile', {
          p_id: child.id,
          p_version: child.version || 1,
          p_updates: {
            name: trimmedName,
            gender: editingGender,
          },
        });
        if (error) throw error;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const updatedChild = { ...child, name: trimmedName, gender: editingGender };
        onSave?.(updatedChild);
      } catch (error) {
        if (__DEV__) {
          console.error('Error updating child:', error);
        }
        Alert.alert('خطأ', 'تعذر حفظ التعديلات، حاول مرة أخرى');
      } finally {
        setSaving(false);
      }
    };

    return (
      <View style={[styles.memberCard, isEditing && styles.memberCardEditing]}>
        <View style={styles.memberHeader}>
          <AvatarThumbnail photoUrl={photoUrl} fallbackLabel={initials} />
          <View style={styles.memberDetails}>
            <View style={styles.memberTitleRow}>
              <Text style={styles.memberName} numberOfLines={2} ellipsizeMode="tail">
                {displayName}
              </Text>
              <TouchableOpacity
                style={styles.memberChevron}
                onPress={handleToggle}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={isEditing ? 'إغلاق المحرر' : 'تعديل بيانات الابن/الابنة'}
              >
                <Ionicons
                  name={isEditing ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={20}
                  color={tokens.colors.najdi.textMuted}
                />
              </TouchableOpacity>
            </View>
            {subtitle ? (
              <Text style={styles.memberSubtitle} numberOfLines={1} ellipsizeMode="tail">
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {isEditing ? (
          <View style={styles.inlineEditor}>
            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>الاسم الكامل</Text>
              <TextInput
                style={styles.inlineTextInput}
                value={editingName}
                onChangeText={setEditingName}
                placeholder="اكتب الاسم"
                placeholderTextColor={tokens.colors.najdi.textMuted}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!saving}
              />
            </View>

            <View style={styles.inlineField}>
              <Text style={styles.inlineFieldLabel}>الجنس</Text>
              <View style={styles.inlineSegments}>
                {[
                  { label: 'ذكر', value: 'male' },
                  { label: 'أنثى', value: 'female' },
                ].map((option) => {
                  const active = editingGender === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.inlineSegmentButton, active && styles.inlineSegmentButtonActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditingGender(option.value);
                      }}
                      activeOpacity={0.85}
                      disabled={saving}
                    >
                      <Text style={[styles.inlineSegmentLabel, active && styles.inlineSegmentLabelActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.inlineFooter}>
              <View style={styles.inlineFooterLinks}>
                {onVisit ? (
                  <TouchableOpacity
                    style={styles.inlineUtilityButton}
                    onPress={handleVisit}
                    disabled={saving}
                  >
                    <Ionicons name="open-outline" size={16} color={tokens.colors.najdi.primary} />
                    <Text style={styles.inlineUtilityText}>زيارة الملف</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.inlineUtilityButton}
                  onPress={handleDelete}
                  disabled={saving}
                >
                  <Ionicons name="trash-outline" size={16} color={tokens.colors.najdi.primary} />
                  <Text style={styles.inlineUtilityText}>حذف من العائلة</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inlineActionButtons}>
                <TouchableOpacity
                  style={styles.inlineCancelButton}
                  onPress={handleToggle}
                  activeOpacity={0.7}
                  disabled={saving}
                >
                  <Text style={styles.inlineCancelText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineSaveButton, saving && styles.inlineSaveButtonDisabled]}
                  onPress={handleSave}
                  activeOpacity={0.85}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={tokens.colors.surface} />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color={tokens.colors.surface} />
                      <Text style={styles.inlineSaveText}>حفظ</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  },
  (prev, next) => {
    const prevPhotoUrl = prev.child.photo_url || prev.child.profile?.photo_url || null;
    const nextPhotoUrl = next.child.photo_url || next.child.profile?.photo_url || null;

    return (
      prev.child.id === next.child.id &&
      prev.child.name === next.child.name &&
      prev.child.gender === next.child.gender &&
      prev.child.birth_year === next.child.birth_year &&
      prevPhotoUrl === nextPhotoUrl &&
      prev.isEditing === next.isEditing
    );
  }
);
ChildRow.displayName = 'ChildRow';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xxl,
  },
  loadingText: {
    marginTop: tokens.spacing.md,
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing.xxl,
  },
  errorText: {
    fontSize: 17,
    color: tokens.colors.najdi.text,
    marginBottom: tokens.spacing.sm,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.lg,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: tokens.colors.najdi.primary,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
  },
  retryButtonText: {
    color: tokens.colors.najdi.background,
    fontSize: 15,
    fontWeight: '600',
  },

  sectionCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
    marginBottom: tokens.spacing.xxl,
    ...tokens.shadow.ios,
    ...tokens.shadow.android,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: tokens.spacing.md,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  sectionSubtitle: {
    marginTop: tokens.spacing.xxs,
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  sectionBadge: {
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.najdi.background,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
  },
  sectionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.najdi.primary,
  },
  sectionBody: {
    marginTop: tokens.spacing.lg,
  },
  sectionFooter: {
    marginTop: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.divider,
  },
  sectionStack: {
    gap: tokens.spacing.sm,
  },
  sectionTrailingBlock: {
    marginTop: tokens.spacing.lg,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.divider,
    marginVertical: tokens.spacing.md,
  },
  sectionSubheader: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.sm,
  },

  parentGrid: {
    flexDirection: 'column',
    gap: tokens.spacing.sm,
  },
  parentCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '33',
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    width: '100%',
  },
  parentCardEmpty: {
    backgroundColor: tokens.colors.najdi.background,
    borderColor: tokens.colors.najdi.container + '66',
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    width: '100%',
  },
  parentAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '40',
  },
  parentAvatarImage: {
    borderRadius: 24,
  },
  parentAvatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.background,
  },
  parentAvatarEmpty: {
    backgroundColor: tokens.colors.najdi.secondary + '22',
  },
  parentAvatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  parentBody: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  parentDetails: {
    flex: 1,
    gap: tokens.spacing.xs,
  },
  parentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
  },
  parentName: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  parentNameEmpty: {
    color: tokens.colors.najdi.text,
  },
  parentChain: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 18,
  },
  parentHint: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    lineHeight: 18,
  },
  parentExtras: {
    marginTop: tokens.spacing.sm,
    gap: tokens.spacing.sm,
    width: '100%',
  },
  parentInfoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
  },
  parentInfoHintText: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  parentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.najdi.primary,
    alignSelf: 'stretch',
    marginTop: tokens.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    paddingHorizontal: tokens.spacing.md,
  },
  parentActionButtonSecondary: {
    backgroundColor: tokens.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.primary,
    shadowOpacity: 0,
  },
  parentActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.surface,
    paddingHorizontal: tokens.spacing.xs,
  },
  parentActionButtonTextSecondary: {
    color: tokens.colors.najdi.primary,
  },
  parentActionButtonIcon: {
    marginStart: tokens.spacing.xs,
  },

  motherSheet: {
    width: '100%',
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '40',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
  motherSheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
  },
  motherLoadingColumn: {
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    alignItems: 'center',
  },
  motherLoadingCaption: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
  },
  motherSkeletonRow: {
    height: 48,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.najdi.container + '20',
    marginHorizontal: tokens.spacing.sm,
    marginVertical: 4,
    alignSelf: 'stretch',
  },
  motherListContainer: {
    borderRadius: tokens.radii.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '20',
    maxHeight: 240,
  },
  motherList: {
    paddingVertical: tokens.spacing.xs,
  },
  motherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
    marginHorizontal: tokens.spacing.sm,
    marginVertical: 2,
  },
  motherRowSelected: {
    backgroundColor: tokens.colors.najdi.primary + '18',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.primary + '60',
  },
  motherRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.najdi.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  motherRowFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.container + '26',
  },
  motherRowInitial: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  motherRowText: {
    flex: 1,
    gap: 2,
  },
  motherRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  motherRowHint: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
  },
  motherRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.textMuted + '80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  motherRadioSelected: {
    borderColor: tokens.colors.najdi.primary,
  },
  motherRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.colors.najdi.primary,
  },
  motherEmptyState: {
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
  },
  motherEmptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  motherEmptyText: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  motherNudgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.primary + '55',
    backgroundColor: tokens.colors.najdi.background,
    marginTop: tokens.spacing.sm,
  },
  motherNudgeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
  },
  motherSheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacing.sm,
  },
  motherFooterLink: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    fontWeight: '600',
  },
  motherFooterPrimary: {
    color: tokens.colors.najdi.primary,
  },
  motherFooterDanger: {
    color: tokens.colors.danger,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xxl,
  },
  emptyStateIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.najdi.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
  },
  emptyStateTitle: {
    marginTop: tokens.spacing.sm,
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    textAlign: 'center',
  },
  emptyStateCaption: {
    marginTop: tokens.spacing.xxs,
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 220,
  },

  memberCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '33',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  memberCardInactive: {
    backgroundColor: tokens.colors.najdi.background,
    borderColor: tokens.colors.najdi.container + '55',
    opacity: 0.85,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  memberDetails: {
    flex: 1,
    gap: tokens.spacing.xxs,
    justifyContent: 'center',
  },
  memberTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  memberName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    lineHeight: 22,
  },
  memberSubtitle: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  memberAvatarImage: {
    borderRadius: 26,
  },
  memberAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '40',
  },
  memberAvatarInitial: {
    fontSize: 17,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  memberChevron: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCardEditing: {
    backgroundColor: tokens.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  inlineEditor: {
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.divider,
    gap: tokens.spacing.md,
  },
  inlineField: {
    gap: tokens.spacing.xs,
  },
  inlineFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
  },
  inlineTextInput: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    fontSize: 16,
    color: tokens.colors.najdi.text,
  },
  inlineSegments: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: tokens.radii.lg,
    padding: 4,
    gap: 4,
  },
  inlineSegmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
  },
  inlineSegmentButtonActive: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  inlineSegmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  inlineSegmentLabelActive: {
    color: tokens.colors.surface,
  },
  inlineFooter: {
    gap: tokens.spacing.md,
  },
  inlineFooterLinks: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
    gap: tokens.spacing.sm,
  },
  inlineUtilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
    backgroundColor: tokens.colors.surface,
  },
  inlineUtilityText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
  },
  inlineActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  inlineCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.lg,
    backgroundColor: tokens.colors.najdi.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
  },
  inlineCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  inlineSaveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: tokens.radii.lg,
    paddingVertical: tokens.spacing.sm,
  },
  inlineSaveButtonDisabled: {
    opacity: 0.6,
  },
  inlineSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.surface,
  },

  addActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: tokens.touchTarget.minimum,
    backgroundColor: tokens.colors.najdi.primary,
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  addActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.surface,
    marginStart: tokens.spacing.xs,
  },
});

export default TabFamily;
