import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch } from 'react-native';
import PhotoEditor from '../../admin/fields/PhotoEditor';
import NameEditor from '../../admin/fields/NameEditor';
import DateEditor from '../../admin/fields/DateEditor';

const ToggleGroup = ({ label, value, options, onChange }) => {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.toggleRow}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.toggleChip, isActive ? styles.toggleChipActive : null]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.toggleLabel, isActive ? styles.toggleLabelActive : null]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const TabGeneral = ({ form, updateField }) => {
  const { draft, original } = form;
  const profileId = original?.id || draft?.id;

  return (
    <View style={{ gap: 24 }}>
      <PhotoEditor
        value={draft?.photo_url || ''}
        onChange={(url) => updateField('photo_url', url)}
        currentPhotoUrl={draft?.photo_url}
        personName={draft?.name}
        profileId={profileId}
      />

      <NameEditor
        value={draft?.name || ''}
        onChange={(text) => updateField('name', text)}
        placeholder="الاسم الكامل"
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.sectionLabel}>الكنية</Text>
        <TextInput
          style={styles.input}
          value={draft?.kunya || ''}
          onChangeText={(text) => updateField('kunya', text)}
          placeholder="أدخل الكنية"
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.sectionLabel}>اللقب</Text>
        <TextInput
          style={styles.input}
          value={draft?.nickname || ''}
          onChangeText={(text) => updateField('nickname', text)}
          placeholder="أدخل اللقب"
        />
      </View>

      <ToggleGroup
        label="الجنس"
        value={draft?.gender || 'male'}
        onChange={(value) => updateField('gender', value)}
        options={[
          { value: 'male', label: 'ذكر' },
          { value: 'female', label: 'أنثى' },
        ]}
      />

      <ToggleGroup
        label="الحالة"
        value={draft?.status || 'alive'}
        onChange={(value) => updateField('status', value)}
        options={[
          { value: 'alive', label: 'حي' },
          { value: 'deceased', label: 'متوفى' },
        ]}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.sectionLabel}>تاريخ الميلاد</Text>
        <DateEditor
          value={draft?.dob_data}
          onChange={(value) => updateField('dob_data', value)}
        />
      </View>

      {draft?.status === 'deceased' ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.sectionLabel}>تاريخ الوفاة</Text>
          <DateEditor
            value={draft?.dod_data}
            onChange={(value) => updateField('dod_data', value)}
          />
        </View>
      ) : null}

      <View style={[styles.fieldGroup, styles.switchRow]}>
        <Text style={styles.sectionLabel}>عرض تاريخ الميلاد للعائلة</Text>
        <Switch
          value={draft?.dob_is_public !== false}
          onValueChange={(value) => updateField('dob_is_public', value)}
        />
      </View>
    </View>
  );
};

const styles = {
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4d3440',
    marginBottom: 8,
  },
  fieldGroup: {
    gap: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#321f27',
    borderWidth: 1,
    borderColor: '#e8d9df',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleChip: {
    flex: 1,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d9c6cd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  toggleChipActive: {
    borderColor: '#802a46',
    backgroundColor: '#fde8ed',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#725963',
    fontWeight: '600',
  },
  toggleLabelActive: {
    color: '#57172c',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
};

export default TabGeneral;
