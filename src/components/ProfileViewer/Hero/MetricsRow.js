import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import GlassMetricPill from '../../GlassMetricPill';

const GUTTER = 10;
const HORIZONTAL_PADDING = 40; // Hero padding left+right
const MAX_COLUMNS = 3;

const MetricsRow = ({ metrics }) => {
  const {
    generationLabel,
    childrenCount,
    siblingsCount,
    descendantsCount,
    occupation,
    residence,
    onScrollToFamily,
  } = metrics;

  const items = useMemo(() => {
    const list = [];
    if (generationLabel) {
      list.push({ label: 'الجيل', value: generationLabel, onPress: onScrollToFamily });
    }
    if (childrenCount > 0) {
      list.push({ label: 'الأبناء', value: childrenCount, onPress: onScrollToFamily });
    }
    if (siblingsCount > 0) {
      list.push({ label: 'الإخوة', value: siblingsCount, onPress: onScrollToFamily });
    }
    if (descendantsCount > 0) {
      list.push({ label: 'الذرية', value: descendantsCount, onPress: onScrollToFamily });
    }
    if (occupation) {
      list.push({ label: 'المهنة', value: occupation });
    }
    if (residence) {
      list.push({ label: 'المدينة', value: residence });
    }
    return list;
  }, [childrenCount, descendantsCount, generationLabel, occupation, onScrollToFamily, residence, siblingsCount]);

  if (items.length === 0) return null;

  const [measuredWidth, setMeasuredWidth] = useState(null);

  const handleLayout = useCallback((event) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  }, []);

  const screenWidth = Dimensions.get('window').width;
  const fallbackWidth = Math.max(screenWidth - HORIZONTAL_PADDING, 0);
  const availableWidth = Math.max(measuredWidth ?? fallbackWidth, 0);
  const columns = items.length <= 2 ? items.length || 1 : MAX_COLUMNS;

  const rows = useMemo(() => {
    if (availableWidth === 0) return [];

    const effectiveColumns = columns;
    const enriched = items.map((item) => {
      const valueText = item.value != null ? String(item.value) : '';
      const combinedLength = valueText.length + ((item.label || '').length / 2);

      if (combinedLength > 18 || ['المهنة', 'المدينة'].includes(item.label) && valueText.length > 12) {
        return { ...item, span: Math.min(effectiveColumns, 3) };
      }
      if (combinedLength > 12 || ['المهنة', 'المدينة'].includes(item.label) && valueText.length > 8) {
        return { ...item, span: Math.min(effectiveColumns, 2) };
      }

      return { ...item, span: 1 };
    }).sort((a, b) => {
      const priority = (entry) => {
        if (entry.label === 'الجيل') return 0;
        if (entry.label === 'الأبناء') return 1;
        if (entry.label === 'الإخوة') return 2;
        if (entry.label === 'الذرية') return 3;
        if (entry.label === 'المهنة') return 4;
        if (entry.label === 'المدينة') return 5;
        return 6;
      };
      return priority(a) - priority(b);
    });

    if (enriched.length === 1) {
      return [[{ ...enriched[0], span: effectiveColumns }]];
    }

    const packed = [];
    let currentRow = [];
    let rowSpan = 0;

    enriched.forEach((item) => {
      const span = Math.max(1, Math.min(item.span || 1, effectiveColumns));

      if (rowSpan + span > effectiveColumns && currentRow.length > 0) {
        const remaining = effectiveColumns - rowSpan;
        if (remaining > 0) {
          const lastIndex = currentRow.length - 1;
          currentRow[lastIndex] = {
            ...currentRow[lastIndex],
            span: Math.min(effectiveColumns, (currentRow[lastIndex].span || 1) + remaining),
          };
        }
        packed.push(currentRow);
        currentRow = [];
        rowSpan = 0;
      }

      currentRow.push({ ...item, span });
      rowSpan += span;

      if (rowSpan === effectiveColumns) {
        packed.push(currentRow);
        currentRow = [];
        rowSpan = 0;
      }
    });

    if (currentRow.length > 0) {
      const remaining = effectiveColumns - rowSpan;
      if (remaining > 0) {
        const lastIndex = currentRow.length - 1;
        currentRow[lastIndex] = {
          ...currentRow[lastIndex],
          span: Math.min(effectiveColumns, (currentRow[lastIndex].span || 1) + remaining),
        };
      }
      packed.push(currentRow);
    }

    return packed;
  }, [availableWidth, columns, items]);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {rows.map((row, rowIndex) => {
        const rowGutters = GUTTER * Math.max(0, row.length - 1);
        const rowAvailable = Math.max(0, availableWidth - rowGutters);
        const computeWeight = (entry) => {
          const span = Math.max(1, entry.span || 1);
          const valueText = entry.value != null ? String(entry.value) : '';
          const labelLength = entry.label ? entry.label.length : 0;
          const valueLength = valueText.length;
          const textLoad = Math.max(0, valueLength + labelLength * 0.6 - 4);
          return span * (1 + textLoad * 0.12);
        };
        const weightTotal = row.reduce((sum, item) => sum + computeWeight(item), 0);

        return (
          <View key={`metrics-row-${rowIndex}`} style={[styles.row, rowIndex > 0 && styles.rowGap]}>
            {row.map((item, index) => {
              const span = Math.max(1, item.span || 1);
              const weight = computeWeight(item);
              const proportionalWidth = weightTotal > 0 ? (rowAvailable * weight) / weightTotal : 0;
              const width = Math.max(96, Math.round(proportionalWidth));
              return (
                <GlassMetricPill
                  key={`${item.label}-${item.value}-${rowIndex}-${index}`}
                  value={item.value}
                  label={item.label}
                  style={[
                    styles.pill,
                    { width },
                    index < row.length - 1 && { marginRight: GUTTER },
                  ]}
                  onPress={item.onPress}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  rowGap: {
    marginTop: 8,
  },
  pill: {
    minWidth: 0,
  },
});

export default MetricsRow;
