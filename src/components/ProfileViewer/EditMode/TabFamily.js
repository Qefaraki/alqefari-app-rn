import React, { useState, useEffect, useMemo } from 'react';
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
import SelectMotherModal from './SelectMotherModal';
import { ProgressiveThumbnail } from '../../ProgressiveImage';
import useStore from '../../../hooks/useStore';

const SectionCard = ({
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
);

const getInitials = (name) => {
  if (!name) return '؟';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const getShortNameChain = (profile) => {
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

const ParentProfileCard = ({
  label,
  profile,
  emptyTitle,
  emptySubtitle,
  onAction,
  actionLabel = 'تغيير',
  children,
  infoHint,
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
          style={[styles.parentActionButton, !hasProfile && styles.parentActionButtonPrimary]}
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.85}
        >
          <Ionicons
            name={hasProfile ? 'swap-horizontal-outline' : 'add-circle-outline'}
            size={16}
            color={hasProfile ? tokens.colors.najdi.primary : tokens.colors.surface}
          />
          <Text
            style={[styles.parentActionButtonText, !hasProfile && styles.parentActionButtonTextPrimary]}
          >
            {actionLabel}
          </Text>
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
};

const MotherQuickActions = ({
  suggestions = [],
  loading,
  selectedMotherId,
  updatingMotherId,
  feedback,
  onSelect,
  onOpenAll,
  onClear,
  hasFather,
}) => {
  const clearing = updatingMotherId === 'clear';
  const showSuggestions = hasFather && suggestions.length > 0;

  if (!hasFather && !loading) {
    return null;
  }

  if (!showSuggestions && !loading && !selectedMotherId) {
    return null;
  }

  return (
    <View style={styles.motherActions}>
      <View style={styles.motherActionsHeader}>
        <Text style={styles.motherActionsTitle}>اقتراحات جاهزة</Text>
        <TouchableOpacity
          onPress={onOpenAll}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Text style={styles.motherActionsLink}>عرض جميع الأمهات</Text>
        </TouchableOpacity>
      </View>

      {feedback ? (
        <View style={styles.motherFeedback}>
          <Ionicons name="checkmark-circle" size={16} color={tokens.colors.success} />
          <Text style={styles.motherFeedbackText}>{feedback}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.motherLoadingRow}>
          <ActivityIndicator size="small" color={tokens.colors.najdi.primary} />
          <Text style={styles.motherLoadingText}>جاري تجهيز المرشحات...</Text>
        </View>
      ) : showSuggestions ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.motherChipsRow}
        >
          {suggestions.map((option) => {
            const motherProfile = option.spouse_profile;
            if (!motherProfile) return null;
            const isSelected = motherProfile.id === selectedMotherId;
            const isUpdating = updatingMotherId === motherProfile.id;

            return (
              <TouchableOpacity
                key={option.marriage_id}
                style={[
                  styles.motherChip,
                  isSelected && styles.motherChipSelected,
                  isUpdating && styles.motherChipUpdating,
                ]}
                onPress={() => onSelect(motherProfile.id)}
                disabled={isUpdating}
                activeOpacity={0.85}
              >
                <View style={styles.motherChipAvatar}>
                  {motherProfile.photo_url ? (
                    <ProgressiveThumbnail
                      source={{ uri: motherProfile.photo_url }}
                      size={32}
                    />
                  ) : (
                    <View style={styles.motherChipFallback}>
                      <Text style={styles.motherChipInitial}>{getInitials(motherProfile.name)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.motherChipTextBlock}>
                  <Text style={styles.motherChipName} numberOfLines={1}>
                    {motherProfile.name}
                  </Text>
                  {option.status && option.status !== 'married' ? (
                    <Text style={styles.motherChipHint} numberOfLines={1}>
                      {option.status === 'divorced' ? 'مرتبطة سابقاً' : 'أرملة'}
                    </Text>
                  ) : null}
                </View>
                {isUpdating ? (
                  <ActivityIndicator size="small" color={tokens.colors.najdi.primary} />
                ) : isSelected ? (
                  <Ionicons name="checkmark-circle" size={18} color={tokens.colors.najdi.primary} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {selectedMotherId ? (
        <TouchableOpacity
          style={styles.motherClearButton}
          onPress={onClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={clearing}
          activeOpacity={0.7}
        >
          {clearing ? (
            <ActivityIndicator size="small" color={tokens.colors.najdi.textMuted} />
          ) : (
            <Ionicons name="close-circle" size={16} color={tokens.colors.najdi.textMuted} />
          )}
          <Text style={styles.motherClearText}>إزالة الأم</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const EmptyState = ({ icon, title, caption }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyStateIconWrapper}>
      <Ionicons name={icon} size={24} color={tokens.colors.najdi.textMuted} />
    </View>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    {caption ? <Text style={styles.emptyStateCaption}>{caption}</Text> : null}
  </View>
);

const MetaPill = ({ label, icon, tone = 'neutral' }) => {
  const toneStyles = {
    positive: {
      container: styles.metaPillPositive,
      text: styles.metaPillPositiveText,
      iconColor: tokens.colors.success,
    },
    warning: {
      container: styles.metaPillWarning,
      text: styles.metaPillWarningText,
      iconColor: tokens.colors.najdi.secondary,
    },
    danger: {
      container: styles.metaPillDanger,
      text: styles.metaPillDangerText,
      iconColor: tokens.colors.danger,
    },
  }[tone];

  const iconColor = toneStyles?.iconColor || tokens.colors.najdi.textMuted;

  return (
    <View style={[styles.metaPill, toneStyles?.container]}>
      {icon ? (
        <Ionicons
          name={icon}
          size={13}
          color={iconColor}
          style={styles.metaPillIcon}
        />
      ) : null}
      <Text style={[styles.metaPillText, toneStyles?.text]}>{label}</Text>
    </View>
  );
};

const AddActionButton = ({ label, onPress, icon = 'add-circle-outline' }) => (
  <TouchableOpacity
    style={styles.addActionButton}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <Ionicons name={icon} size={18} color={tokens.colors.najdi.primary} />
    <Text style={styles.addActionButtonText}>{label}</Text>
  </TouchableOpacity>
);

const TabFamily = ({ person, onDataChanged }) => {
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
  const [selectMotherModalVisible, setSelectMotherModalVisible] = useState(false);
  const [motherOptions, setMotherOptions] = useState([]);
  const [loadingMotherOptions, setLoadingMotherOptions] = useState(false);
  const [updatingMotherId, setUpdatingMotherId] = useState(null);
  const [motherFeedback, setMotherFeedback] = useState(null);
  const [spouseAdderVisible, setSpouseAdderVisible] = useState(false);
  const [spouseFeedback, setSpouseFeedback] = useState(null);
  const [prefilledSpouseName, setPrefilledSpouseName] = useState(null);
  const { refreshProfile } = useStore();

  useEffect(() => {
    let timeout;
    if (motherFeedback) {
      timeout = setTimeout(() => setMotherFeedback(null), 2000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [motherFeedback]);

  useEffect(() => {
    let timeout;
    if (spouseFeedback) {
      timeout = setTimeout(() => setSpouseFeedback(null), 2000);
    }
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [spouseFeedback]);

  useEffect(() => {
    if (person?.id) {
      loadFamilyData();
    }
  }, [person?.id]);

  const loadFamilyData = async (isRefresh = false) => {
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
  };

  const handleRefresh = () => {
    loadFamilyData(true);
  };

  const prefetchMotherOptions = async (fatherId) => {
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
  };

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

  const handleDeleteSpouse = async (marriage) => {
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
  };

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

  const handleEditMarriage = (marriage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMarriage(marriage);
    setEditMarriageModalVisible(true);
  };

  const handleEditMarriageSaved = async () => {
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
  };

  const handleEditChild = (child) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedChild(child);
    setEditChildModalVisible(true);
  };

  const handleEditChildSaved = async () => {
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
  };

  const handleDeleteChild = async (child) => {
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
  };

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
    return motherOptions.slice(0, 2);
  }, [motherOptions]);

  const handleChangeMother = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectMotherModalVisible(true);
  };

  const handleMotherSelected = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadFamilyData();
    if (refreshProfile) {
      await refreshProfile(person.id);
    }
    if (onDataChanged) {
      onDataChanged();
    }
    setSelectMotherModalVisible(false);
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
  const activeSpouses = spouses.filter((s) => s.status === 'current' || s.status === 'married');
  const inactiveSpouses = spouses.filter((s) => s.status !== 'current' && s.status !== 'married');
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
            emptySubtitle="إضافة الأب تساعد على اكتمال شجرة العائلة"
          />
          <ParentProfileCard
            label="الأم"
            profile={mother}
            emptyTitle="لم يتم اختيار الأم"
            emptySubtitle="أضف الأم ليكتمل ملفك"
            onAction={father ? handleChangeMother : null}
            actionLabel={mother ? 'تغيير الأم' : 'إضافة الأم'}
          >
            <MotherQuickActions
              suggestions={motherSuggestions}
              loading={loadingMotherOptions}
              selectedMotherId={person?.mother_id}
              updatingMotherId={updatingMotherId}
              feedback={motherFeedback}
              onSelect={handleQuickMotherSelect}
              onOpenAll={() => setSelectMotherModalVisible(true)}
              onClear={handleClearMother}
              hasFather={Boolean(father)}
            />
          </ParentProfileCard>
        </View>
      </SectionCard>

      <SectionCard
        icon="heart-outline"
        title={spousesTitle}
        subtitle="تفاصيل العلاقات الحالية والسابقة"
        badge={`${spouses.length}`}
        footer={
          <View>
            {!spouseAdderVisible ? (
              <AddActionButton label={addSpouseLabel} onPress={() => setSpouseAdderVisible(true)} />
            ) : null}
            <InlineSpouseAdder
              person={person}
              visible={spouseAdderVisible}
              onAdded={handleSpouseAddedInline}
              onCancel={() => setSpouseAdderVisible(false)}
              onNeedsSearch={handleNeedsAlQefariSearch}
              feedback={spouseFeedback}
            />
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
        icon="people-outline"
        title="الأبناء"
        subtitle="الأبناء عبر جميع الزيجات"
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

      <SelectMotherModal
        visible={selectMotherModalVisible}
        person={person}
        father={familyData?.father}
        onClose={() => setSelectMotherModalVisible(false)}
        onSaved={handleMotherSelected}
      />
    </ScrollView>
  );
};

// Spouse Row Component with rich metadata
const SpouseRow = ({ spouseData, onEdit, onDelete, inactive = false }) => {
  const spouse = spouseData.spouse_profile;
  if (!spouse) return null;

  const isMunasib = !spouse.hid;
  const hasChildren = spouseData.children_count > 0;
  const status = spouseData.status;
  const isMaleSpouse = spouse.gender === 'male';

  let statusMeta = null;
  if (status && status !== 'current' && status !== 'married') {
    // Show "سابق" for any past marriage (past, divorced, widowed)
    statusMeta = { label: 'سابق', tone: 'warning', icon: 'time-outline' };
  }

  return (
    <View style={[styles.itemRow, inactive && styles.itemRowInactive]}>
      <View style={styles.itemLeading}>
        <View
          style={[
            styles.itemAvatar,
            isMaleSpouse ? styles.itemAvatarMale : styles.itemAvatarFemale,
          ]}
        >
          <Ionicons
            name={isMaleSpouse ? 'male-outline' : 'female-outline'}
            size={18}
            color={isMaleSpouse ? tokens.colors.najdi.primary : tokens.colors.najdi.secondary}
          />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{spouse.name}</Text>
          <View style={styles.metaRow}>
            {isMunasib ? (
              <MetaPill
                label="منسب"
                tone="positive"
                icon="shield-checkmark-outline"
              />
            ) : null}
            {hasChildren ? (
              <MetaPill
                label={`${spouseData.children_count} ${
                  spouseData.children_count === 1 ? 'طفل' : 'أطفال'
                }`}
                icon="people-outline"
              />
            ) : null}
            {statusMeta ? <MetaPill {...statusMeta} /> : null}
          </View>
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.itemActionButton}
          onPress={() => onEdit(spouseData)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Ionicons name="create-outline" size={18} color={tokens.colors.najdi.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.itemActionButton}
          onPress={() => onDelete(spouseData)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={18} color={tokens.colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Child Row Component with contextual chips
const ChildRow = ({ child, onEdit, onDelete }) => {
  const isMale = child.gender === 'male';
  const genderIcon = isMale ? 'male-outline' : 'female-outline';

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLeading}>
        <View
          style={[
            styles.itemAvatar,
            isMale ? styles.itemAvatarMale : styles.itemAvatarFemale,
          ]}
        >
          <Ionicons
            name={genderIcon}
            size={18}
            color={isMale ? tokens.colors.najdi.primary : tokens.colors.najdi.secondary}
          />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{child.name}</Text>
          <View style={styles.metaRow}>
            <MetaPill label={isMale ? 'ذكر' : 'أنثى'} icon={genderIcon} />
            {child.mother_name ? (
              <MetaPill label={`من ${child.mother_name}`} icon="person-outline" />
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity
          style={styles.itemActionButton}
          onPress={() => onEdit(child)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Ionicons name="create-outline" size={18} color={tokens.colors.najdi.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.itemActionButton}
          onPress={() => onDelete(child)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={18} color={tokens.colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

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
    gap: tokens.spacing.xs,
    alignSelf: 'stretch',
    marginTop: tokens.spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  parentActionButtonPrimary: {
    backgroundColor: tokens.colors.najdi.primary,
  },
  parentActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.surface,
  },
  parentActionButtonTextPrimary: {
    color: tokens.colors.surface,
  },

  motherActions: {
    width: '100%',
    gap: tokens.spacing.sm,
  },
  motherActionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.sm,
  },
  motherActionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  motherActionsLink: {
    fontSize: 13,
    color: tokens.colors.najdi.primary,
    fontWeight: '600',
  },
  motherLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  motherLoadingText: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  motherFeedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.xs,
  },
  motherFeedbackText: {
    fontSize: 13,
    color: tokens.colors.success,
    fontWeight: '600',
  },
  motherChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.sm,
  },
  motherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.container + '40',
    backgroundColor: tokens.colors.najdi.background,
    minWidth: 0,
  },
  motherChipSelected: {
    borderColor: tokens.colors.najdi.primary,
    backgroundColor: tokens.colors.najdi.primary + '14',
  },
  motherChipUpdating: {
    opacity: 0.7,
  },
  motherChipAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  motherChipFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.container + '40',
  },
  motherChipInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  motherChipTextBlock: {
    flex: 1,
    minWidth: 80,
    flexShrink: 1,
  },
  motherChipName: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  motherChipHint: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
  },
  motherClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  motherClearText: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  motherEmptyContainer: {
    paddingVertical: tokens.spacing.sm,
  },
  motherEmptyText: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
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

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.bg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radii.md,
  },
  itemRowInactive: {
    opacity: 0.6,
  },
  itemLeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginEnd: tokens.spacing.sm,
  },
  itemAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
    marginEnd: tokens.spacing.md,
  },
  itemAvatarMale: {
    backgroundColor: 'rgba(161, 51, 51, 0.12)',
    borderColor: 'rgba(161, 51, 51, 0.26)',
  },
  itemAvatarFemale: {
    backgroundColor: 'rgba(213, 140, 74, 0.14)',
    borderColor: 'rgba(213, 140, 74, 0.3)',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: tokens.spacing.xs,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xxs,
    backgroundColor: tokens.colors.najdi.background,
    marginEnd: tokens.spacing.xs,
    marginBottom: tokens.spacing.xs,
  },
  metaPillPositive: {
    backgroundColor: 'rgba(52, 199, 89, 0.16)',
  },
  metaPillWarning: {
    backgroundColor: 'rgba(213, 140, 74, 0.18)',
  },
  metaPillDanger: {
    backgroundColor: 'rgba(255, 59, 48, 0.16)',
  },
  metaPillIcon: {
    marginEnd: 4,
  },
  metaPillText: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    fontWeight: '500',
  },
  metaPillPositiveText: {
    color: tokens.colors.success,
  },
  metaPillWarningText: {
    color: tokens.colors.najdi.secondary,
  },
  metaPillDangerText: {
    color: tokens.colors.danger,
  },

  itemActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.divider,
  },

  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },

  addActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: tokens.touchTarget.minimum,
    backgroundColor: 'rgba(161, 51, 51, 0.08)',
    borderRadius: tokens.radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(161, 51, 51, 0.24)',
    paddingHorizontal: tokens.spacing.lg,
  },
  addActionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.colors.najdi.primary,
    marginStart: tokens.spacing.xs,
  },
});

export default TabFamily;
