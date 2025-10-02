import React from 'react';
import InfoCard from '../components/InfoCard';
import FieldRow from '../components/FieldRow';
import { useFormattedDate } from '../../../../hooks/useFormattedDate';

const SystemCard = ({ person, isAdmin }) => {
  const updatedAtText = useFormattedDate(person?.updated_at);

  if (!isAdmin) return null;

  return (
    <InfoCard title="معلومات النظام">
      {person?.role ? <FieldRow label="الدور" value={person.role} /> : null}
      {person?.profile_visibility ? (
        <FieldRow label="رؤية الملف" value={person.profile_visibility} />
      ) : null}
      {person?.version ? (
        <FieldRow label="الإصدار" value={`v${person.version}`} />
      ) : null}
      {person?.updated_at ? (
        <FieldRow label="آخر تحديث" value={updatedAtText} />
      ) : null}
    </InfoCard>
  );
};

export default SystemCard;
