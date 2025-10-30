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

const formatDateTime = (isoString) => {
  if (!isoString) return null;
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return null;

  try {
    return new Intl.DateTimeFormat('ar-SA', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed);
  } catch (error) {
    return parsed.toLocaleString('ar-SA');
  }
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
      <Text style={styles.introTitle}>إحصائيات العائلة</Text>
      <Text style={styles.introSubtitle}>
        تعرّف على أرقام ومعلومات مفصلة عن العائلة عبر الأجيال
      </Text>
    </View>
  </View>
);

// Hero Section: Total members + Gender donut chart
const HeroSection = ({ stats }) => {
  const gender = stats?.gender;

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
  const generationsCount = stats?.generations?.length ?? 0;
  const lastUpdated = formatDateTime(stats?.calculated_at);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardEyebrow}>إجمالي أفراد العائلة</Text>
          <Text style={styles.heroNumber}>{formatNumber(totalCount)}</Text>
          <Text style={styles.cardSubtitle}>توزيع الأعضاء حسب الجنس عبر الأجيال</Text>
        </View>
        {lastUpdated && (
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={16} color={palette.primary} />
            <Text style={styles.badgeText}>{lastUpdated}</Text>
          </View>
        )}
      </View>

      <View style={styles.heroContent}>
        <View style={styles.heroMeta}>
          <MetricBadge
            tone="primary"
            icon="man-outline"
            label="ذكور"
            value={formatNumber(maleCount)}
            percent={formatPercent(maleCount, totalCount)}
          />
          <MetricBadge
            tone="secondary"
            icon="woman-outline"
            label="إناث"
            value={formatNumber(femaleCount)}
            percent={formatPercent(femaleCount, totalCount)}
          />
          {generationsCount > 0 && (
            <View style={styles.heroGenerations}>
              <Ionicons name="layers-outline" size={18} color={palette.primary} />
              <Text style={styles.heroGenerationsText}>
                يغطي {generationsCount} أجيال متصلة
              </Text>
            </View>
          )}
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

const MetricBadge = ({ tone = 'primary', icon, label, value, percent, style }) => {
  const toneColor =
    tone === 'secondary'
      ? palette.secondary
      : tone === 'neutral'
      ? `${palette.text}`
      : palette.primary;

  return (
    <View style={[styles.metricBadge, style]}>
      <View style={[styles.metricBadgeIcon, { backgroundColor: `${toneColor}16` }]}>
        <Ionicons name={icon} size={18} color={toneColor} />
      </View>
      <View style={styles.metricBadgeTextGroup}>
        <Text style={styles.metricBadgeLabel}>{label}</Text>
        <Text style={styles.metricBadgeValue}>{value}</Text>
      </View>
      {percent && <Text style={[styles.metricBadgePercent, { color: toneColor }]}>{percent}</Text>}
    </View>
  );
};

const OperationalSnapshot = ({ stats }) => {
  const vital = stats?.vital_status;
  const quality = stats?.data_quality;
  const totalProfiles = quality?.total_profiles ?? stats?.gender?.total ?? 0;

  const tiles = useMemo(() => {
    const items = [];
    if (typeof vital?.living === 'number') {
      items.push({
        key: 'living',
        label: 'أعضاء على قيد الحياة',
        value: formatNumber(vital.living),
        caption: totalProfiles ? formatPercent(vital.living, totalProfiles) : null,
        icon: 'heart-outline',
        iconColor: palette.primary,
        tint: `${palette.primary}12`,
      });
    }
    if (typeof vital?.deceased === 'number') {
      items.push({
        key: 'deceased',
        label: 'أعضاء متوفون',
        value: formatNumber(vital.deceased),
        caption: totalProfiles ? formatPercent(vital.deceased, totalProfiles) : null,
        icon: 'flower-outline',
        iconColor: palette.secondary,
        tint: `${palette.secondary}12`,
      });
    }
    if (quality?.total_profiles && typeof quality.with_photos === 'number') {
      items.push({
        key: 'photos',
        label: 'ملفات مع صور',
        value: formatNumber(quality.with_photos),
        caption: formatPercent(quality.with_photos, quality.total_profiles),
        icon: 'image-outline',
        iconColor: palette.primary,
        tint: `${palette.primary}0F`,
      });
    }
    if (quality?.total_profiles && typeof quality.with_birthdates === 'number') {
      items.push({
        key: 'birthdates',
        label: 'تواريخ ميلاد مسجلة',
        value: formatNumber(quality.with_birthdates),
        caption: formatPercent(quality.with_birthdates, quality.total_profiles),
        icon: 'calendar-outline',
        iconColor: palette.secondary,
        tint: `${palette.secondary}0F`,
      });
    }
    return items;
  }, [quality, totalProfiles, vital]);

  if (!tiles.length && !(quality?.total_profiles > 0)) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardEyebrow}>نظرة تشغيلية</Text>
          <Text style={styles.cardSubtitle}>حالة الأعضاء وجودة البيانات الحالية</Text>
        </View>
      </View>

      {tiles.length > 0 && (
        <View style={styles.metricsGrid}>
          {tiles.map((tile) => (
            <View key={tile.key} style={styles.metricTile}>
              <View style={[styles.metricTileIcon, { backgroundColor: tile.tint }]}>
                <Ionicons name={tile.icon} size={18} color={tile.iconColor} />
              </View>
              <Text style={styles.metricTileLabel}>{tile.label}</Text>
              <Text style={styles.metricTileValue}>{tile.value}</Text>
              {tile.caption && <Text style={styles.metricTileCaption}>{tile.caption}</Text>}
            </View>
          ))}
        </View>
      )}

      {quality?.total_profiles ? (
        <View style={styles.qualitySection}>
          <View style={styles.qualityRow}>
            <Text style={styles.qualityLabel}>تغطية الصور</Text>
            <Text style={styles.qualityValue}>
              {formatNumber(quality.with_photos)} • {formatPercent(quality.with_photos, quality.total_profiles)}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    100,
                    Math.round((quality.with_photos / quality.total_profiles) * 100)
                  )}%`,
                  backgroundColor: palette.primary,
                },
              ]}
            />
          </View>

          <View style={[styles.qualityRow, { marginTop: spacing.md }]}>
            <Text style={styles.qualityLabel}>تواريخ الميلاد الموثقة</Text>
            <Text style={styles.qualityValue}>
              {formatNumber(quality.with_birthdates)} • {formatPercent(quality.with_birthdates, quality.total_profiles)}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(
                    100,
                    Math.round((quality.with_birthdates / quality.total_profiles) * 100)
                  )}%`,
                  backgroundColor: palette.secondary,
                },
              ]}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
};

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
  const firstGen = generations[0];
  const latestGen = generations[generations.length - 1];

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

      <View style={styles.calloutRow}>
        <Ionicons name="sparkles-outline" size={18} color={palette.secondary} />
        <Text style={styles.calloutText}>
          الجيل {getArabicOrdinal(largestGen.generation)} هو الأكبر بـ {formatNumber(largestGen.count)} فرد
        </Text>
      </View>

      <View style={styles.statsStrip}>
        <View style={styles.statsStripItem}>
          <Text style={styles.statsStripLabel}>أقدم جيل</Text>
          <Text style={styles.statsStripValue}>
            الجيل {getArabicOrdinal(firstGen.generation)}
          </Text>
        </View>
        <View style={styles.statsStripDivider} />
        <View style={styles.statsStripItem}>
          <Text style={styles.statsStripLabel}>أحدث جيل</Text>
          <Text style={styles.statsStripValue}>
            الجيل {getArabicOrdinal(latestGen.generation)}
          </Text>
        </View>
      </View>
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
        icon: 'man-outline',
        color: palette.primary,
        data: Array.isArray(topMale) ? topMale : [],
      },
      {
        key: 'female',
        label: 'أسماء الإناث',
        icon: 'woman-outline',
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
              <Ionicons
                name={segment.icon}
                size={18}
                color={isActive ? palette.background : `${palette.text}99`}
              />
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
                  {formatNumber(item.count)} تكرارات
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
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setShowAll((prev) => !prev)}
        >
          <Text style={styles.secondaryButtonText}>
            {showAll ? 'عرض الأقل' : 'عرض القائمة الكاملة'}
          </Text>
          <Ionicons
            name={showAll ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={palette.primary}
          />
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
  const maxCount = families[0]?.count || 1;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View>
          <Text style={styles.cardEyebrow}>أنساب القفاري</Text>
          <Text style={styles.cardSubtitle}>مؤشرات الزواج مع العائلات الأخرى</Text>
        </View>
      </View>

      <View style={styles.metricBadgeRow}>
        <MetricBadge
          tone="primary"
          icon="git-network-outline"
          label="إجمالي الزيجات"
          value={formatNumber(marriageStats.total_marriages ?? totals.total_munasib)}
          percent={
            marriageStats.total_marriages
              ? formatPercent(marriageStats.current_marriages, marriageStats.total_marriages)
              : undefined
          }
          style={styles.metricBadgeBlock}
        />
        <MetricBadge
          tone="secondary"
          icon="man-outline"
          label="زيجات الذكور"
          value={formatNumber(totals.male_munasib)}
          style={[styles.metricBadgeBlock, styles.metricBadgeBlockSpacing]}
        />
      </View>
      <View style={[styles.metricBadgeRow, styles.metricBadgeRowSpacing]}>
        <MetricBadge
          tone="neutral"
          icon="woman-outline"
          label="زيجات الإناث"
          value={formatNumber(totals.female_munasib)}
          style={styles.metricBadgeBlock}
        />
        <MetricBadge
          tone="neutral"
          icon="repeat-outline"
          label="زيجات قائمة"
          value={formatNumber(marriageStats.current_marriages)}
          percent={
            marriageStats.total_marriages
              ? formatPercent(marriageStats.current_marriages, marriageStats.total_marriages)
              : undefined
          }
          style={[styles.metricBadgeBlock, styles.metricBadgeBlockSpacing]}
        />
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
              <Text style={styles.leaderboardHint}>
                {formatNumber(family.count)} شراكات موثقة
              </Text>
            </View>
            <View style={styles.leaderboardProgress}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(14, Math.round((family.count / maxCount) * 100))}%`,
                      backgroundColor: palette.secondary,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ))}
      </View>

      {families.length > displayFamilies.length && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setShowAll((prev) => !prev)}
        >
          <Text style={styles.secondaryButtonText}>
            {showAll ? 'عرض الأقل' : 'عرض جميع العائلات'}
          </Text>
          <Ionicons
            name={showAll ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={palette.primary}
          />
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
