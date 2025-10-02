import React from 'react';
import { Text } from 'react-native';
import InfoCard from '../components/InfoCard';
import FieldRow from '../components/FieldRow';
import { useFormattedDate } from '../../../../hooks/useFormattedDate';

const DatesCard = ({ person }) => {
  const dob = person?.dob_data;
  const dod = person?.dod_data;
  const status = person?.status;
  const dobText = useFormattedDate(dob);
  const dodText = useFormattedDate(dod);

  if (!dob && !dod) return null;

  const rows = [];
  if (dob && dobText) {
    rows.push(
        <FieldRow
          key="dob"
          label="📅 تاريخ الميلاد"
          value={dobText}
          status={dob?.approximate ? 'تاريخ تقريبي' : undefined}
        />,
    );
  }

  if (dod && status === 'deceased' && dodText) {
    rows.push(
        <FieldRow
          key="dod"
          label="🌙 تاريخ الوفاة"
          value={dodText}
          status={dod?.approximate ? 'تاريخ تقريبي' : undefined}
        />,
    );
  }

  if (rows.length === 0) return null;

  return (
    <InfoCard title="التواريخ المهمة">
      {rows}
      {person?.dob_is_public === false ? (
        <Text style={styles.privacy}>هذا التاريخ مخفي عن الآخرين</Text>
      ) : null}
    </InfoCard>
  );
};

const styles = {
  privacy: {
    marginTop: 8,
    fontSize: 12,
    color: '#9a7b87',
  },
};

export default DatesCard;
