import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import AuthNavigator from '../navigation/AuthNavigator';

export default function SignInModal({ visible, onClose, onAuthSuccess }) {
  const handleSetUser = async (user) => {
    // DO NOT mark onboarding as complete here!
    // It should only be marked complete after successful profile linking
    // The AuthStateMachine will handle this when transitioning to PROFILE_LINKED
    onAuthSuccess?.(user);
    onClose();
  };

  const handleSetGuest = async () => {
    // Guest mode is handled by the state machine
    // It will set hasCompletedOnboarding when transitioning to GUEST_MODE
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