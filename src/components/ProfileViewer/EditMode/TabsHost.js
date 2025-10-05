import React from 'react';
import { View, Platform } from 'react-native';
import { Host, Picker } from '@expo/ui/swift-ui';
import { Host as AndroidHost, Picker as AndroidPicker } from '@expo/ui/jetpack-compose';

const TabsHost = ({
  tabs,
  activeTab,
  onTabChange,
  dirtyByTab = {},
  children,
}) => {
  const segments = tabs.map((tab) => ({
    ...tab,
    label: tab.label + (dirtyByTab[tab.id] ? ' •' : ''),
  }));

  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

  if (Platform.OS === 'ios') {
    return (
      <View style={{ gap: 16 }}>
        <View style={styles.segmentContainer}>
          <Host matchContents>
            <Picker
              options={segments.map((s) => s.label)}
              selectedIndex={activeIndex}
              onOptionSelected={({ nativeEvent: { index } }) => onTabChange(tabs[index].id)}
              variant="segmented"
            />
          </Host>
        </View>
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  } else {
    return (
      <View style={{ gap: 16 }}>
        <View style={styles.segmentContainer}>
          <AndroidHost>
            <AndroidPicker
              options={segments.map((s) => s.label)}
              selectedIndex={activeIndex}
              onOptionSelected={({ nativeEvent: { index } }) => onTabChange(tabs[index].id)}
              variant="segmented"
            />
          </AndroidHost>
        </View>
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }
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
