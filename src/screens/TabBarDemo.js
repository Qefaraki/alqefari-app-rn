import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import TabBar from '../components/ui/TabBar';
import tokens from '../components/ui/tokens';

/**
 * Demo screen to compare TabBar variants with and without divider
 * Used to determine default divider behavior
 */
const TabBarDemo = () => {
  const [activeTab1, setActiveTab1] = useState('pending');
  const [activeTab2, setActiveTab2] = useState('all');
  const [activeTab3, setActiveTab3] = useState('users');

  const suggestionTabs = [
    { id: 'pending', label: 'قيد المراجعة' },
    { id: 'approved', label: 'مقبولة' },
    { id: 'rejected', label: 'مرفوضة' },
  ];

  const filterTabs = [
    { id: 'all', label: 'الكل' },
    { id: 'admin', label: 'مدير رئيسي' },
    { id: 'moderator', label: 'مشرف' },
  ];

  const userTabs = [
    { id: 'users', label: 'المستخدمون' },
    { id: 'blocked', label: 'المحظورون' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>TabBar Variant Comparison</Text>
          <Text style={styles.subtitle}>
            Pinterest-Inspired Tab Component
          </Text>
        </View>

        {/* Variant 1: WITH DIVIDER */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>✓ WITH Divider (Default Option 1)</Text>
            <Text style={styles.sectionSubtitle}>
              Hairline divider below tabs separates from content
            </Text>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Suggestion Statuses (3 tabs)</Text>
            <TabBar
              tabs={suggestionTabs}
              activeTab={activeTab1}
              onTabChange={setActiveTab1}
              showDivider={true}
            />
            <View style={styles.contentPreview}>
              <Text style={styles.contentText}>
                Content below tabs appears here
              </Text>
            </View>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Role Filter (3 tabs)</Text>
            <TabBar
              tabs={filterTabs}
              activeTab={activeTab2}
              onTabChange={setActiveTab2}
              showDivider={true}
            />
            <View style={styles.contentPreview}>
              <Text style={styles.contentText}>
                Filtered content preview
              </Text>
            </View>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Binary Toggle (2 tabs)</Text>
            <TabBar
              tabs={userTabs}
              activeTab={activeTab3}
              onTabChange={setActiveTab3}
              showDivider={true}
            />
            <View style={styles.contentPreview}>
              <Text style={styles.contentText}>
                Binary state content
              </Text>
            </View>
          </View>

          <View style={styles.pros}>
            <Text style={styles.prosTitle}>✓ Pros:</Text>
            <Text style={styles.prosItem}>
              • Clear visual separation from content
            </Text>
            <Text style={styles.prosItem}>
              • Helps with tab bar hierarchy
            </Text>
            <Text style={styles.prosItem}>
              • Similar to iOS Mail, Apple News
            </Text>
          </View>

          <View style={styles.cons}>
            <Text style={styles.consTitle}>✗ Cons:</Text>
            <Text style={styles.consItem}>
              • Adds visual clutter in minimal design
            </Text>
            <Text style={styles.consItem}>
              • Less emphasis on generous whitespace
            </Text>
          </View>
        </View>

        {/* Variant 2: WITHOUT DIVIDER */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>✗ WITHOUT Divider (Default Option 2)</Text>
            <Text style={styles.sectionSubtitle}>
              Clean minimal look with no separator
            </Text>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Suggestion Statuses (3 tabs)</Text>
            <TabBar
              tabs={suggestionTabs}
              activeTab={activeTab1}
              onTabChange={setActiveTab1}
              showDivider={false}
            />
            <View style={styles.contentPreview}>
              <Text style={styles.contentText}>
                Content below tabs appears here
              </Text>
            </View>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Role Filter (3 tabs)</Text>
            <TabBar
              tabs={filterTabs}
              activeTab={activeTab2}
              onTabChange={setActiveTab2}
              showDivider={false}
            />
            <View style={styles.contentPreview}>
              <Text style={styles.contentText}>
                Filtered content preview
              </Text>
            </View>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Binary Toggle (2 tabs)</Text>
            <TabBar
              tabs={userTabs}
              activeTab={activeTab3}
              onTabChange={setActiveTab3}
              showDivider={false}
            />
            <View style={styles.contentPreview}>
              <Text style={styles.contentText}>
                Binary state content
              </Text>
            </View>
          </View>

          <View style={styles.pros}>
            <Text style={styles.prosTitle}>✓ Pros:</Text>
            <Text style={styles.prosItem}>
              • Minimal, clean aesthetic (Najdi Sadu aligned)
            </Text>
            <Text style={styles.prosItem}>
              • Generous whitespace emphasis
            </Text>
            <Text style={styles.prosItem}>
              • Modern (Pinterest, Medium, Linear style)
            </Text>
          </View>

          <View style={styles.cons}>
            <Text style={styles.consTitle}>✗ Cons:</Text>
            <Text style={styles.consItem}>
              • Less visual separation from content
            </Text>
            <Text style={styles.consItem}>
              • May need explicit separator in dense layouts
            </Text>
          </View>
        </View>

        {/* Decision Section */}
        <View style={styles.section}>
          <View style={styles.decisionBox}>
            <Text style={styles.decisionTitle}>Recommendation</Text>
            <Text style={styles.decisionText}>
              Based on Najdi Sadu's emphasis on minimal design and generous whitespace,
              <Text style={styles.bold}> WITHOUT divider is recommended as default</Text>.
            </Text>
            <Text style={styles.decisionText}>
              However, specific screens can opt-in with `showDivider={'true'}` if they
              need more visual separation.
            </Text>
          </View>
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.najdi.background,
  },
  header: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.najdi.text,
    borderBottomOpacity: 0.1,
  },
  title: {
    fontSize: tokens.typography.title2.fontSize,
    fontWeight: tokens.typography.title2.fontWeight,
    color: tokens.colors.najdi.text,
    marginBottom: tokens.spacing.xs,
  },
  subtitle: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.textMuted,
  },
  section: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.najdi.text,
    borderBottomOpacity: 0.05,
  },
  sectionHeader: {
    marginBottom: tokens.spacing.lg,
  },
  sectionTitle: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight,
    color: tokens.colors.najdi.text,
    marginBottom: tokens.spacing.xs,
  },
  sectionSubtitle: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.textMuted,
  },
  demoContainer: {
    marginBottom: tokens.spacing.xl,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.najdi.text,
    borderOpacity: 0.1,
  },
  demoLabel: {
    fontSize: tokens.typography.footnote.fontSize,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.sm,
    textTransform: 'uppercase',
  },
  contentPreview: {
    marginTop: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.najdi.text,
    borderTopOpacity: 0.05,
  },
  contentText: {
    fontSize: tokens.typography.body.fontSize,
    color: tokens.colors.najdi.textMuted,
    fontStyle: 'italic',
  },
  pros: {
    marginBottom: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: '#34C75915',
    borderRadius: tokens.radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#34C759',
  },
  cons: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    backgroundColor: '#FF3B3015',
    borderRadius: tokens.radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  prosTitle: {
    fontSize: tokens.typography.callout.fontSize,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: tokens.spacing.xs,
  },
  consTitle: {
    fontSize: tokens.typography.callout.fontSize,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: tokens.spacing.xs,
  },
  prosItem: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
    marginBottom: tokens.spacing.xxs,
  },
  consItem: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
    marginBottom: tokens.spacing.xxs,
  },
  decisionBox: {
    backgroundColor: tokens.colors.najdi.container,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.lg,
    borderRadius: tokens.radii.sm,
  },
  decisionTitle: {
    fontSize: tokens.typography.headline.fontSize,
    fontWeight: tokens.typography.headline.fontWeight,
    color: tokens.colors.najdi.text,
    marginBottom: tokens.spacing.md,
  },
  decisionText: {
    fontSize: tokens.typography.callout.fontSize,
    color: tokens.colors.najdi.text,
    lineHeight: 22,
    marginBottom: tokens.spacing.sm,
  },
  bold: {
    fontWeight: '600',
  },
  footer: {
    height: tokens.spacing.xl,
  },
});

export default TabBarDemo;
