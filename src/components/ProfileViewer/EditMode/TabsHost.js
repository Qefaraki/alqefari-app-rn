import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

const TabsHost = ({
  tabs,
  activeTab,
  onTabChange,
  dirtyByTab = {},
  children,
}) => {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const isDirty = dirtyByTab[tab.id];
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive ? styles.tabButtonActive : null]}
              onPress={() => onTabChange(tab.id)}
            >
              <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>
                {tab.label}
                {isDirty ? ' •' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 32, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
};

const styles = {
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    backgroundColor: '#f2e8ed',
    padding: 6,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  tabLabel: {
    fontSize: 14,
    color: '#836f7b',
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#2f1823',
  },
  content: {
    flex: 1,
  },
};

export default TabsHost;
