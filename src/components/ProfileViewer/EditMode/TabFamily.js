import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import tokens from '../../ui/tokens';
import { supabase } from '../../../services/supabase';
import SpouseManager from '../../admin/SpouseManager';
import InlineSpouseAdder from '../../InlineSpouseAdder';
import QuickAddOverlay from '../../admin/QuickAddOverlay';
import EditChildModal from './EditChildModal';
import EditMarriageModal from './EditMarriageModal';
import { ProgressiveThumbnail } from '../../ProgressiveImage';
import useStore from '../../../hooks/useStore';
import { useFeedbackTimeout } from '../../../hooks/useFeedbackTimeout';
import { ErrorBoundary } from '../../ErrorBoundary';

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

// Export for reuse in FatherSelectorSimple and other components
export const getShortNameChain = (profile) => {
  const rawChain =
    profile?.lineage_preview ||
    profile?.name_chain ||
    profile?.full_name_chain ||
    profile?.name_chain_snapshot ||
    profile?.full_name ||
    null;

  let normalized;
  if (rawChain) {
    normalized = rawChain.replace(/\s+/g, ' ').trim();
  }

  if (!normalized) {
    const familyName = profile?.family_origin || profile?.family_name || null;
    if (familyName) {
      return `${profile?.name || ''} ${familyName}`.trim();
    }
    return null;
  }

  const tokens = normalized.split(' ');
  if (tokens.length <= 5) {
    return tokens.join(' ');
  }
  return tokens.slice(0, 5).join(' ');
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
            {hasProfile ? profile.name : emptyTitle}
          </Text>
          {hasProfile ? (
            shortChain ? (
              <Text style={styles.parentChain} numberOfLines={1} ellipsizeMode="tail">
                {shortChain}
              </Text>
            ) : null
          ) : emptySubtitle ? (
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
                    <Text style={styles.motherRowHint} numberOfLines={1}>
                      {option.status === 'married'
                        ? 'زوجة حالية'
                        : option.status === 'divorced'
                        ? 'زوجة سابقة'
                        : option.status === 'widowed'
                        ? 'زوجة أرملة'
                        : 'من خارج العائلة'}
                    </Text>
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

  const [familyData, setFamilyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [spouseModalVisible, setSpouseModalVisible] = useState(false);
  const [childModalVisible, setChildModalVisible] = useState(false);
  const [editChildModalVisible, setEditChildModalVisible] = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);
  const [editMarriageModalVisible, setEditMarriageModalVisible] = useState(false);
  const [selectedMarriage, setSelectedMarriage] = useState(null);
  const [motherOptions, setMotherOptions] = useState([]);
  const [loadingMotherOptions, setLoadingMotherOptions] = useState(false);
  const [updatingMotherId, setUpdatingMotherId] = useState(null);
  const [motherFeedback, setMotherFeedback] = useState(null);
  const [motherPickerVisible, setMotherPickerVisible] = useState(false);
  const [spouseAdderVisible, setSpouseAdderVisible] = useState(false);
  const [spouseFeedback, setSpouseFeedback] = useState(null);
  const [prefilledSpouseName, setPrefilledSpouseName] = useState(null);
  const { refreshProfile } = useStore();

  // Auto-clear feedback messages after 2 seconds
  useFeedbackTimeout(motherFeedback, setMotherFeedback);
  useFeedbackTimeout(spouseFeedback, setSpouseFeedback);

  const prefetchMotherOptions = useCallback(async (fatherId) => {
    if (!fatherId) return;
    setLoadingMotherOptions(true);
    try {
      const { data, error } = await supabase.rpc('get_profile_family_data', {
        p_profile_id: fatherId,
      });

      if (error) throw error;

      const spouses = data?.spouses || [];
      setMotherOptions(spouses);
    } catch (error) {
      if (__DEV__) {
        console.error('Error prefetching mother options:', error);
      }
      setMotherOptions([]);
    } finally {
      setLoadingMotherOptions(false);
    }
  }, []);

  const loadFamilyData = useCallback(async (isRefresh = false) => {
    if (!person?.id) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
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
        setFamilyData(null);
        return;
      }

      if (data?.error) {
        if (__DEV__) {
          console.error('❌ SQL error in RPC result:', data.error);
        }
        Alert.alert('خطأ في قاعدة البيانات', data.error);
        setFamilyData(null);
        return;
      }

      setFamilyData(data);

      if (data?.father?.id) {
        prefetchMotherOptions(data.father.id);
      } else {
        setMotherOptions([]);
        setLoadingMotherOptions(false);
        setMotherPickerVisible(false);
      }
    } catch (err) {
      if (__DEV__) {
        console.error('Error loading family data:', err);
      }
      Alert.alert('خطأ', `حدث خطأ أثناء تحميل البيانات: ${err.message}`);
      setFamilyData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [person?.id, prefetchMotherOptions]);

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
    setSpouseModalVisible(false);
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
    setChildModalVisible(false);
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
          try {
            const { error } = await supabase
              .from('marriages')
              .delete()
              .eq('id', marriage.marriage_id);

            if (error) throw error;

            Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            await loadFamilyData();
            if (refreshProfile) {
              await refreshProfile(person.id);
            }
            if (onDataChanged) {
              onDataChanged();
            }
          } catch (error) {
            if (__DEV__) {
              console.error('Error deleting marriage:', error);
            }
            Alert.alert('خطأ', 'فشل حذف الزواج');
          }
        },
      },
    ]);
  }, [loadFamilyData, refreshProfile, onDataChanged, person.id]);

  const handleSpouseAddedInline = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSpouseFeedback('تمت إضافة الزواج بنجاح');
    await loadFamilyData();
    if (refreshProfile) {
      await refreshProfile(person.id);
    }
    if (onDataChanged) {
      onDataChanged();
    }
    setSpouseAdderVisible(false);
  };

  const handleNeedsAlQefariSearch = (prefilledName) => {
    setSpouseAdderVisible(false);
    setPrefilledSpouseName(prefilledName);
    setSpouseModalVisible(true);
  };

  const handleEditMarriage = useCallback((marriage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMarriage(marriage);
    setEditMarriageModalVisible(true);
  }, []);

  const handleEditMarriageSaved = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadFamilyData();
    if (refreshProfile) {
      await refreshProfile(person.id);
    }
    if (onDataChanged) {
      onDataChanged();
    }
    setEditMarriageModalVisible(false);
    setSelectedMarriage(null);
  }, [loadFamilyData, refreshProfile, onDataChanged, person.id]);

  const handleEditChild = useCallback((child) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChild(child);
    setEditChildModalVisible(true);
  }, []);

  const handleEditChildSaved = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadFamilyData();
    if (refreshProfile) {
      await refreshProfile(person.id);
    }
    if (onDataChanged) {
      onDataChanged();
    }
    setEditChildModalVisible(false);
    setSelectedChild(null);
  }, [loadFamilyData, refreshProfile, onDataChanged, person.id]);

  const handleDeleteChild = useCallback(async (child) => {
    Alert.alert(
      'تأكيد الحذف',
      `هل أنت متأكد من حذف ${child.name} من العائلة؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', child.id);

              if (error) throw error;

              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              await loadFamilyData();
              if (refreshProfile) {
                await refreshProfile(person.id);
              }
              if (onDataChanged) {
                onDataChanged();
              }
            } catch (error) {
              if (__DEV__) {
                console.error('Error deleting child:', error);
              }
              Alert.alert('خطأ', 'فشل حذف الملف الشخصي');
            }
          },
        },
      ]
    );
  }, [loadFamilyData, refreshProfile, onDataChanged, person.id]);

  const handleQuickMotherSelect = async (motherId) => {
    if (!person?.id || !motherId || motherId === person?.mother_id) return;
    setUpdatingMotherId(motherId);
    try {
      const { error } = await supabase.rpc('admin_update_profile', {
        p_id: person.id,
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
      setMotherFeedback('تم تعيين الأم بنجاح');
      setMotherPickerVisible(false);
    } catch (error) {
      if (__DEV__) {
        console.error('Error assigning mother:', error);
      }
      Alert.alert('خطأ', 'فشل تعيين الأم');
    } finally {
      setUpdatingMotherId(null);
    }
  };

  const handleClearMother = async () => {
    if (!person?.id || !person?.mother_id) return;
    setUpdatingMotherId('clear');
    try {
      const { error } = await supabase.rpc('admin_update_profile', {
        p_id: person.id,
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
      setMotherFeedback('تمت إزالة الأم');
      setMotherPickerVisible(false);
    } catch (error) {
      if (__DEV__) {
        console.error('Error clearing mother:', error);
      }
      Alert.alert('خطأ', 'فشل إزالة الأم');
    } finally {
      setUpdatingMotherId(null);
    }
  };

  const motherSuggestions = useMemo(() => {
    if (!motherOptions || motherOptions.length === 0) return [];
    return motherOptions;
  }, [motherOptions]);

  const handleChangeMother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMotherFeedback(null);
    setMotherPickerVisible((prev) => !prev);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.colors.najdi.primary} />
        <Text style={styles.loadingText}>جاري تحميل بيانات العائلة...</Text>
      </View>
    );
  }

  if (!familyData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>فشل تحميل بيانات العائلة</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadFamilyData()}>
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { father, mother, spouses = [], children = [] } = familyData;

  // Memoize spouse filtering to prevent unnecessary iterations on every render
  const { activeSpouses, inactiveSpouses } = useMemo(() => {
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
  }, [spouses]);

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
    setSpouseModalVisible(true);
  };

  const handleGoToFatherProfile = () => {
    if (father?.id && typeof onNavigateToProfile === 'function') {
      setMotherPickerVisible(false);
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
          onPress: () => setSpouseModalVisible(true),
        },
        { text: 'إلغاء', style: 'cancel' },
      ]);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChildModalVisible(true);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
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
            actionLabel={motherPickerVisible ? 'إخفاء الخيارات' : mother ? 'تغيير الأم' : 'إضافة الأم'}
            actionTone={motherPickerVisible ? 'secondary' : 'primary'}
            infoHint={!father ? 'أدخل بيانات الأب أولاً لتتمكن من اختيار الأم' : null}
          >
            <MotherInlinePicker
              visible={motherPickerVisible}
              suggestions={motherSuggestions}
              loading={loadingMotherOptions}
              currentMotherId={person?.mother_id}
              onSelect={handleQuickMotherSelect}
              onClose={() => setMotherPickerVisible(false)}
              onClear={handleClearMother}
              onGoToFather={handleGoToFatherProfile}
              hasFather={Boolean(father)}
            />
            {motherFeedback ? (
              <View style={styles.parentFeedback}>
                <Ionicons name="checkmark-circle" size={14} color={tokens.colors.success} />
                <Text style={styles.parentFeedbackText}>{motherFeedback}</Text>
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
            {!spouseAdderVisible ? (
              <AddActionButton label={addSpouseLabel} onPress={() => setSpouseAdderVisible(true)} />
            ) : null}
            <ErrorBoundary>
              <InlineSpouseAdder
                person={person}
                visible={spouseAdderVisible}
                onAdded={handleSpouseAddedInline}
                onCancel={() => setSpouseAdderVisible(false)}
                onNeedsSearch={handleNeedsAlQefariSearch}
                feedback={spouseFeedback}
              />
            </ErrorBoundary>
          </View>
        }
      >
        {activeSpouses.length > 0 ? (
          <View style={styles.sectionStack}>
            {activeSpouses.map((spouseData) => (
              <SpouseRow
                key={spouseData.marriage_id}
                spouseData={spouseData}
                onEdit={handleEditMarriage}
                onDelete={handleDeleteSpouse}
              />
            ))}
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
              {inactiveSpouses.map((spouseData) => (
                <SpouseRow
                  key={spouseData.marriage_id}
                  spouseData={spouseData}
                  onEdit={handleEditMarriage}
                  onDelete={handleDeleteSpouse}
                  inactive
                />
              ))}
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
            {children.map((child) => (
              <ChildRow
                key={child.id}
                child={child}
                onEdit={handleEditChild}
                onDelete={handleDeleteChild}
              />
            ))}
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
        visible={spouseModalVisible}
        person={person}
        onClose={() => {
          setSpouseModalVisible(false);
          setPrefilledSpouseName(null);
        }}
        onSpouseAdded={handleSpouseAdded}
        prefilledName={prefilledSpouseName}
      />

      <QuickAddOverlay
        visible={childModalVisible}
        parentNode={person}
        siblings={children}
        onClose={handleChildAdded}
      />

      <EditChildModal
        visible={editChildModalVisible}
        child={selectedChild}
        father={familyData?.father}
        spouses={familyData?.spouses || []}
        onClose={() => {
          setEditChildModalVisible(false);
          setSelectedChild(null);
        }}
        onSaved={handleEditChildSaved}
      />

      <EditMarriageModal
        visible={editMarriageModalVisible}
        marriage={selectedMarriage}
        onClose={() => {
          setEditMarriageModalVisible(false);
          setSelectedMarriage(null);
        }}
        onSaved={handleEditMarriageSaved}
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

const SpouseRow = React.memo(({ spouseData, onEdit, onDelete, inactive = false }) => {
  const spouse = spouseData.spouse_profile;
  if (!spouse) return null;

  const initials = getInitials(spouse.name);
  const subtitleParts = [];

  if (spouseData.children_count > 0) {
    subtitleParts.push(
      `${spouseData.children_count} ${spouseData.children_count === 1 ? 'طفل' : 'أطفال'}`,
    );
  }

  if (inactive) {
    subtitleParts.push('زواج سابق');
  }

  const subtitle = subtitleParts.join(' • ');

  return (
    <View style={[styles.memberCard, inactive && styles.memberCardInactive]}>
      <View style={styles.memberHeader}>
        <AvatarThumbnail photoUrl={spouse.photo_url} fallbackLabel={initials} />
        <View style={styles.memberDetails}>
          <Text style={styles.memberName} numberOfLines={1} ellipsizeMode="tail">
            {spouse.name}
          </Text>
          {subtitle ? (
            <Text style={styles.memberSubtitle} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.memberActions}>
        <TouchableOpacity
          style={styles.memberActionButton}
          onPress={() => onEdit(spouseData)}
          activeOpacity={0.7}
        >
          <Text style={styles.memberActionPrimary}>تعديل</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.memberActionButton}
          onPress={() => onDelete(spouseData)}
          activeOpacity={0.7}
        >
          <Text style={styles.memberActionDanger}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});
SpouseRow.displayName = 'SpouseRow';

const ChildRow = React.memo(({ child, onEdit, onDelete }) => {
  if (!child) return null;

  const initials = getInitials(child.name);
  const photoUrl = child.photo_url || child.profile?.photo_url || null;

  const subtitleParts = [];
  if (child.mother_name) {
    subtitleParts.push(`من ${child.mother_name}`);
  }
  if (child.birth_year) {
    subtitleParts.push(`مواليد ${child.birth_year}`);
  }

  const subtitle = subtitleParts.join(' • ');

  return (
    <View style={styles.memberCard}>
      <View style={styles.memberHeader}>
        <AvatarThumbnail photoUrl={photoUrl} fallbackLabel={initials} />
        <View style={styles.memberDetails}>
          <Text style={styles.memberName} numberOfLines={1} ellipsizeMode="tail">
            {child.name}
          </Text>
          {subtitle ? (
            <Text style={styles.memberSubtitle} numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.memberActions}>
        <TouchableOpacity
          style={styles.memberActionButton}
          onPress={() => onEdit(child)}
          activeOpacity={0.7}
        >
          <Text style={styles.memberActionPrimary}>تعديل</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.memberActionButton}
          onPress={() => onDelete(child)}
          activeOpacity={0.7}
        >
          <Text style={styles.memberActionDanger}>حذف</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});
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
    paddingVertical: tokens.spacing.md,
    gap: tokens.spacing.md,
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
    gap: tokens.spacing.xs,
  },
  memberName: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
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
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.divider,
  },
  memberActionButton: {
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  memberActionPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
  },
  memberActionDanger: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.danger,
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
