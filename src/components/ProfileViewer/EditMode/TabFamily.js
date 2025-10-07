import React, { useState, useEffect } from 'react';
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
import QuickAddOverlay from '../../admin/QuickAddOverlay';
import useStore from '../../../hooks/useStore';

const TabFamily = ({ person, onDataChanged }) => {
  // Early validation - show error if person not provided
  if (!person) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={tokens.colors.najdi.textMuted}
        />
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
  const { refreshProfile } = useStore();

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

      console.log('🔍 Family Tab RPC Response:', {
        hasData: !!data,
        hasError: !!error,
        profileId: person.id,
        spousesCount: data?.spouses?.length || 0,
        childrenCount: data?.children?.length || 0,
        hasFather: !!data?.father,
        hasMother: !!data?.mother,
      });

      if (error) {
        console.error('❌ Failed to load family data:', error);
        Alert.alert('خطأ', `فشل تحميل بيانات العائلة: ${error.message || error.code}`);
        setFamilyData(null);
        return;
      }

      // Check for SQL errors embedded in response
      if (data?.error) {
        console.error('❌ SQL error in RPC result:', data.error);
        Alert.alert('خطأ في قاعدة البيانات', data.error);
        setFamilyData(null);
        return;
      }

      setFamilyData(data);
    } catch (err) {
      console.error('Error loading family data:', err);
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

  const handleSpouseAdded = async (marriage) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await loadFamilyData(); // Refresh family data
    if (refreshProfile) {
      await refreshProfile(person.id); // Refresh global cache
    }
    if (onDataChanged) {
      onDataChanged(); // Notify parent component
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
            console.error('Error deleting marriage:', error);
            Alert.alert('خطأ', 'فشل حذف الزواج');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tokens.colors.najdi.crimson} />
        <Text style={styles.loadingText}>جاري تحميل بيانات العائلة...</Text>
      </View>
    );
  }

  if (!familyData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={tokens.colors.najdi.textMuted}
        />
        <Text style={styles.errorText}>فشل تحميل بيانات العائلة</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadFamilyData()}>
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { father, mother, spouses = [], children = [] } = familyData;
  const activeSpouses = spouses.filter((s) => s.status === 'married');
  const inactiveSpouses = spouses.filter((s) => s.status !== 'married');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={tokens.colors.najdi.crimson}
        />
      }
    >
      {/* Parents Section (Read-Only) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="people-outline"
            size={20}
            color={tokens.colors.najdi.crimson}
          />
          <Text style={styles.sectionTitle}>الوالدين</Text>
        </View>

        {father ? (
          <View style={styles.parentCard}>
            <View style={styles.parentInfo}>
              <Text style={styles.parentLabel}>الأب</Text>
              <Text style={styles.parentName}>{father.name}</Text>
              {father.hid && (
                <Text style={styles.parentHid}>{father.hid}</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>لا يوجد أب محدد</Text>
          </View>
        )}

        {mother ? (
          <View style={styles.parentCard}>
            <View style={styles.parentInfo}>
              <Text style={styles.parentLabel}>الأم</Text>
              <Text style={styles.parentName}>{mother.name}</Text>
              {mother.hid && (
                <Text style={styles.parentHid}>{mother.hid}</Text>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>لا يوجد أم محددة</Text>
          </View>
        )}
      </View>

      {/* Spouses Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="heart-outline"
            size={20}
            color={tokens.colors.najdi.crimson}
          />
          <Text style={styles.sectionTitle}>
            {person.gender === 'male' ? 'الزوجات' : 'الأزواج'}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{spouses.length}</Text>
          </View>
        </View>

        {/* Active Spouses */}
        {activeSpouses.length > 0 && (
          <>
            {activeSpouses.map((spouseData) => (
              <SpouseCard
                key={spouseData.marriage_id}
                spouseData={spouseData}
                personGender={person.gender}
                onDelete={handleDeleteSpouse}
              />
            ))}
          </>
        )}

        {/* Inactive Spouses (divorced/widowed) */}
        {inactiveSpouses.length > 0 && (
          <View style={styles.inactiveSpousesSection}>
            <Text style={styles.inactiveSectionTitle}>زيجات سابقة</Text>
            {inactiveSpouses.map((spouseData) => (
              <SpouseCard
                key={spouseData.marriage_id}
                spouseData={spouseData}
                personGender={person.gender}
                onDelete={handleDeleteSpouse}
                inactive
              />
            ))}
          </View>
        )}

        {/* Add Spouse Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSpouseModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="add-circle-outline"
            size={22}
            color={tokens.colors.najdi.crimson}
          />
          <Text style={styles.addButtonText}>
            {person.gender === 'male' ? 'إضافة زوجة' : 'إضافة زوج'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Children Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons
            name="people-circle-outline"
            size={20}
            color={tokens.colors.najdi.crimson}
          />
          <Text style={styles.sectionTitle}>الأبناء</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{children.length}</Text>
          </View>
        </View>

        {children.length > 0 ? (
          <>
            {children.map((child) => (
              <ChildCard key={child.id} child={child} />
            ))}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons
              name="person-add-outline"
              size={32}
              color={tokens.colors.najdi.textMuted}
            />
            <Text style={styles.emptyText}>لا يوجد أبناء</Text>
          </View>
        )}

        {/* Add Child Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            // Validate for women: Must have at least one husband
            if (person.gender === 'female' && spouses.length === 0) {
              Alert.alert(
                'تنبيه',
                'يجب إضافة زوج أولاً قبل إضافة الأبناء',
                [
                  {
                    text: 'إضافة زوج',
                    onPress: () => setSpouseModalVisible(true),
                  },
                  { text: 'إلغاء', style: 'cancel' },
                ]
              );
              return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setChildModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="add-circle-outline"
            size={22}
            color={tokens.colors.najdi.crimson}
          />
          <Text style={styles.addButtonText}>إضافة ابن/ابنة</Text>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <SpouseManager
        visible={spouseModalVisible}
        person={person}
        onClose={() => setSpouseModalVisible(false)}
        onSpouseAdded={handleSpouseAdded}
      />

      <QuickAddOverlay
        visible={childModalVisible}
        parentNode={person}
        siblings={children}
        onClose={handleChildAdded}
      />
    </ScrollView>
  );
};

// Spouse Card Component
const SpouseCard = ({ spouseData, personGender, onDelete, inactive = false }) => {
  const spouse = spouseData.spouse_profile;
  if (!spouse) return null;

  return (
    <View style={[styles.card, inactive && styles.inactiveCard]}>
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{spouse.name}</Text>
          {spouse.hid && (
            <Text style={styles.cardHid}>HID: {spouse.hid}</Text>
          )}
          {!spouse.hid && (
            <View style={styles.munasibBadge}>
              <Text style={styles.munasibText}>منسب</Text>
            </View>
          )}
          {spouseData.status && spouseData.status !== 'married' && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {spouseData.status === 'divorced' ? 'مطلق' : 'متوفى'}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(spouseData)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={18} color="#A13333" />
        </TouchableOpacity>
      </View>
      {spouseData.children_count > 0 && (
        <Text style={styles.childrenCount}>
          {spouseData.children_count}{' '}
          {spouseData.children_count === 1 ? 'طفل' : 'أطفال'}
        </Text>
      )}
    </View>
  );
};

// Child Card Component
const ChildCard = ({ child }) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.cardInfo}>
          <View style={styles.childNameRow}>
            <Text style={styles.cardName}>{child.name}</Text>
            {child.shows_on_tree && (
              <Ionicons
                name="git-network-outline"
                size={16}
                color={tokens.colors.najdi.ochre}
                style={styles.treeIcon}
              />
            )}
          </View>
          <View style={styles.childDetails}>
            <Text style={styles.childGender}>
              {child.gender === 'male' ? '♂ ذكر' : '♀ أنثى'}
            </Text>
            {child.mother_name && (
              <Text style={styles.childMother}>• الأم: {child.mother_name}</Text>
            )}
          </View>
          {child.sibling_order !== null && child.sibling_order !== undefined && (
            <Text style={styles.siblingOrder}>الترتيب: {child.sibling_order + 1}</Text>
          )}
        </View>
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
    padding: tokens.spacing.md,
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
    color: tokens.colors.najdi.textMuted,
    marginTop: tokens.spacing.md,
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
    backgroundColor: tokens.colors.najdi.crimson,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: 8,
  },
  retryButtonText: {
    color: tokens.colors.najdi.background,
    fontSize: 15,
    fontWeight: '600',
  },

  // Section Styles
  section: {
    marginBottom: tokens.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.najdi.text,
  },
  countBadge: {
    backgroundColor: tokens.colors.najdi.container,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: tokens.spacing.xs,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.najdi.crimson,
  },

  // Parent Cards
  parentCard: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: 12,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
  },
  parentInfo: {
    gap: tokens.spacing.xxs,
  },
  parentLabel: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    fontWeight: '500',
  },
  parentName: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  parentHid: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },

  // Generic Card
  card: {
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: 12,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.najdi.container,
  },
  inactiveCard: {
    opacity: 0.6,
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
    gap: tokens.spacing.xxs,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
  },
  cardHid: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  deleteButton: {
    padding: tokens.spacing.xs,
  },

  // Badges
  munasibBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.najdi.ochre + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  munasibText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.najdi.ochre,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.najdi.textMuted + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
  },
  childrenCount: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
    marginTop: tokens.spacing.xs,
  },

  // Child Card Specific
  childNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  treeIcon: {
    marginLeft: 4,
  },
  childDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    marginTop: 2,
  },
  childGender: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  childMother: {
    fontSize: 13,
    color: tokens.colors.najdi.textMuted,
  },
  siblingOrder: {
    fontSize: 12,
    color: tokens.colors.najdi.textMuted,
    marginTop: 2,
  },

  // Inactive Spouses Section
  inactiveSpousesSection: {
    marginTop: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.najdi.container,
  },
  inactiveSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.sm,
  },

  // Empty States
  emptyCard: {
    backgroundColor: tokens.colors.najdi.container + '30',
    borderRadius: 12,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    color: tokens.colors.najdi.textMuted,
    textAlign: 'center',
  },

  // Add Button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.najdi.background,
    borderRadius: 12,
    padding: tokens.spacing.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.najdi.crimson,
    borderStyle: 'dashed',
    gap: tokens.spacing.sm,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.najdi.crimson,
  },
});

export default TabFamily;
