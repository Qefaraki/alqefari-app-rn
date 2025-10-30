/**
 * FamilyStatistics Component
 *
 * Displays comprehensive family statistics in a fullscreen modal
 * Pattern: Follows Munasib Manager architecture exactly
 * Charts: Victory Native with RTL support
 * Performance: Lazy loading for secondary charts
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../services/supabase';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import LargeTitleHeader from '../ios/LargeTitleHeader';
import SkeletonLoader from '../ui/SkeletonLoader';
import tokens from '../ui/tokens';
import { RTLVictoryPie, RTLVictoryBar } from '../charts/RTLVictoryWrappers';
import { useAbsoluteDate } from '../../hooks/useFormattedDate';

const palette = tokens.colors.najdi;
const spacing = tokens.spacing;
const typography = tokens.typography;

const formatNumber = (value) => {
  if (value === null || value === undefined) return '—';
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return '—';
  return new Intl.NumberFormat('ar-SA').format(numericValue);
};

const formatPercent = (value, total) => {
  if (!total || total === 0 || value === null || value === undefined) {
    return '0%';
  }
  const numericValue = Number(value);
  const numericTotal = Number(total);
  if (Number.isNaN(numericValue) || Number.isNaN(numericTotal) || numericTotal === 0) {
    return '0%';
  }
  const percent = Math.round((numericValue / numericTotal) * 100);
  return `${percent}%`;
};

export default function FamilyStatistics({ onClose }) {
  // Data states (split by RPC for graceful degradation)
  const [coreStats, setCoreStats] = useState(null);
  const [extendedStats, setExtendedStats] = useState(null);

  // Loading states
  const [initialLoading, setInitialLoading] = useState(true);
  const [extendedLoading, setExtendedLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [extendedRetrying, setExtendedRetrying] = useState(false);

  // Performance: Lazy load charts as user scrolls
  const [visibleCharts, setVisibleCharts] = useState(['gender']); // Start with hero only

  // Lifecycle management
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const lastRefreshTime = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    loadStatistics();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadStatistics = async ({ useOverlay = false } = {}) => {
    // Abort previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    if (!initialLoading && useOverlay) {
      setIsFetching(true);
    }

    try {
      // Load core stats first (4s timeout, 1s buffer over backend 3s)
      const { data: core, error: coreError } = await fetchWithTimeout(
        supabase.rpc('admin_get_core_statistics'),
        4000,
        'Core statistics'
      );

      if (signal.aborted || !isMountedRef.current) return;

      if (coreError) throw coreError;
      setCoreStats(core);
      setInitialLoading(false);

      // Load extended stats second (4s timeout)
      setExtendedLoading(true);
      const { data: extended, error: extendedError } = await fetchWithTimeout(
        supabase.rpc('admin_get_extended_statistics'),
        4000,
        'Extended statistics'
      );

      if (signal.aborted || !isMountedRef.current) return;

      if (extendedError) {
        console.warn('Extended stats failed:', extendedError);
        setExtendedStats(null);
      } else if (extended?.error) {
        // RPC returned error object (timeout or failure)
        console.warn('Extended stats timeout/error:', extended.message);
        setExtendedStats(null);
      } else {
        setExtendedStats(extended);
        // Haptic feedback on successful initial load
        if (initialLoading) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      if (!isMountedRef.current) return;

      if (error.message === 'NETWORK_OFFLINE') {
        Alert.alert('خطأ', 'لا يوجد اتصال بالإنترنت');
      } else if (error.message.includes('NETWORK_TIMEOUT')) {
        Alert.alert('خطأ', 'انتهت المهلة. حاول مرة أخرى');
      } else {
        Alert.alert('خطأ', 'فشل تحميل الإحصائيات');
      }
      console.error('Statistics load error:', error);
    } finally {
      if (isMountedRef.current && !signal.aborted) {
        setExtendedLoading(false);
        setIsFetching(false);
      }
    }
  };

  const handleExtendedRetry = async () => {
    setExtendedRetrying(true);
    setExtendedLoading(true);
    try {
      const { data, error } = await fetchWithTimeout(
        supabase.rpc('admin_get_extended_statistics'),
        4000,
        'Extended statistics retry'
      );

      if (error || data?.error) {
        setExtendedStats(null);
      } else {
        setExtendedStats(data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      if (error.message === 'NETWORK_OFFLINE') {
        Alert.alert('خطأ', 'لا يوجد اتصال بالإنترنت');
      }
    } finally {
      setExtendedRetrying(false);
      setExtendedLoading(false);
    }
  };

  const handleRefresh = () => {
    const now = Date.now();
    if (now - lastRefreshTime.current < 2000) {
      return; // Don't even set isFetching
    }
    lastRefreshTime.current = now;
    setIsFetching(true);
    loadStatistics({ useOverlay: true });
  };

  // Lazy loading handler for performance
  const handleChartVisible = (chartName) => {
    if (!visibleCharts.includes(chartName)) {
      setVisibleCharts((prev) => [...prev, chartName]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LargeTitleHeader
        title="إحصائيات"
        emblemSource={require('../../../assets/logo/AlqefariEmblem.png')}
        rightSlot={
          <TouchableOpacity
            onPress={() => {
              onClose();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            style={styles.closeButton}
          >
            <Ionicons name="chevron-back" size={28} color={palette.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={handleRefresh}
            tintColor={palette.primary}
            title="تحديث الإحصائيات"
            titleColor={palette.text}
          />
        }
      >
        {initialLoading ? (
          <SkeletonContent />
        ) : (
          <>
            <IntroSurface />
            <HeroSection stats={coreStats} />
            <OperationalSnapshot stats={coreStats} />

            {/* Generations Section - Lazy Load */}
            <LazyChartSection
              chartName="generations"
              onVisible={handleChartVisible}
              isVisible={visibleCharts.includes('generations')}
            >
              <GenerationsSection stats={coreStats} />
            </LazyChartSection>

            {/* Names Section - Extended Stats (Can timeout) */}
            {extendedLoading ? (
              <LoadingSection title="الأسماء الأكثر شيوعاً" />
            ) : extendedStats ? (
              <LazyChartSection
                chartName="names"
                onVisible={handleChartVisible}
                isVisible={visibleCharts.includes('names')}
              >
                <NamesSection stats={extendedStats} />
              </LazyChartSection>
            ) : (
              <ErrorSection
                title="الأسماء الأكثر شيوعاً"
                message="يستغرق التحميل وقتاً أطول من المتوقع"
                onRetry={handleExtendedRetry}
                isRetrying={extendedRetrying}
              />
            )}

            {/* Munasib Section - Extended Stats */}
            {extendedStats && (
              <LazyChartSection
                chartName="munasib"
                onVisible={handleChartVisible}
                isVisible={visibleCharts.includes('munasib')}
              >
                <MunasibSection stats={extendedStats} />
              </LazyChartSection>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Skeleton Loader for initial load
const SkeletonContent = () => (
  <View style={styles.skeletonContainer}>
    {[...Array(4)].map((_, index) => (
      <View key={index} style={styles.skeletonCard}>
        <SkeletonLoader width="45%" height={20} style={{ marginBottom: spacing.md }} />
        <SkeletonLoader width="100%" height={index === 0 ? 200 : 160} />
      </View>
    ))}
  </View>
);

// Intro Surface with Sadu Pattern (exact copy from Munasib Manager)
const IntroSurface = () => (
  <View style={styles.introSurface}>
    <View style={styles.patternRow}>
      {[...Array(6)].map((_, i) => (
        <Image
          key={i}
          source={require('../../../assets/sadu_patterns/png/7.png')}
          style={styles.introPattern}
          resizeMode="contain"
        />
      ))}
    </View>
    <View style={styles.introContent}>
      <Text style={styles.introSubtitle}>
        تعرّف على أرقام ومعلومات مفصلة عن العائلة عبر الأجيال
      </Text>
    </View>
  </View>
);

// Hero Section: Total members + Gender donut chart
const HeroSection = ({ stats }) => {
  const gender = stats?.gender;
  const formattedDate = useAbsoluteDate(stats?.calculated_at);

  if (!gender || gender.total === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyStateText}>لا توجد بيانات متاحة</Text>
      </View>
    );
  }

  const maleCount = gender.male ?? 0;
  const femaleCount = gender.female ?? 0;
  const totalCount = gender.total ?? maleCount + femaleCount;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardEyebrow}>إجمالي أفراد العائلة</Text>
          <Text style={styles.heroNumber}>{formatNumber(totalCount)}</Text>
          <Text style={styles.cardSubtitle}>التوزيع حسب الجنس</Text>
        </View>
        {formattedDate ? (
          <View style={styles.badge}>
            <Text style={styles.badgeHint}>آخر تحديث</Text>
            <Text style={styles.badgeText}>{formattedDate}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.heroContent}>
        <View style={styles.heroStats}>
          <HeroStat
            label="ذكور"
            value={formatNumber(maleCount)}
            percent={formatPercent(maleCount, totalCount)}
          />
          <HeroStat
            label="إناث"
            value={formatNumber(femaleCount)}
            percent={formatPercent(femaleCount, totalCount)}
          />
        </View>

        <View
          style={styles.heroChart}
          accessibilityLabel={`توزيع الأفراد: ${maleCount} ذكور و ${femaleCount} إناث من إجمالي ${totalCount}`}
        >
          <RTLVictoryPie
            data={[
              { x: '', y: maleCount },
              { x: '', y: femaleCount },
            ]}
            colorScale={[palette.primary, palette.secondary]}
            innerRadius={85}
            width={260}
            height={220}
            padding={{ top: 0, bottom: 0, left: 0, right: 0 }}
            labels={() => null}
            style={{
              data: {
                stroke: palette.background,
                strokeWidth: 4,
              },
            }}
            animate={{ duration: 650, easing: 'cubicOut' }}
          />
        </View>
      </View>
    </View>
  );
};

const HeroStat = ({ label, value, percent }) => (
  <View style={styles.heroStat}>
    <Text style={styles.heroStatLabel}>{label}</Text>
    <Text style={styles.heroStatValue}>{value}</Text>
    {percent ? <Text style={styles.heroStatCaption}>{percent}</Text> : null}
  </View>
);

const OperationalSnapshot = ({ stats }) => {
  const vital = stats?.vital_status;
  const living = typeof vital?.living === 'number' ? vital.living : null;
  const deceased = typeof vital?.deceased === 'number' ? vital.deceased : null;

  if (living === null && deceased === null) {
    return null;
  }

  const totalPool =
    stats?.gender?.total ??
    [living, deceased].filter((value) => typeof value === 'number').reduce((sum, value) => sum + (value || 0), 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardEyebrow}>نظرة تشغيلية</Text>
          <Text style={styles.cardSubtitle}>حالة أعضاء العائلة الآن</Text>
        </View>
      </View>

      <View style={styles.snapshotGroup}>
        {living !== null && (
          <SnapshotRow
            label="أحياء"
            value={formatNumber(living)}
            percent={totalPool ? formatPercent(living, totalPool) : null}
          />
        )}
        {deceased !== null && (
          <SnapshotRow
            label="رحمهم الله"
            value={formatNumber(deceased)}
            percent={totalPool ? formatPercent(deceased, totalPool) : null}
          />
        )}
      </View>
    </View>
  );
};

const SnapshotRow = ({ label, value, percent }) => (
  <View style={styles.snapshotRow}>
    <Text style={styles.snapshotLabel}>{label}</Text>
    <View style={styles.snapshotValueGroup}>
      <Text style={styles.snapshotValue}>{value}</Text>
      {percent ? <Text style={styles.snapshotPercent}>{percent}</Text> : null}
    </View>
  </View>
);

// Generations Section: Horizontal bar chart
const GenerationsSection = ({ stats }) => {
  const generations = stats?.generations;

  if (!Array.isArray(generations) || generations.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardEyebrow}>رحلة الأجيال</Text>
            <Text style={styles.cardSubtitle}>لم يتم تسجيل بيانات الأجيال بعد</Text>
          </View>
        </View>
        <View style={styles.emptyCard}>
          <Ionicons name="bar-chart-outline" size={48} color={`${palette.text}40`} />
          <Text style={styles.emptyChartText}>لا توجد بيانات الأجيال</Text>
        </View>
      </View>
    );
  }

  const maxCount = Math.max(...generations.map((g) => g.count || 0));
  const largestGen = generations.reduce((max, g) => (g.count > max.count ? g : max), generations[0]);

  const getArabicOrdinal = (num) => {
    const ordinals = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];
    return ordinals[num - 1] || num.toString();
  };

  const generationShades = [
    '#F4DCC8',
    '#ECDCC3',
    '#E4C5A8',
    '#DCAD8D',
    '#D58C4A',
    '#C97A38',
    '#BD6826',
    '#B15614',
  ];

  return (
    <View
      style={styles.card}
      accessibilityLabel={`توزيع ${generations.length} أجيال. الجيل ${getArabicOrdinal(
        largestGen.generation
      )} هو الأكبر بـ ${formatNumber(largestGen.count)} فرد`}
    >
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardEyebrow}>رحلة الأجيال</Text>
          <Text style={styles.cardSubtitle}>مقارنة حجم كل جيل في شجرة العائلة</Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="people-outline" size={16} color={palette.primary} />
          <Text style={styles.badgeText}>{`${generations.length} أجيال`}</Text>
        </View>
      </View>

      <View style={styles.chartWrapper}>
        <RTLVictoryBar
          data={generations.map((g, idx) => ({
            x: `الجيل ${getArabicOrdinal(g.generation)}`,
            y: g.count,
            label: formatNumber(g.count),
            fill: generationShades[idx] || generationShades[generationShades.length - 1],
          }))}
          horizontal
          height={Math.max(280, generations.length * 58)}
          barProps={{
            cornerRadius: 6,
            style: {
              data: {
                fill: ({ datum }) => datum.fill,
                stroke: `${palette.text}12`,
                strokeWidth: 1,
              },
              labels: {
                fontSize: 13,
                fontFamily: 'SFArabic-Semibold',
                fill: palette.text,
                padding: 6,
              },
            },
            animate: { duration: 600, easing: 'cubicOut' },
          }}
        />
      </View>

      <Text style={styles.calloutText}>
        الجيل {getArabicOrdinal(largestGen.generation)} هو الأكبر بـ {formatNumber(largestGen.count)} فرد
      </Text>
    </View>
  );
};

// Names Section: Top male/female names
const NamesSection = ({ stats }) => {
  const topMale = stats?.top_male_names;
  const topFemale = stats?.top_female_names;

  const [selectedGender, setSelectedGender] = useState('male');
  const [showAll, setShowAll] = useState(false);

  const segments = useMemo(
    () => [
      {
        key: 'male',
        label: 'أسماء الذكور',
        color: palette.primary,
        data: Array.isArray(topMale) ? topMale : [],
      },
      {
        key: 'female',
        label: 'أسماء الإناث',
        color: palette.secondary,
        data: Array.isArray(topFemale) ? topFemale : [],
      },
    ],
    [topFemale, topMale]
  );

  const firstWithData = useMemo(
    () => segments.find((item) => item.data.length > 0),
    [segments]
  );

  useEffect(() => {
    const activeHasData = segments.some(
      (segment) => segment.key === selectedGender && segment.data.length > 0
    );
    if (!activeHasData && firstWithData) {
      setSelectedGender(firstWithData.key);
      setShowAll(false);
    }
  }, [firstWithData, segments, selectedGender]);

  if (!firstWithData) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardEyebrow}>الأسماء الأكثر شيوعاً</Text>
            <Text style={styles.cardSubtitle}>لا توجد بيانات متاحة حالياً</Text>
          </View>
        </View>
        <View style={styles.emptyCard}>
          <Ionicons name="stats-chart-outline" size={48} color={`${palette.text}40`} />
          <Text style={styles.emptyChartText}>لا توجد بيانات الأسماء</Text>
        </View>
      </View>
    );
  }

  const activeOption =
    segments.find((segment) => segment.key === selectedGender) || firstWithData;
  const names = activeOption.data;
  const totalCount = names.reduce((sum, item) => sum + (item.count || 0), 0);
  const maxCount = names[0]?.count || 1;
  const displayNames = showAll ? names : names.slice(0, 5);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardEyebrow}>الأسماء الأكثر شيوعاً</Text>
          <Text style={styles.cardSubtitle}>تعرف على أبرز الأسماء داخل العائلة</Text>
        </View>
      </View>

      <View style={styles.segmentedControl}>
        {segments.map((segment) => {
          const isActive = segment.key === activeOption.key;
          return (
            <TouchableOpacity
              key={segment.key}
              style={[
                styles.segmentOption,
                isActive && [styles.segmentOptionActive, { backgroundColor: segment.color }],
              ]}
              onPress={() => {
                if (!isActive) {
                  setSelectedGender(segment.key);
                  setShowAll(false);
                }
              }}
              disabled={segment.data.length === 0}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  isActive && styles.segmentLabelActive,
                  segment.data.length === 0 && styles.segmentLabelDisabled,
                ]}
              >
                {segment.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.namesList}>
        {displayNames.map((item, index) => {
          const widthPercent = maxCount
            ? `${Math.max(14, Math.round((item.count / maxCount) * 100))}%`
            : '14%';
          const share = totalCount ? formatPercent(item.count, totalCount) : null;
          return (
            <View key={`${activeOption.key}-${item.name}`} style={styles.nameRow}>
              <View
                style={[
                  styles.rankBubble,
                  index === 0 && styles.rankBubbleGold,
                  index === 1 && styles.rankBubbleSilver,
                  index === 2 && styles.rankBubbleBronze,
                ]}
              >
                <Text
                  style={[
                    styles.rankBubbleText,
                    index < 3 && styles.rankBubbleTextEmphasis,
                  ]}
                >
                  {index + 1}
                </Text>
              </View>
              <View style={styles.nameInfo}>
                <Text style={styles.namePrimary}>{item.name}</Text>
                <Text style={styles.nameSecondary}>
                  {formatNumber(item.count)} مرة
                </Text>
              </View>
              <View style={styles.progressColumn}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: widthPercent,
                        backgroundColor: activeOption.color,
                      },
                    ]}
                  />
                </View>
                {share && <Text style={styles.progressPercent}>{share}</Text>}
              </View>
            </View>
          );
        })}
      </View>

      {names.length > 5 && (
        <TouchableOpacity style={styles.linkButton} onPress={() => setShowAll((prev) => !prev)}>
          <Text style={styles.linkButtonText}>
            {showAll ? 'عرض عناصر أقل' : 'عرض القائمة الكاملة'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Munasib Section: Leaderboard style
const MunasibSection = ({ stats }) => {
  const families = Array.isArray(stats?.top_munasib_families)
    ? stats.top_munasib_families
    : [];
  const totals = stats?.munasib_totals ?? {};
  const marriageStats = stats?.marriage_stats ?? {};
  const [showAll, setShowAll] = useState(false);

  if (!families.length) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardEyebrow}>أنساب القفاري</Text>
            <Text style={styles.cardSubtitle}>لا توجد بيانات الأنساب حاليا</Text>
          </View>
        </View>
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={48} color={`${palette.text}40`} />
          <Text style={styles.emptyChartText}>لا توجد بيانات الأنساب</Text>
        </View>
      </View>
    );
  }

  const displayFamilies = showAll ? families : families.slice(0, 6);
  const topMetrics = [
    {
      key: 'total',
      label: 'إجمالي الأنساب',
      value: formatNumber(marriageStats.total_marriages ?? totals.total_munasib),
    },
    {
      key: 'wives',
      label: 'الزوجات',
      value: formatNumber(totals.female_munasib),
    },
    {
      key: 'husbands',
      label: 'الأزواج',
      value: formatNumber(totals.male_munasib),
    },
  ].filter((item) => item.value !== '—');

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardEyebrow}>أنساب القفاري</Text>
          <Text style={styles.cardSubtitle}>مؤشرات الزواج مع العائلات الأخرى</Text>
        </View>
      </View>

      <View style={styles.snapshotGroup}>
        {topMetrics.map((metric) => (
          <SnapshotRow key={metric.key} label={metric.label} value={metric.value} />
        ))}
      </View>

      <View style={styles.leaderboardList}>
        {displayFamilies.map((family, index) => (
          <View key={family.family} style={styles.leaderboardRow}>
            <View
              style={[
                styles.rankBubble,
                index === 0 && styles.rankBubbleGold,
                index === 1 && styles.rankBubbleSilver,
                index === 2 && styles.rankBubbleBronze,
              ]}
            >
              <Text
                style={[
                  styles.rankBubbleText,
                  index < 3 && styles.rankBubbleTextEmphasis,
                ]}
              >
                {index + 1}
              </Text>
            </View>
            <View style={styles.leaderboardInfo}>
              <Text style={styles.familyName}>عائلة {family.family}</Text>
              <Text style={styles.leaderboardHint}>{formatNumber(family.count)} مرة</Text>
            </View>
          </View>
        ))}
      </View>

      {families.length > displayFamilies.length && (
        <TouchableOpacity style={styles.linkButton} onPress={() => setShowAll((prev) => !prev)}>
          <Text style={styles.linkButtonText}>
            {showAll ? 'عرض عناصر أقل' : 'عرض جميع العائلات'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Lazy Chart Section (Performance optimization)
const LazyChartSection = ({ chartName, onVisible, isVisible, children }) => {
  const ref = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (ref.current) {
        onVisible(chartName);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [chartName, onVisible]);

  return <View ref={ref}>{isVisible ? children : <ChartSkeleton />}</View>;
};

// Chart Skeleton for lazy loading
const ChartSkeleton = () => (
  <View style={styles.card}>
    <SkeletonLoader width="45%" height={20} style={{ marginBottom: spacing.md }} />
    <SkeletonLoader width="100%" height={180} />
  </View>
);

// Loading Section for extended stats
const LoadingSection = ({ title }) => (
  <View style={styles.card}>
    <View style={styles.cardHeaderRow}>
      <View>
        <Text style={styles.cardEyebrow}>{title}</Text>
        <Text style={styles.cardSubtitle}>جارٍ التحميل...</Text>
      </View>
    </View>
    <View style={styles.loadingCard}>
      <Ionicons name="time-outline" size={32} color={palette.secondary} />
      <Text style={styles.loadingText}>جارٍ التحميل...</Text>
    </View>
  </View>
);

// Error Section for failed extended stats
const ErrorSection = ({ title, message, onRetry, isRetrying = false }) => (
  <View style={styles.card}>
    <View style={styles.cardHeaderRow}>
      <View>
        <Text style={styles.cardEyebrow}>{title}</Text>
        <Text style={styles.cardSubtitle}>حدث خطأ أثناء تحميل البيانات</Text>
      </View>
    </View>
    <View style={styles.errorCard}>
      <Ionicons name="alert-circle-outline" size={32} color={palette.secondary} />
      <Text style={styles.errorText}>{message}</Text>
      <TouchableOpacity
        style={[styles.retryButton, isRetrying && styles.retryButtonDisabled]}
        onPress={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <ActivityIndicator size="small" color={palette.background} />
        ) : (
          <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
        )}
      </TouchableOpacity>
    </View>
  </View>
);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl * 1.25,
  },
  closeButton: {
    width: tokens.touchTarget.minimum,
    height: tokens.touchTarget.minimum,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  skeletonCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.text}0F`,
  },
  introSurface: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.container}40`,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: tokens.shadow.ios,
      android: tokens.shadow.android,
    }),
  },
  patternRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: 32,
    overflow: 'hidden',
    borderTopLeftRadius: tokens.radii.lg,
    borderTopRightRadius: tokens.radii.lg,
  },
  introPattern: {
    width: 64,
    height: 32,
    tintColor: palette.primary,
    opacity: 0.4,
  },
  introContent: {
    paddingTop: spacing.lg + 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  introSubtitle: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: `${palette.text}99`,
    lineHeight: typography.subheadline.lineHeight,
  },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.text}0F`,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  cardEyebrow: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: `${palette.text}80`,
    fontWeight: '600',
  },
  cardSubtitle: {
    ...typography.footnote,
    fontFamily: 'SF Arabic',
    color: `${palette.text}70`,
    marginTop: spacing.xs / 2,
  },
  badge: {
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: tokens.radii.md,
    backgroundColor: `${palette.primary}14`,
    maxWidth: 180,
  },
  badgeHint: {
    ...typography.caption2,
    fontFamily: 'SF Arabic',
    color: `${palette.primary}AA`,
    fontWeight: '600',
  },
  badgeText: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: palette.primary,
    fontWeight: '600',
    flexShrink: 1,
  },
  heroNumber: {
    fontSize: 44,
    fontFamily: 'SF Arabic',
    fontWeight: '700',
    color: palette.text,
    marginTop: spacing.xs,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  heroStats: {
    flex: 1,
    gap: spacing.md,
  },
  heroStat: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: tokens.radii.md,
    backgroundColor: `${palette.text}03`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.text}0D`,
  },
  heroStatLabel: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: `${palette.text}80`,
    marginBottom: spacing.xs / 2,
  },
  heroStatValue: {
    ...typography.title2,
    fontFamily: 'SF Arabic',
    color: palette.text,
    fontWeight: '700',
  },
  heroStatCaption: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: `${palette.text}70`,
    marginTop: spacing.xs / 2,
  },
  heroChart: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapshotGroup: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: `${palette.text}0D`,
  },
  snapshotLabel: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: palette.text,
    fontWeight: '600',
  },
  snapshotValueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  snapshotValue: {
    ...typography.title3,
    fontFamily: 'SF Arabic',
    color: palette.text,
    fontWeight: '700',
  },
  snapshotPercent: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: `${palette.text}70`,
  },
  chartWrapper: {
    marginTop: spacing.sm,
  },
  calloutText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: palette.text,
    marginTop: spacing.lg,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: tokens.radii.md,
    backgroundColor: `${palette.text}07`,
    padding: spacing.xs / 2,
    marginBottom: spacing.lg,
  },
  segmentOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: tokens.radii.md,
  },
  segmentOptionActive: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
  },
  segmentLabel: {
    ...typography.footnote,
    fontFamily: 'SF Arabic',
    color: `${palette.text}90`,
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: tokens.colors.surface,
  },
  segmentLabelDisabled: {
    color: `${palette.text}40`,
  },
  namesList: {
    gap: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${palette.text}08`,
  },
  rankBubbleGold: {
    backgroundColor: '#F7E5B5',
  },
  rankBubbleSilver: {
    backgroundColor: '#E0E5EC',
  },
  rankBubbleBronze: {
    backgroundColor: '#E8C9AB',
  },
  rankBubbleText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: palette.text,
    fontWeight: '600',
  },
  rankBubbleTextEmphasis: {
    color: '#85592B',
  },
  nameInfo: {
    flex: 1,
    gap: 2,
  },
  namePrimary: {
    ...typography.headline,
    fontFamily: 'SF Arabic',
    color: palette.text,
  },
  nameSecondary: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: `${palette.text}70`,
  },
  progressColumn: {
    width: 90,
    alignItems: 'flex-end',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: `${palette.text}0F`,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  progressPercent: {
    ...typography.caption2,
    fontFamily: 'SF Arabic',
    color: `${palette.text}70`,
    marginTop: spacing.xs / 2,
  },
  linkButton: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
  },
  linkButtonText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: palette.primary,
    fontWeight: '600',
  },
  leaderboardList: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: tokens.radii.md,
    backgroundColor: `${palette.text}03`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.text}10`,
  },
  leaderboardInfo: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  familyName: {
    ...typography.callout,
    fontFamily: 'SF Arabic',
    color: palette.text,
    fontWeight: '600',
  },
  leaderboardHint: {
    ...typography.caption1,
    fontFamily: 'SF Arabic',
    color: `${palette.text}70`,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.callout,
    fontFamily: 'SF Arabic',
    color: palette.text,
  },
  errorCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: palette.text,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: tokens.radii.md,
    backgroundColor: palette.primary,
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  retryButtonText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    fontWeight: '600',
    color: tokens.colors.surface,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  emptyChartText: {
    ...typography.callout,
    fontFamily: 'SF Arabic',
    color: `${palette.text}66`,
    textAlign: 'center',
  },
  emptyStateText: {
    ...typography.callout,
    fontFamily: 'SF Arabic',
    color: `${palette.text}66`,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
});
