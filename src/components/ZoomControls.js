import React from 'react';
import { View, Pressable, Text, Dimensions, StyleSheet } from 'react-native';
import { useTreeStore } from '../stores/useTreeStore';
import GlassContainer from './GlassContainer';
import * as Haptics from 'expo-haptics';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ZoomControls = () => {
  const zoom = useTreeStore(s => s.zoom);
  const resetView = useTreeStore(s => s.resetView);
  const treeBounds = useTreeStore(s => s.treeBounds);

  const viewport = {
    width: screenWidth,
    height: screenHeight,
  };

  const handleZoomIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    zoom(1, { x: screenWidth / 2, y: screenHeight / 2 }, viewport);
  };

  const handleZoomOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    zoom(-1, { x: screenWidth / 2, y: screenHeight / 2 }, viewport);
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetView(
      viewport,
      treeBounds && treeBounds.width > 0
        ? treeBounds
        : { minX: 0, maxX: 1000, minY: 0, maxY: 1000 },
    );
  };

  return (
    <View style={styles.container}>
      <GlassContainer
        borderRadius={16}
        intensity={75}
        shadowDistance={6}
        colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0.88)']}
      >
        <View style={styles.controlsWrapper}>
          <Pressable
            onPress={handleZoomIn}
            style={({ pressed }) => [
              styles.button,
              styles.topButton,
              pressed && styles.buttonPressed
            ]}
          >
            <Text style={styles.buttonText}>+</Text>
          </Pressable>
          
          <View style={styles.divider} />
          
          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed
            ]}
          >
            <Text style={styles.resetText}>⟲</Text>
          </Pressable>
          
          <View style={styles.divider} />
          
          <Pressable
            onPress={handleZoomOut}
            style={({ pressed }) => [
              styles.button,
              styles.bottomButton,
              pressed && styles.buttonPressed
            ]}
          >
            <Text style={styles.buttonText}>−</Text>
          </Pressable>
        </View>
      </GlassContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    top: '40%',
  },
  controlsWrapper: {
    width: 48,
  },
  button: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topButton: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  bottomButton: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  buttonPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  buttonText: {
    fontSize: 24,
    fontWeight: '300',
    color: '#1a1a1a',
  },
  resetText: {
    fontSize: 20,
    color: '#1a1a1a',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: 12,
  },
});

export default ZoomControls;
