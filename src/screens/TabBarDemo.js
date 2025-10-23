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
  const [customControl1, setCustomControl1] = useState('pending');
  const [customControl2, setCustomControl2] = useState('all');
  const [customControl3, setCustomControl3] = useState('users');

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

        {/* Variant 3: Custom iOS-style Segmented Control */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Custom Segmented Control</Text>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Suggestion Statuses</Text>
            <View style={styles.segmentedControlContainer}>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segment,
                    customControl1 === 'pending' && styles.segmentActive
                  ]}
                  onPress={() => setCustomControl1('pending')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.segmentText,
                    customControl1 === 'pending' && styles.segmentTextActive
                  ]}>
                    قيد المراجعة
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segment,
                    customControl1 === 'approved' && styles.segmentActive
                  ]}
                  onPress={() => setCustomControl1('approved')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.segmentText,
                    customControl1 === 'approved' && styles.segmentTextActive
                  ]}>
                    مقبولة
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segment,
                    customControl1 === 'rejected' && styles.segmentActive
                  ]}
                  onPress={() => setCustomControl1('rejected')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.segmentText,
                    customControl1 === 'rejected' && styles.segmentTextActive
                  ]}>
                    مرفوضة
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Role Filter</Text>
            <View style={styles.segmentedControlContainer}>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segment,
                    customControl2 === 'all' && styles.segmentActive
                  ]}
                  onPress={() => setCustomControl2('all')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.segmentText,
                    customControl2 === 'all' && styles.segmentTextActive
                  ]}>
                    الكل
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segment,
                    customControl2 === 'admin' && styles.segmentActive
                  ]}
                  onPress={() => setCustomControl2('admin')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.segmentText,
                    customControl2 === 'admin' && styles.segmentTextActive
                  ]}>
                    مدير رئيسي
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segment,
                    customControl2 === 'moderator' && styles.segmentActive
                  ]}
                  onPress={() => setCustomControl2('moderator')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.segmentText,
                    customControl2 === 'moderator' && styles.segmentTextActive
                  ]}>
                    مشرف
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.demoContainer}>
            <Text style={styles.demoLabel}>Binary Toggle</Text>
            <View style={styles.segmentedControlContainer}>
              <View style={styles.segmentedControl}>
                <TouchableOpacity
                  style={[
                    styles.segment,
                    customControl3 === 'users' && styles.segmentActive
                  ]}
                  onPress={() => setCustomControl3('users')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.segmentText,
                    customControl3 === 'users' && styles.segmentTextActive
                  ]}>
                    المستخدمون
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.segment,
                    customControl3 === 'blocked' && styles.segmentActive
                  ]}
                  onPress={() => setCustomControl3('blocked')}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.segmentText,
                    customControl3 === 'blocked' && styles.segmentTextActive
                  ]}>
                    المحظورون
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
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
  segmentedControlContainer: {
    paddingHorizontal: 0,
    paddingVertical: tokens.spacing.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.najdi.container + '40', // Camel Hair Beige 40%
    borderRadius: 10,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: tokens.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: tokens.colors.najdi.textMuted,
    fontFamily: 'SF Arabic',
  },
  segmentTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.najdi.text,
    fontFamily: 'SF Arabic',
  },
  footer: {
    height: tokens.spacing.xl,
  },
});

export default TabBarDemo;
