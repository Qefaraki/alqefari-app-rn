import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TabBar from '../components/ui/TabBar';
import tokens from '../components/ui/tokens';

/**
 * Demo screen to compare TabBar variants with and without divider
 * Used to determine default divider behavior
 */
const TabBarDemo = ({ onClose }) => {
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
          <View style={styles.headerContent}>
            <Text style={styles.title}>TabBar Variant Comparison</Text>
            <Text style={styles.subtitle}>
              Pinterest-Inspired Tab Component
            </Text>
          </View>
          {onClose && (
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons name="chevron-back" size={28} color={tokens.colors.najdi.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Variant 1: WITH DIVIDER */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>WITH Divider</Text>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Suggestion Statuses</Text>
            <TabBar
              tabs={suggestionTabs}
              activeTab={activeTab1}
              onTabChange={setActiveTab1}
              showDivider={true}
            />
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Role Filter</Text>
            <TabBar
              tabs={filterTabs}
              activeTab={activeTab2}
              onTabChange={setActiveTab2}
              showDivider={true}
            />
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Binary Toggle</Text>
            <TabBar
              tabs={userTabs}
              activeTab={activeTab3}
              onTabChange={setActiveTab3}
              showDivider={true}
            />
          </View>
        </View>

        {/* Variant 2: WITHOUT DIVIDER */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>WITHOUT Divider</Text>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Suggestion Statuses</Text>
            <TabBar
              tabs={suggestionTabs}
              activeTab={activeTab1}
              onTabChange={setActiveTab1}
              showDivider={false}
            />
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Role Filter</Text>
            <TabBar
              tabs={filterTabs}
              activeTab={activeTab2}
              onTabChange={setActiveTab2}
              showDivider={false}
            />
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Binary Toggle</Text>
            <TabBar
              tabs={userTabs}
              activeTab={activeTab3}
              onTabChange={setActiveTab3}
              showDivider={false}
            />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
  },
  closeButton: {
    padding: tokens.spacing.sm,
    marginLeft: tokens.spacing.md,
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
    marginBottom: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  demoLabel: {
    fontSize: tokens.typography.footnote.fontSize,
    fontWeight: '600',
    color: tokens.colors.najdi.textMuted,
    marginBottom: tokens.spacing.sm,
    textTransform: 'uppercase',
  },
  footer: {
    height: tokens.spacing.xl,
  },
});

export default TabBarDemo;
