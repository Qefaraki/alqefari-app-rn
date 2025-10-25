import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import PhotoGallerySimple from '../../../PhotoGallerySimple';

const PhotosCard = React.memo(({
  person,
  accessMode,
}) => {
  const [photoCount, setPhotoCount] = useState(null);

  const handlePhotosLoaded = useCallback((count) => {
    setPhotoCount(count);
  }, []);

  useEffect(() => {
    setPhotoCount(null);
  }, [person?.id]);

  if (!person?.id) return null;

  if (photoCount === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <PhotoGallerySimple
        profileId={person.id}
        isEditMode={false}
        onPhotosLoaded={handlePhotosLoaded}
      />
    </View>
  );
}, (prevProps, nextProps) => (
  prevProps.person?.id === nextProps.person?.id &&
  prevProps.accessMode === nextProps.accessMode
));

PhotosCard.displayName = 'PhotosCard';

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
});

export default PhotosCard;
