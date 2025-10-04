import React from 'react';
import { View } from 'react-native';
import InfoCard from '../components/InfoCard';
import PhotoGalleryMaps from '../../../PhotoGalleryMaps';

const PhotosCard = ({ person, accessMode }) => {
  if (!person?.id) return null;

  // Enable editing for users with direct access (admin/moderator/inner circle)
  const canEdit = accessMode === 'direct';

  return (
    <InfoCard title="الصور">
      <View style={{ borderRadius: 18, overflow: 'hidden' }}>
        <PhotoGalleryMaps
          profileId={person.id}
          isEditMode={canEdit}
          forceAdminMode={canEdit}
        />
      </View>
    </InfoCard>
  );
};

export default PhotosCard;
