import React from 'react';
import { Text } from 'react-native';
import InfoCard from '../components/InfoCard';
import FieldRow from '../components/FieldRow';
import { useFormattedDate } from '../../../../hooks/useFormattedDate';

const DatesCard = React.memo(
  ({ person }) => {
    const dob = person?.dob_data;
    const dod = person?.dod_data;
    const status = person?.status;
    const dobText = useFormattedDate(dob);
    const dodText = useFormattedDate(dod);

    if (!dob && !dod) return null;

    const rows = [];
    if (dob && dobText) {
      // Only show DOB if it's public or if user is viewing their own profile
      const showDOB = person?.dob_is_public !== false;
      rows.push(
          <FieldRow
            key="dob"
            label="تاريخ الميلاد"
            value={showDOB ? dobText : 'مخفي'}
            status={showDOB && dob?.approximate ? 'تاريخ تقريبي' : undefined}
          />,
      );
    }

    if (dod && status === 'deceased' && dodText) {
      rows.push(
          <FieldRow
            key="dod"
            label="تاريخ الوفاة"
            value={dodText}
            status={dod?.approximate ? 'تاريخ تقريبي' : undefined}
          />,
      );
    }

    if (rows.length === 0) return null;

    return (
      <InfoCard title="التواريخ المهمة">
        {rows}
      </InfoCard>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if actual date data or status changed
    const prevDob = prevProps.person?.dob_data;
    const nextDob = nextProps.person?.dob_data;
    const prevDod = prevProps.person?.dod_data;
    const nextDod = nextProps.person?.dod_data;

    return (
      prevProps.person?.status === nextProps.person?.status &&
      prevProps.person?.dob_is_public === nextProps.person?.dob_is_public &&
      prevDob?.year === nextDob?.year &&
      prevDob?.month === nextDob?.month &&
      prevDob?.day === nextDob?.day &&
      prevDob?.approximate === nextDob?.approximate &&
      prevDod?.year === nextDod?.year &&
      prevDod?.month === nextDod?.month &&
      prevDod?.day === nextDod?.day &&
      prevDod?.approximate === nextDod?.approximate
    );
  }
);

DatesCard.displayName = 'DatesCard';

const styles = {
  privacy: {
    marginTop: 8,
    fontSize: 12,
    color: '#736372',
  },
};

export default DatesCard;
