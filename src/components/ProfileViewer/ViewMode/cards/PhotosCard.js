import React from 'react';
import InfoCard from '../components/InfoCard';
import PhotoGallerySimple from '../../../PhotoGallerySimple';

const PhotosCard = React.memo(
  ({ person, accessMode }) => {
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
  },
  (prevProps, nextProps) => {
    // Only re-render if person ID or access mode changed
    return (
      prevProps.person?.id === nextProps.person?.id &&
      prevProps.accessMode === nextProps.accessMode
    );
  }
);

PhotosCard.displayName = 'PhotosCard';

export default PhotosCard;
