import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminMode } from '../../contexts/AdminModeContext';
import { BlurView } from 'expo-blur';

const CompactAdminBar = ({ user, onControlPanelPress, onUserPress }) => {
  const { isAdmin, isAdminMode, toggleAdminMode, loading } = useAdminMode();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  if (!user || loading || !isAdmin) return null;
  
  if (isCollapsed) {
    return (
      <TouchableOpacity
        style={styles.collapsedButton}
        onPress={() => setIsCollapsed(false)}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-down" size={20} color="#007AFF" />
      </TouchableOpacity>
    );
  }
  
  return (
    <BlurView intensity={80} tint="light" style={styles.container}>
      <View style={styles.content}>
        {/* User Section */}
        <TouchableOpacity 
          style={styles.userSection} 
          onPress={onUserPress}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Ionicons name="person-circle" size={28} color="#007AFF" />
          </View>
          <Text style={styles.email} numberOfLines={1}>
            {user.email}
          </Text>
        </TouchableOpacity>
        
        {/* Admin Toggle */}
        <View style={styles.toggleSection}>
          <Text style={styles.toggleLabel}>Admin</Text>
          <Switch
            value={isAdminMode}
            onValueChange={toggleAdminMode}
            trackColor={{ false: '#E5E5E5', true: '#007AFF' }}
            thumbColor="#FFFFFF"
            style={styles.switch}
          />
        </View>
        
        {/* Control Panel Button */}
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={onControlPanelPress}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark" size={22} color="#007AFF" />
        </TouchableOpacity>
        
        {/* Collapse Button */}
        <TouchableOpacity 
          style={styles.collapseButton}
          onPress={() => setIsCollapsed(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-up" size={16} color="#999" />
        </TouchableOpacity>
      </View>
    </BlurView>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  userSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 10,
  },
  email: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
    flex: 1,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  toggleLabel: {
    fontSize: 13,
    color: '#666',
    marginRight: 8,
    fontWeight: '600',
  },
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  controlButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  collapseButton: {
    padding: 6,
    marginLeft: 8,
  },
  collapsedButton: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 4,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
});

export default CompactAdminBar;