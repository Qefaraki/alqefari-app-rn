import React from 'react';
import InfoCard from '../components/InfoCard';
import FieldRow from '../components/FieldRow';

const LocationsCard = ({ person }) => {
  if (!person?.birth_place && !person?.current_residence) {
    return null;
  }

  return (
    <InfoCard title="الأماكن">
      {person?.birth_place ? (
        <FieldRow label="مكان الميلاد" value={person.birth_place} />
      ) : null}
      {person?.current_residence ? (
        <FieldRow label="الإقامة الحالية" value={person.current_residence} />
      ) : null}
    </InfoCard>
  );
};

export default LocationsCard;
