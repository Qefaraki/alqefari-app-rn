import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassSurface from '../glass/GlassSurface';

const ProfileCard = ({ profile, onAddChildren, onEditProfile, onDeleteProfile, disabled = false }) => {
  return (
    <GlassSurface style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <View>
          <Text style={styles.profileName}>{profile.name}</Text>
          <Text style={styles.profileHID}>HID: {profile.hid}</Text>
          {profile.birth_year && (
            <Text style={styles.profileInfo}>مواليد: {profile.birth_year}</Text>
          )}
        </View>
        <View style={styles.profileGender}>
          <Ionicons
            name={profile.gender === 'male' ? 'male' : 'female'}
            size={24}
            color={profile.gender === 'male' ? '#007AFF' : '#FF375F'}
          />
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#34C759' }]}
          onPress={() => onAddChildren(profile)}
          disabled={disabled}
        >
          <Ionicons name="person-add" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>إضافة أطفال</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#007AFF' }]}
          onPress={() => onEditProfile(profile)}
          disabled={disabled}
        >
          <Ionicons name="pencil" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>تعديل</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#FF3B30' }]}
          onPress={() => onDeleteProfile(profile)}
          disabled={disabled}
        >
          <Ionicons name="trash" size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>حذف</Text>
        </TouchableOpacity>
      </View>
    </GlassSurface>
  );
};

const styles = StyleSheet.create({
  profileCard: {
    marginBottom: 12,
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  profileHID: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  profileInfo: {
    fontSize: 14,
    color: '#666666',
  },
  profileGender: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default ProfileCard;