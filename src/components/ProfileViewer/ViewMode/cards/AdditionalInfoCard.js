import React, { useState } from 'react';
import InfoCard from '../components/InfoCard';
import FieldRow from '../components/FieldRow';
import { formatUnknownFieldValue } from '../../utils/formatUnknownField';

const AdditionalInfoCard = ({ person, knownFields }) => {
  const [expanded, setExpanded] = useState(false);
  if (!person) return null;

  const unknownEntries = Object.entries(person).filter(([key, value]) => {
    if (value === null || value === undefined || value === '') return false;
    return !knownFields.includes(key);
  });

  if (unknownEntries.length === 0) return null;

  return (
    <InfoCard
      title="معلومات إضافية"
      hint={`(${unknownEntries.length} حقول)`}
      collapsible
      expanded={expanded}
      onToggle={() => setExpanded((prev) => !prev)}
    >
      {unknownEntries.map(([key, value]) => (
        <FieldRow key={key} label={key} value={formatUnknownFieldValue(value)} />
      ))}
    </InfoCard>
  );
};

export default AdditionalInfoCard;
