import React from 'react';
import { View, StyleSheet } from 'react-native';
import PropTypes from 'prop-types';
import tokens from '../tokens';

/**
 * Shared card surface used across profile forms.
 * Ensures consistent padding, elevation, and rounded corners.
 */
const ProfileFormCard = ({ children, style }) => {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
};

ProfileFormCard.propTypes = {
  children: PropTypes.node.isRequired,
  style: PropTypes.object,
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
});

export default ProfileFormCard;
