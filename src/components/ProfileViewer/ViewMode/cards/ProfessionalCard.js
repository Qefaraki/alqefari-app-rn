/**
 * ProfessionalCard Component - LinkedIn-Inspired Professional Profile
 *
 * Modern professional card with icon headers and clear sections
 * - 🎓 Education section (icon + header)
 * - 🏆 Achievements section (icon + header + bullet points)
 * - Subtle divider between sections
 * - Better typography hierarchy
 * - Spacious layout with Desert Ochre accents
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import InfoCard from '../components/InfoCard';
import tokens from '../../../ui/tokens';

const { colors, spacing, typography } = tokens;

const ProfessionalCard = React.memo(
  ({ person }) => {
    const hasEducation = Boolean(person?.education);
    const hasAchievements = Array.isArray(person?.achievements) && person.achievements.length > 0;

    // Guard: if no professional data, don't render
    if (!hasEducation && !hasAchievements) {
      return null;
    }

    // Memoize styles
    const styles = useMemo(
      () =>
        StyleSheet.create({
          container: {
            gap: spacing.md, // 16px between education and achievements
          },
          sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs, // 8px between icon and text
            marginBottom: spacing.sm, // 12px below header
          },
          sectionIcon: {
            width: 20,
            height: 20,
          },
          sectionTitle: {
            fontSize: 15, // iOS subheadline
            fontWeight: '700',
            color: colors.najdi.text,
            fontFamily: 'SF Arabic',
          },
          educationContent: {
            gap: spacing.xxs, // 4px between lines
          },
          educationDegree: {
            fontSize: 17, // iOS body (larger)
            fontWeight: '600',
            color: colors.najdi.text,
            lineHeight: 22,
            fontFamily: 'SF Arabic',
          },
          educationInstitution: {
            fontSize: 15, // iOS subheadline
            fontWeight: '400',
            color: colors.najdi.textMuted,
            lineHeight: 20,
            fontFamily: 'SF Arabic',
          },
          divider: {
            height: 1,
            backgroundColor: `${colors.najdi.textMuted}12`, // Very subtle
            width: '60%',
            alignSelf: 'center',
            marginVertical: spacing.sm, // 12px top/bottom
          },
          achievementsList: {
            gap: spacing.xs, // 8px between achievements
          },
          achievementRow: {
            flexDirection: 'row',
            gap: spacing.xs, // 8px between bullet and text
            alignItems: 'flex-start',
          },
          bullet: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.najdi.secondary, // Desert Ochre
            marginTop: 7, // Optical alignment with text baseline
          },
          achievementText: {
            flex: 1,
            fontSize: 15, // iOS subheadline
            fontWeight: '400',
            color: colors.najdi.text,
            lineHeight: 22,
            fontFamily: 'SF Arabic',
          },
        }),
      []
    );

    return (
      <InfoCard title="السيرة المهنية">
        <View style={styles.container}>
          {/* Education Section */}
          {hasEducation && (
            <View>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="school-outline"
                  size={18}
                  color={colors.najdi.secondary}
                  style={styles.sectionIcon}
                  accessible={false}
                />
                <Text style={styles.sectionTitle}>التعليم</Text>
              </View>
              <View style={styles.educationContent}>
                <Text style={styles.educationDegree}>
                  {person.education}
                </Text>
              </View>
            </View>
          )}

          {/* Divider between sections */}
          {hasEducation && hasAchievements && (
            <View style={styles.divider} />
          )}

          {/* Achievements Section */}
          {hasAchievements && (
            <View>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name="trophy-outline"
                  size={18}
                  color={colors.najdi.secondary}
                  style={styles.sectionIcon}
                  accessible={false}
                />
                <Text style={styles.sectionTitle}>الإنجازات</Text>
              </View>
              <View style={styles.achievementsList}>
                {person.achievements.map((achievement, index) => (
                  <View key={index} style={styles.achievementRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.achievementText}>{achievement}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </InfoCard>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if education or achievements changed
    const prevAchievements = prevProps.person?.achievements;
    const nextAchievements = nextProps.person?.achievements;

    // Compare achievements array by length and content
    const achievementsEqual =
      prevAchievements?.length === nextAchievements?.length &&
      prevAchievements?.every((item, index) => item === nextAchievements?.[index]);

    return (
      prevProps.person?.education === nextProps.person?.education &&
      achievementsEqual
    );
  }
);

ProfessionalCard.displayName = 'ProfessionalCard';

export default ProfessionalCard;
