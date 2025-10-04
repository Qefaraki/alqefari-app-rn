import React from 'react';
import InfoCard from '../components/InfoCard';
import PhotoGallerySimple from '../../../PhotoGallerySimple';

const PhotosCard = ({ person, accessMode }) => {
  if (!person?.id) return null;

  // Enable editing for users with direct access (admin/moderator/inner circle)
  const canEdit = accessMode === 'direct';

  return (
    <InfoCard title="الصور">
      <PhotoGallerySimple
        profileId={person.id}
        isEditMode={canEdit}
      />
    </InfoCard>
  );
};

export default PhotosCard;
