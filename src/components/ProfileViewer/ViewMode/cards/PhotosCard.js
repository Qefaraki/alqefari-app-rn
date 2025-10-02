import React from 'react';
import { View, Text } from 'react-native';
import InfoCard from '../components/InfoCard';
import PhotoGalleryMaps from '../../../PhotoGalleryMaps';

const PhotosCard = ({ person, mode }) => {
  if (!person?.id) return null;
  return (
    <InfoCard title="الصور">
      <View style={{ borderRadius: 18, overflow: 'hidden' }}>
        <PhotoGalleryMaps
          profileId={person.id}
          isEditMode={mode === 'edit'}
          forceAdminMode={mode === 'edit'}
        />
      </View>
      {mode !== 'edit' ? (
        <Text style={styles.helper}>يمكنك إدارة الصور من وضع التعديل.</Text>
      ) : null}
    </InfoCard>
  );
};

const styles = {
  helper: {
    marginTop: 12,
    fontSize: 12,
    color: '#7a6571',
  },
};

export default PhotosCard;
