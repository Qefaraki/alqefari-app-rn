import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import BottomSheet, {
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { useTreeStore } from '../stores/useTreeStore';
import { familyData, FAMILY_NAME, getChildren, getFather } from '../data/family-data';
import CardSurface from './ios/CardSurface';
import profilesService from '../services/profiles';
import { formatDateDisplay, getAllSocialMedia } from '../services/migrationHelpers';
import GlassMetricPill from './GlassMetricPill';
import SectionCard from './SectionCard';
import DefinitionList from './DefinitionList';
import AchievementsList from './AchievementsList';
import { LinearGradient } from 'expo-linear-gradient';
import GlassTag from './GlassTag';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
// Direct translation of the original web ProfileSheet.jsx to Expo

// Note: RTL requires app restart to take effect
// For now, we'll use explicit right-aligned positioning

const generationNames = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن'];

const ProfileSheet = () => {
  const selectedPersonId = useTreeStore(s => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore(s => s.setSelectedPersonId);
  const treeData = useTreeStore(s => s.treeData);
  const bottomSheetRef = useRef(null);
  const scrollRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [familySectionY, setFamilySectionY] = useState(0);
  const [marriages, setMarriages] = useState([]);
  const [loadingMarriages, setLoadingMarriages] = useState(false);

  // Snap points matching original (0.4, 0.9, 1)
  const snapPoints = useMemo(() => ['40%', '90%', '100%'], []);

  // Get person data - try tree data first, fall back to familyData
  const person = useMemo(() => {
    if (treeData && treeData.length > 0) {
      return treeData.find(p => p.id === selectedPersonId);
    }
    return familyData.find(p => p.id === selectedPersonId);
  }, [selectedPersonId, treeData]);

  const father = useMemo(() => {
    if (!person) return null;
    const dataSource = treeData.length > 0 ? treeData : familyData;
    
    // If using backend data, find by father_id
    if (person.father_id && treeData.length > 0) {
      return dataSource.find(p => p.id === person.father_id);
    }
    
    // Fall back to old method
    return getFather(person.id, dataSource);
  }, [person, treeData]);

  const children = useMemo(() => {
    if (!person) return [];
    const dataSource = treeData.length > 0 ? treeData : familyData;
    
    // If using backend data, find by father_id
    if (treeData.length > 0 && person.gender === 'male') {
      return dataSource.filter(p => p.father_id === person.id);
    }
    
    // Fall back to old method
    return getChildren(person.id, dataSource);
  }, [person, treeData]);

  // Oldest to youngest based on hierarchical HID suffix (higher number = older)
  const sortedChildren = useMemo(() => {
    const getOrder = (p) => {
      const parts = String(p.hid || '').split('.');
      const last = parts.length > 0 ? Number(parts[parts.length - 1]) : 0;
      return isNaN(last) ? 0 : last;
    };
    return [...children].sort((a, b) => getOrder(b) - getOrder(a));
  }, [children]);

  // Calculate metrics
  const descendantsCount = useMemo(() => {
    if (!person) return 0;
    
    // If backend data has descendants_count, use it
    if (treeData.length > 0 && person.descendants_count !== undefined) {
      return person.descendants_count;
    }
    
    // Otherwise calculate it
    const dataSource = treeData.length > 0 ? treeData : familyData;
    let count = 0;
    const countDescendants = (id) => {
      const kids = dataSource.filter(p => p.father_id === id);
      count += kids.length;
      kids.forEach(child => countDescendants(child.id));
    };
    countDescendants(person.id);
    return count;
  }, [person, treeData]);

  const siblingsCount = useMemo(() => {
    if (!person || !father) return 0;
    const dataSource = treeData.length > 0 ? treeData : familyData;
    const siblings = dataSource.filter(p => p.father_id === father.id) || [];
    return Math.max(0, siblings.length - 1);
  }, [person, father, treeData]);

  // Full name exactly as in original web version (include person's name + connector)
  const fullName = useMemo(() => {
    if (!person) return '';
    const map = new Map();
    familyData.forEach(p => map.set(p.id, p));
    const names = [];
    let currentId = person.id;
    while (currentId) {
      const p = map.get(currentId);
      if (!p) break;
      names.push(p.name);
      currentId = p.father_id;
    }
    names.push(FAMILY_NAME);
    if (names.length > 1) {
      const connector = person.gender === 'female' ? 'بنت' : 'بن';
      // Omit the person's own first name to avoid duplication with the title
      return connector + ' ' + names.slice(1).join(' ');
    }
    return names.join(' ');
  }, [person]);

  // Handle sheet changes
  const handleSheetChange = useCallback((index) => {
    setCurrentSnapIndex(index);
    if (index !== -1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Handle copy name
  const handleCopyName = useCallback(async () => {
    await Clipboard.setStringAsync(fullName);
    setCopied(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => setCopied(false), 2000);
  }, [fullName]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync('', {
        message: fullName,
      });
    }
  }, [fullName]);

  // Scroll helpers
  const scrollToFamily = useCallback(() => {
    if (!scrollRef.current) return;
    try {
      scrollRef.current.scrollTo({ y: Math.max(0, familySectionY - 16), animated: true });
    } catch (e) {}
  }, [familySectionY]);

  // Navigate to another person
  const navigateToPerson = useCallback((personId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPersonId(personId);
  }, [setSelectedPersonId]);

  // Custom backdrop
  const renderBackdrop = useCallback(
    props => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.5}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  // Show/hide sheet based on selection and load marriages
  useEffect(() => {
    if (selectedPersonId) {
      bottomSheetRef.current?.expand();
      // Try to load marriages - will handle errors gracefully
      loadMarriages();
    } else {
      bottomSheetRef.current?.close();
      setMarriages([]);
    }
  }, [selectedPersonId]);
  
  // Load marriage data
  const loadMarriages = async () => {
    if (!person?.id) return;
    setLoadingMarriages(true);
    try {
      const { data, error } = await profilesService.getPersonMarriages(person.id);
      if (error) {
        // Temporarily skip marriage loading due to backend date type issue
        console.warn('Skipping marriages due to backend issue:', error);
        setMarriages([]);
      } else {
        setMarriages(data || []);
      }
    } catch (error) {
      console.error('Error loading marriages:', error);
      setMarriages([]);
    } finally {
      setLoadingMarriages(false);
    }
  };

  if (!person) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      onChange={handleSheetChange}
      onClose={() => setSelectedPersonId(null)}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.sheetBackground}
      enablePanDownToClose
      animateOnMount
    >
      <BottomSheetScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        ref={scrollRef}
      >
        <View style={{ flex: 1 }}>
          {/* Close button */}
          <Pressable onPress={() => setSelectedPersonId(null)} style={styles.closeButton} accessibilityLabel="إغلاق">
            <Text style={styles.closeButtonText}>×</Text>
          </Pressable>

          {/* Unified hero card: image + description + metrics */}
          <View style={styles.cardWrapper}>
            <View style={styles.photoSection}>
              <Image
                source={{ uri: person.photo_url || 'https://iamalqefari.com/wp-content/uploads/2023/08/img_2216.jpg?w=1024' }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              {/* Top gradient for legibility of the close control */}
              <LinearGradient
                colors={["rgba(0,0,0,0.24)", "rgba(0,0,0,0)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFill, { height: 120 }]}
              />
              <LinearGradient
                colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.12)"]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>

            <View style={styles.descSection}>
              <Text style={styles.nameText}>{person.name}</Text>
              <Pressable onPress={handleCopyName} style={{ width: '100%' }} accessibilityLabel="نسخ الاسم الكامل">
                <Text style={styles.fullName}>
                  {fullName}
                  {copied && <Text style={styles.copiedText}> • تم النسخ</Text>}
                </Text>
              </Pressable>
              {/* Header highlight chips */}
              {/* Chips removed; occupation and city moved into metrics grid */}
              {person.biography ? (
                <>
                  <Text style={styles.biographyText} numberOfLines={bioExpanded ? undefined : 3}>
                    {person.biography}
                  </Text>
                  {person.biography.length > 120 && (
                    <Pressable onPress={() => setBioExpanded(v => !v)} accessibilityLabel="عرض المزيد من السيرة">
                      <Text style={styles.readMore}>{bioExpanded ? 'عرض أقل' : 'عرض المزيد'}</Text>
                    </Pressable>
                  )}
                </>
              ) : null}

              {/* Metrics row inside hero */}
              <View style={styles.metricsGrid}>
                <GlassMetricPill
                  value={generationNames[person.generation - 1] || person.generation}
                  label="الجيل"
                  onPress={scrollToFamily}
                  style={[styles.pill, styles.metricItem]}
                />
                {children.length > 0 && (
                  <GlassMetricPill
                    value={children.length}
                    label="الأبناء"
                    onPress={scrollToFamily}
                    style={[styles.pill, styles.metricItem]}
                  />
                )}
                {siblingsCount > 0 && (
                  <GlassMetricPill
                    value={siblingsCount}
                    label="الإخوة"
                    onPress={scrollToFamily}
                    style={[styles.pill, styles.metricItem]}
                  />
                )}
                {descendantsCount > 0 && (
                  <GlassMetricPill
                    value={descendantsCount}
                    label="الذرية"
                    onPress={scrollToFamily}
                    style={[styles.pill, styles.metricItem]}
                  />
                )}
                {person.occupation ? (
                  <GlassMetricPill
                    value={person.occupation}
                    label="المهنة"
                    style={[styles.pill, styles.metricItem]}
                  />
                ) : null}
                {person.current_residence ? (
                  <GlassMetricPill
                    value={person.current_residence}
                    label="المدينة"
                    style={[styles.pill, styles.metricItem]}
                  />
                ) : null}
              </View>

              {/* Primary action removed per request */}
            </View>
          </View>

          {/* Information section */}
          <SectionCard title="المعلومات">
            <DefinitionList
              items={[
                { label: 'تاريخ الميلاد', value: formatDateDisplay(person.dob_data) || '—' },
                ...(person.dod_data ? [{ label: 'تاريخ الوفاة', value: formatDateDisplay(person.dod_data) }] : []),
                ...(person.birth_place ? [{ label: 'مكان الميلاد', value: person.birth_place }] : []),
                ...(person.current_residence ? [{ label: 'مكان الإقامة', value: person.current_residence }] : []),
                ...(person.education ? [{ label: 'التعليم', value: person.education }] : []),
                ...(marriages.length > 0 ? [{ label: 'الحالة الاجتماعية', value: marriages.map(m => m.spouse_name).join('، ') || `${marriages.length} أزواج` }] : []),
              ]}
            />
          </SectionCard>

          {/* Contact/Social links (optional, shown only if any present) */}
          {(() => {
            const socialMedia = getAllSocialMedia(person);
            const hasSocialLinks = person.phone || person.email || Object.keys(socialMedia).length > 0;
            
            if (!hasSocialLinks) return null;
            
            return (
              <SectionCard title="روابط التواصل">
                <View style={styles.linksGrid}>
                  {person.phone && (
                    <Pressable onPress={() => Linking.openURL(`tel:${person.phone}`)} style={styles.linkItem}>
                      <Text style={styles.linkText}>{person.phone}</Text>
                    </Pressable>
                  )}
                  {person.email && (
                    <Pressable onPress={() => Linking.openURL(`mailto:${person.email}`)} style={styles.linkItem}>
                      <Text style={styles.linkText}>{person.email}</Text>
                    </Pressable>
                  )}
                  {socialMedia.twitter && (
                    <Pressable onPress={() => Linking.openURL(socialMedia.twitter)} style={styles.linkItem}>
                      <Text style={styles.linkText}>Twitter/X</Text>
                    </Pressable>
                  )}
                  {socialMedia.instagram && (
                    <Pressable onPress={() => Linking.openURL(socialMedia.instagram)} style={styles.linkItem}>
                      <Text style={styles.linkText}>Instagram</Text>
                    </Pressable>
                  )}
                  {socialMedia.linkedin && (
                    <Pressable onPress={() => Linking.openURL(socialMedia.linkedin)} style={styles.linkItem}>
                      <Text style={styles.linkText}>LinkedIn</Text>
                    </Pressable>
                  )}
                  {socialMedia.website && (
                    <Pressable onPress={() => Linking.openURL(socialMedia.website)} style={styles.linkItem}>
                      <Text style={styles.linkText}>Website</Text>
                    </Pressable>
                  )}
                </View>
              </SectionCard>
            );
          })()}

          {/* Achievements */}
          {person.achievements && person.achievements.length > 0 && (
            <SectionCard title="الإنجازات">
              <AchievementsList items={person.achievements} />
            </SectionCard>
          )}

          {/* Timeline */}
          {person.timeline && person.timeline.length > 0 && (
            <SectionCard title="الأحداث المهمة">
              <View style={{ gap: 12 }}>
                {person.timeline.map((event, index) => (
                  <View key={index} style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={{ flex: 1 }}>
                      <View style={styles.timelineHeader}>
                        <Text style={styles.timelineYear}>{event.year}هـ</Text>
                        <Text style={styles.timelineEvent}>{event.event}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </SectionCard>
          )}

          {/* Family list */}
          <View style={{ marginHorizontal: 20 }} onLayout={(e) => setFamilySectionY(e.nativeEvent.layout.y)}>
            <SectionCard title="العائلة" style={{ marginBottom: 12 }} contentStyle={{ paddingHorizontal: 0 }}>
              {father && (
                <CardSurface radius={12} style={styles.familyCard}>
                  <Pressable onPress={() => navigateToPerson(father.id)} style={[styles.familyRow]}>
                    <View style={styles.familyInfo}>
                      {father.photo_url ? (
                        <Image source={{ uri: father.photo_url }} style={styles.familyPhoto} />
                      ) : (
                        <View style={[styles.familyPhoto, styles.photoPlaceholder]} />
                      )}
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.familyName}>{father.name}</Text>
                        <Text style={styles.familyRelation}>الوالد</Text>
                      </View>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </CardSurface>
              )}
              {sortedChildren && sortedChildren.length > 0 && (
                <CardSurface radius={12} style={[styles.familyCard, { marginTop: 12 }]}>
                  <View>
                    {sortedChildren.map((child, idx) => (
                      <Pressable key={child.id} onPress={() => navigateToPerson(child.id)} style={[styles.familyRow, idx < sortedChildren.length - 1 && styles.rowDivider]}>
                        <View style={styles.familyInfo}>
                          {child.photo_url ? (
                            <Image source={{ uri: child.photo_url }} style={styles.familyPhoto} />
                          ) : (
                            <View style={[styles.familyPhoto, styles.photoPlaceholder]} />
                          )}
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.familyName}>{child.name}</Text>
                            <Text style={styles.familyRelation}>{child.gender === 'male' ? 'ابن' : 'ابنة'}</Text>
                          </View>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                </CardSurface>
              )}
            </SectionCard>
          </View>

          {/* Bottom padding for safe area */}
          <View style={{ height: 100 }} />
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetBackground: {
    backgroundColor: '#FFFFFF',
  },
  handleIndicator: {
    backgroundColor: '#d0d0d0',
    width: 48,
    height: 5,
  },
  
  // Card header (image + description)
  cardWrapper: {
    marginTop: 12,
    borderRadius: 48,
    overflow: 'hidden',
    backgroundColor: '#F7F7F8',
  },
  photoSection: {
    height: 280,
    backgroundColor: '#EEE',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  descSection: {
    backgroundColor: '#F7F7F8',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  nameText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
    fontFamily: 'SF Arabic',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fullName: {
    fontSize: 17,
    color: '#374151',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
    lineHeight: 24,
    writingDirection: 'rtl',
  },
  copiedText: {
    color: '#059669',
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(17,24,39,0.05)',
  },
  chipText: {
    fontSize: 13,
    color: '#111827',
    fontFamily: 'SF Arabic',
  },

  // Metrics grid
  metricsRow: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricsGrid: {
    marginTop: 12,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    flexGrow: 1,
  },
  metricItem: {
    flexBasis: '30%',
    flexGrow: 1,
  },

  // Content Sections
  sectionBlock: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1a1a1a',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  biographyText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#333',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  readMore: {
    marginTop: 6,
    fontSize: 14,
    color: '#2563eb',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
  },

  // Grouped info card
  groupedCard: {
    marginTop: 12,
    marginHorizontal: 20,
  },
  groupedRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15,23,42,0.06)',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'SF Arabic',
  },
  rowValue: {
    fontSize: 14,
    color: '#0f172a',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
  },

  // Links grid
  linksGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
  },
  linkItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(17,24,39,0.04)',
  },
  linkText: {
    fontSize: 15,
    color: '#2563eb',
    fontFamily: 'SF Arabic',
  },

  // Achievements
  achievementRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginTop: 2,
  },
  bodyText: {
    fontSize: 15,
    color: '#1f2937',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
  },

  // Timeline
  timelineRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginTop: 4,
  },
  timelineHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineYear: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'SF Arabic',
  },
  timelineEvent: {
    fontSize: 15,
    color: '#111827',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
    flexShrink: 1,
  },

  // Family list
  familyCard: {
    marginTop: 8,
  },
  familyRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  familyRowInset: {
    paddingHorizontal: 16,
  },
  familyInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  familyPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginLeft: 12,
  },
  photoPlaceholder: {
    backgroundColor: '#e0e0e0',
  },
  familyName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
    fontFamily: 'SF Arabic',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  familyRelation: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'SF Arabic',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  chevron: {
    fontSize: 22,
    color: '#9ca3af',
    transform: [{ scaleX: -1 }],
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15,23,42,0.06)',
  },
  parentChildrenSeparator: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },

  closeButton: {
    position: 'absolute',
    top: 8,
    right: 12,
    zIndex: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'SF Arabic',
  },
});

export default ProfileSheet;