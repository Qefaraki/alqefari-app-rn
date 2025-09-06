import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassSurface from '../glass/GlassSurface';
import GlassButton from '../glass/GlassButton';
import profilesService from '../../services/profiles';

export default function MarriageEditor({ visible, onClose, person, onCreated }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedSpouse, setSelectedSpouse] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const targetGender = useMemo(
    () => (person?.gender === 'male' ? 'female' : 'male'),
    [person?.gender],
  );

  useEffect(() => {
    if (!visible) return;
    // reset on open
    setQuery('');
    setResults([]);
    setSelectedSpouse(null);
  }, [visible]);

  const performSearch = useCallback(
    async text => {
      const q = text?.trim();
      if (!q || q.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await profilesService.searchProfiles(q, 30, 0);
        if (error) throw new Error(error);
        const filtered = (data || [])
          .filter(p => p.id !== person.id)
          .filter(p => p.gender === targetGender);
        setResults(filtered);
      } catch (e) {
        // fail softly
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [person?.id, targetGender],
  );

  useEffect(() => {
    const t = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, performSearch]);

  const submit = async () => {
    if (!selectedSpouse) {
      Alert.alert('تنبيه', 'يرجى اختيار الزوج/الزوجة');
      return;
    }
    setSubmitting(true);
    try {
      const husband_id = person.gender === 'male' ? person.id : selectedSpouse.id;
      const wife_id = person.gender === 'female' ? person.id : selectedSpouse.id;
      const payload = {
        husband_id,
        wife_id,
        // Future fields (status/dates) intentionally omitted for now.
      };
      const { data, error } = await profilesService.createMarriage(payload);
      if (error) throw new Error(error);
      if (onCreated) onCreated(data);
      Alert.alert('نجح', 'تم إضافة الزواج بنجاح');
      onClose();
    } catch (e) {
      Alert.alert(
        'خطأ',
        e?.message || 'فشل إنشاء الزواج. تأكد من نشر دالة admin_create_marriage في قاعدة البيانات.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {person?.gender === 'male'
              ? 'إضافة زوجة'
              : person?.gender === 'female'
                ? 'إضافة زوج'
                : 'إضافة زواج'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <GlassSurface style={styles.section}>
          <Text style={styles.label}>الشخص</Text>
          <Text style={styles.personName}>{person?.name}</Text>
          <Text style={styles.hint}>
            ابحث واختر {targetGender === 'male' ? 'الزوج' : 'الزوجة'} من خلال البحث أدناه
          </Text>
        </GlassSurface>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث بالاسم أو HID"
              value={query}
              onChangeText={setQuery}
              textAlign="right"
            />
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#007AFF" />
              <Text style={styles.loadingText}>جارِ البحث...</Text>
            </View>
          ) : (
            results.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.resultRow, selectedSpouse?.id === p.id && styles.resultRowActive]}
                onPress={() => setSelectedSpouse(p)}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.resultName}>{p.name}</Text>
                  <Text style={styles.resultMeta}>HID: {p.hid}</Text>
                </View>
                {selectedSpouse?.id === p.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <View style={styles.footer}>
          <GlassButton
            title="تأكيد الإضافة"
            onPress={submit}
            loading={submitting}
            style={{ width: '100%' }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: '#000' },
  section: { margin: 16, padding: 16 },
  label: { fontSize: 14, color: '#666', marginBottom: 6, textAlign: 'right' },
  personName: { fontSize: 18, fontWeight: '600', color: '#000', textAlign: 'right' },
  hint: { fontSize: 12, color: '#8E8E93', marginTop: 4, textAlign: 'right' },
  searchContainer: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 16, marginLeft: 8, color: '#000' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },
  loadingText: { marginLeft: 8, color: '#666' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  resultRowActive: { borderColor: '#34C759' },
  resultName: { fontSize: 16, color: '#000' },
  resultMeta: { fontSize: 12, color: '#666' },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  toggleActive: { backgroundColor: '#007AFF' },
  toggleText: { color: '#666', fontSize: 14, fontWeight: '500' },
  toggleTextActive: { color: '#FFF' },
  row: { flexDirection: 'row', marginTop: 8 },
  input: { backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 10, padding: 10, color: '#000' },
  footer: {
    padding: 16,
    paddingBottom: 34,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
});
