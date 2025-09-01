import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassSurface from '../glass/GlassSurface';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const NodeContextMenu = ({ visible, position, node, onClose, onAction }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !node) return null;

  const menuItems = [
    {
      id: 'addChildren',
      title: 'إضافة أطفال',
      icon: 'person-add',
      color: '#34C759',
    },
    {
      id: 'edit',
      title: 'تعديل',
      icon: 'pencil',
      color: '#007AFF',
    },
    {
      id: 'viewDetails',
      title: 'عرض التفاصيل',
      icon: 'information-circle',
      color: '#5856D6',
    },
    {
      id: 'delete',
      title: 'حذف',
      icon: 'trash',
      color: '#FF3B30',
    },
  ];

  // Calculate menu position to ensure it stays on screen
  const menuWidth = 200;
  const menuHeight = 220;
  let menuX = position.x - menuWidth / 2;
  let menuY = position.y - 20;

  // Adjust X position
  if (menuX < 10) menuX = 10;
  if (menuX + menuWidth > SCREEN_WIDTH - 10) menuX = SCREEN_WIDTH - menuWidth - 10;

  // Adjust Y position
  if (menuY + menuHeight > SCREEN_HEIGHT - 100) {
    menuY = position.y - menuHeight - 40;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.menuContainer,
            {
              left: menuX,
              top: menuY,
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <GlassSurface style={styles.menu}>
            <View style={styles.menuHeader}>
              <Text style={styles.nodeName}>{node.name}</Text>
              <Text style={styles.nodeInfo}>HID: {node.hid}</Text>
            </View>

            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  index === menuItems.length - 1 && styles.lastMenuItem,
                ]}
                onPress={() => {
                  onAction(item.id);
                  onClose();
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={item.color}
                  style={styles.menuIcon}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    item.id === 'delete' && styles.deleteText,
                  ]}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </GlassSurface>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  menuContainer: {
    position: 'absolute',
    width: 200,
  },
  menu: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuHeader: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  nodeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'right',
  },
  nodeInfo: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'right',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuIcon: {
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 15,
    color: '#000000',
    flex: 1,
    textAlign: 'right',
  },
  deleteText: {
    color: '#FF3B30',
  },
});

export default NodeContextMenu;