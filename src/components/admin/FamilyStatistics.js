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
    {[...Array(5)].map((_, i) => (
      <View key={i} style={styles.skeletonCard}>
        <SkeletonLoader width="60%" height={20} style={{ marginBottom: 12 }} />
        <SkeletonLoader width="100%" height={200} />
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

const MetricBadge = ({ tone = 'primary', icon, label, value, percent }) => {
  const toneColor =
    tone === 'secondary'
      ? palette.secondary
      : tone === 'neutral'
      ? `${palette.text}`
      : palette.primary;

  return (
    <View style={styles.metricBadge}>
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
  if (!stats?.generations || !Array.isArray(stats.generations) || stats.generations.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>رحلة الأجيال</Text>
        <View style={styles.emptyChartContainer}>
          <Ionicons name="bar-chart-outline" size={48} color={`${palette.text}66`} />
          <Text style={styles.emptyChartText}>لا توجد بيانات الأجيال</Text>
        </View>
      </View>
    );
  }

  const { generations } = stats;
  const maxCount = Math.max(...generations.map((g) => g.count));
  const largestGen = generations.reduce((max, g) => (g.count > max.count ? g : max), generations[0]);

  // Arabic ordinals
  const getArabicOrdinal = (num) => {
    const ordinals = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];
    return ordinals[num - 1] || num.toString();
  };

  // Desert Ochre gradient (light to dark)
  const getDesertGradient = (index) => {
    const shades = [
      '#F4DCC8', '#ECDCC3', '#E4C5A8', '#DCAD8D',
      '#D58C4A', '#C97A38', '#BD6826', '#B15614',
    ];
    return shades[index] || shades[shades.length - 1];
  };

  return (
    <View
      style={styles.section}
      accessibilityLabel={`توزيع ${generations.length} أجيال. الجيل ${getArabicOrdinal(largestGen.generation)} هو الأكبر بـ ${largestGen.count.toLocaleString('ar-SA')} فرد`}
    >
      <Text style={styles.sectionHeader}>رحلة الأجيال</Text>

      <RTLVictoryBar
        data={generations.map((g, idx) => ({
          x: `الجيل ${getArabicOrdinal(g.generation)}`,
          y: g.count,
          label: g.count.toString(),
          fill: getDesertGradient(idx),
        }))}
        horizontal
        height={400}
        barProps={{
          cornerRadius: 6, // Enhanced corner radius
          style: {
            data: {
              fill: ({ datum }) => datum.fill,
              stroke: `${palette.text}14`, // Subtle border
              strokeWidth: 1,
            },
            labels: {
              fontSize: 14, // Increased from 13
              fontFamily: 'SFArabic-Semibold',
              fill: palette.text,
              padding: 8,
            },
          },
          animate: { duration: 600, easing: 'cubicOut' }, // Smoother animation
        }}
      />

      {/* Insight Card */}
      <View style={styles.insightCard}>
        <Ionicons name="bulb-outline" size={20} color={palette.secondary} />
        <Text style={styles.insightText}>
          الجيل {getArabicOrdinal(largestGen.generation)} هو الأكبر بـ {largestGen.count.toLocaleString('ar-SA')} فرد - نمو مذهل!
        </Text>
      </View>
    </View>
  );
};

// Names Section: Top male/female names
const NamesSection = ({ stats, expanded, onToggle }) => {
  if (!stats?.top_male_names || !stats?.top_female_names ||
      !Array.isArray(stats.top_male_names) || !Array.isArray(stats.top_female_names)) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>الأسماء الأكثر شيوعاً</Text>
        <View style={styles.emptyChartContainer}>
          <Ionicons name="stats-chart-outline" size={48} color={`${palette.text}66`} />
          <Text style={styles.emptyChartText}>لا توجد بيانات الأسماء</Text>
        </View>
      </View>
    );
  }

  const { top_male_names, top_female_names } = stats;

  const renderNamesList = (names, gender, limit) => {
    const displayNames = expanded ? names : names.slice(0, limit);
    const maxCount = names[0]?.count || 1;

    return displayNames.map((item, idx) => (
      <View key={item.name} style={styles.nameRow}>
        <Text style={styles.nameRank}>{idx + 1}.</Text>
        <Text style={styles.nameName}>{item.name}</Text>
        <View style={styles.nameBarContainer}>
          <View
            style={[
              styles.nameBar,
              {
                width: `${(item.count / maxCount) * 100}%`,
                backgroundColor: gender === 'male' ? palette.primary : palette.secondary,
              },
            ]}
          />
          <Text style={styles.nameCount}>{item.count}</Text>
        </View>
      </View>
    ));
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>الأسماء الأكثر شيوعاً</Text>

      {/* Male Names */}
      <Text style={styles.subsectionTitle}>أسماء الذكور</Text>
      {renderNamesList(top_male_names, 'male', 5)}

      {/* Female Names */}
      <Text style={[styles.subsectionTitle, { marginTop: 24 }]}>أسماء الإناث</Text>
      {renderNamesList(top_female_names, 'female', 5)}

      {/* Expand Button */}
      {!expanded && (top_male_names.length > 5 || top_female_names.length > 5) && (
        <TouchableOpacity style={styles.expandButton} onPress={onToggle}>
          <Text style={styles.expandText}>عرض القائمة الكاملة</Text>
          <Ionicons name="chevron-down" size={16} color={palette.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Munasib Section: Leaderboard style
const MunasibSection = ({ stats, expanded, onToggle }) => {
  if (!stats?.top_munasib_families || !stats?.munasib_totals ||
      !Array.isArray(stats.top_munasib_families)) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>أنساب القفاري</Text>
        <View style={styles.emptyChartContainer}>
          <Ionicons name="people-outline" size={48} color={`${palette.text}66`} />
          <Text style={styles.emptyChartText}>لا توجد بيانات الأنساب</Text>
        </View>
      </View>
    );
  }

  const { top_munasib_families, munasib_totals } = stats;
  const displayFamilies = expanded ? top_munasib_families : top_munasib_families.slice(0, 5);
  const maxCount = top_munasib_families[0]?.count || 1;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>أنساب القفاري</Text>
      <Text style={styles.subtitle}>
        {munasib_totals.total_munasib} زواجاً مع عائلات أخرى
      </Text>

      {displayFamilies.map((family, idx) => (
        <View key={family.family} style={styles.leaderboardRow}>
          <Text style={styles.rank}>
            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
          </Text>
          <Text style={styles.familyName}>عائلة {family.family}</Text>
          <View style={styles.barContainer}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${(family.count / maxCount) * 100}%`,
                  backgroundColor: palette.secondary,
                },
              ]}
            />
            <Text style={styles.count}>{family.count}</Text>
          </View>
        </View>
      ))}

      {!expanded && top_munasib_families.length > 5 && (
        <TouchableOpacity style={styles.expandButton} onPress={onToggle}>
          <Text style={styles.expandText}>عرض جميع العائلات</Text>
          <Ionicons name="chevron-down" size={16} color={palette.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Section Divider with Sadu Pattern
const SectionDivider = () => (
  <View style={styles.dividerContainer}>
    <View style={styles.dividerLine} />
  </View>
);

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

  return (
    <View ref={ref}>
      {isVisible ? children : <ChartSkeleton />}
    </View>
  );
};

// Chart Skeleton for lazy loading
const ChartSkeleton = () => (
  <View style={styles.section}>
    <SkeletonLoader width="40%" height={22} style={{ marginBottom: 16 }} />
    <SkeletonLoader width="100%" height={200} />
  </View>
);

// Loading Section for extended stats
const LoadingSection = ({ title }) => (
  <View style={styles.section}>
    <Text style={styles.sectionHeader}>{title}</Text>
    <View style={styles.loadingCard}>
      <Ionicons name="time-outline" size={32} color={palette.secondary} />
      <Text style={styles.loadingText}>جارٍ التحميل...</Text>
    </View>
  </View>
);

// Error Section for failed extended stats
const ErrorSection = ({ title, message, onRetry, isRetrying = false }) => (
  <View style={styles.section}>
    <Text style={styles.sectionHeader}>{title}</Text>
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
    paddingBottom: 32,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Skeleton
  skeletonContainer: {
    padding: 16,
  },
  skeletonCard: {
    marginBottom: 24,
  },

  // Intro Surface (exact copy from Munasib Manager)
  introSurface: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
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
    paddingTop: spacing.md + 24,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  introTitle: {
    ...typography.title3,
    fontFamily: 'SF Arabic',
    color: palette.text,
    fontWeight: '700',
  },
  introSubtitle: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: `${palette.text}99`,
    lineHeight: typography.subheadline.lineHeight,
  },

  // Section
  section: {
    marginHorizontal: 16,
    marginBottom: 40, // Increased from 32px
    paddingTop: 8, // Added for spacing after divider
  },
  sectionHeader: {
    ...typography.title2,
    fontFamily: 'SF Arabic',
    color: palette.text,
    fontWeight: '700',
    marginBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: palette.secondary,
    paddingBottom: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
  },
  subsectionTitle: {
    ...typography.headline,
    fontFamily: 'SF Arabic',
    color: palette.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: `${palette.text}99`,
    marginBottom: spacing.md,
  },

  // Hero Section
  heroNumberContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroNumber: {
    fontSize: 56,
    fontFamily: 'SF Arabic',
    fontWeight: '700',
    color: palette.text,
  },
  heroLabel: {
    ...typography.headline,
    fontFamily: 'SF Arabic',
    color: `${palette.text}99`,
    marginTop: spacing.xs,
  },
  genderBreakdown: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  genderText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: `${palette.text}80`,
    textAlign: 'center',
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },

  // Insight Card
  insightCard: {
    flexDirection: 'row',
    backgroundColor: `${palette.secondary}10`,
    borderRadius: tokens.radii.md,
    borderWidth: 1.5,
    borderColor: `${palette.secondary}60`,
    padding: 14,
    marginTop: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: palette.secondary,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
  },
  insightText: {
    flex: 1,
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: palette.text,
    marginLeft: spacing.sm,
  },

  // Names Section
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  nameRank: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    fontWeight: '600',
    color: `${palette.text}66`,
    width: 30,
  },
  nameName: {
    ...typography.callout,
    fontFamily: 'SF Arabic',
    color: palette.text,
    flex: 1,
  },
  nameBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
  },
  nameBar: {
    height: 24,
    borderRadius: tokens.radii.sm / 2,
    marginRight: spacing.xs,
  },
  nameCount: {
    ...typography.footnote,
    fontFamily: 'SF Arabic',
    fontWeight: '600',
    color: palette.text,
  },

  // Munasib Leaderboard
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: `${palette.text}10`,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
  },
  rank: {
    ...typography.headline,
    width: 40,
    textAlign: 'center',
  },
  familyName: {
    ...typography.callout,
    fontFamily: 'SF Arabic',
    color: palette.text,
    flex: 1,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  barFill: {
    height: 28,
    borderRadius: tokens.radii.sm / 2,
    marginRight: spacing.xs,
  },
  count: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    fontWeight: '600',
    color: palette.text,
  },

  // Expand Button
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  expandText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    fontWeight: '600',
    color: palette.primary,
    marginRight: spacing.xs,
  },

  // Section Divider
  dividerContainer: {
    marginHorizontal: 16,
    marginVertical: 24,
    alignItems: 'center',
  },
  dividerLine: {
    width: '100%',
    height: 1,
    backgroundColor: `${palette.text}14`,
  },

  // Loading/Error Cards
  loadingCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.callout,
    fontFamily: 'SF Arabic',
    color: palette.text,
    marginTop: spacing.sm,
  },
  errorCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    padding: spacing.xxl,
    alignItems: 'center',
  },
  errorText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    color: palette.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: palette.primary,
    borderRadius: tokens.radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  retryButtonDisabled: {
    opacity: 0.5,
  },
  retryButtonText: {
    ...typography.subheadline,
    fontFamily: 'SF Arabic',
    fontWeight: '600',
    color: palette.background,
  },
  emptyChartContainer: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${palette.text}10`,
    padding: spacing.xxl * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
  },
  emptyChartText: {
    ...typography.callout,
    fontFamily: 'SF Arabic',
    color: `${palette.text}66`,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyStateText: {
    ...typography.callout,
    fontFamily: 'SF Arabic',
    color: `${palette.text}66`,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
