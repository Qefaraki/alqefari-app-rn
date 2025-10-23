import React from 'react';
import { View } from 'react-native';
import SegmentedControl from '../../ui/SegmentedControl';

const TabsHost = ({
  tabs,
  activeTab,
  onTabChange,
  dirtyByTab = {},
  children,
}) => {
  const enhancedTabs = tabs.map((tab) => ({
    ...tab,
    showDot: Boolean(dirtyByTab?.[tab.id]),
  }));

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.segmentContainer}>
        <SegmentedControl
          options={enhancedTabs}
          value={activeTab}
          onChange={onTabChange}
        />
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = {
  segmentContainer: {
    paddingVertical: 12,
  },
  content: {
    // Content is inside BottomSheetScrollView, no flex needed
  },
};

export default TabsHost;
