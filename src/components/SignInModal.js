import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import AuthNavigator from '../navigation/AuthNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SignInModal({ visible, onClose, onAuthSuccess }) {
  const handleSetUser = async (user) => {
    // Mark onboarding as complete when auth succeeds
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    onAuthSuccess?.(user);
    onClose();
  };

  const handleSetGuest = async () => {
    // Mark onboarding as complete for guest mode
    await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <NavigationIndependentTree>
          <NavigationContainer>
            <AuthNavigator
              setIsGuest={handleSetGuest}
              setUser={handleSetUser}
            />
          </NavigationContainer>
        </NavigationIndependentTree>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030303',
  },
});