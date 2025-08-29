import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import TreeView from './src/components/TreeView';
import ProfileSheet from './src/components/ProfileSheet';
import './global.css';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <View className="flex-1">
          <StatusBar style="dark" />
          
          {/* Header */}
          <View className="bg-white pt-12 pb-4 px-4 shadow-sm">
            <Text className="text-2xl font-bold text-center text-gray-900">
              شجرة عائلة القفاري
            </Text>
          </View>
          
          {/* Tree View */}
          <View className="flex-1">
            <TreeView />
          </View>

          {/* Profile Sheet */}
          <ProfileSheet />
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}