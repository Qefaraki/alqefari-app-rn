import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PhotoGallerySimple from '../../../PhotoGallerySimple';
import tokens from '../../../ui/tokens';
import { toArabicNumerals } from '../../../../utils/dateUtils';

const palette = tokens.colors.najdi;

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
      <View style={styles.headerRow}>
        <Text style={styles.title}>الصور</Text>
        {photoCount > 0 ? (
          <Text style={styles.count}>{toArabicNumerals(String(photoCount))}</Text>
        ) : null}
      </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: palette.text,
  },
  count: {
    fontSize: 15,
    fontWeight: '500',
    color: `${palette.text}99`,
  },
});

export default PhotosCard;
