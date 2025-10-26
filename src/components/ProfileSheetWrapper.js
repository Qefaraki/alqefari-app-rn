import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import { runOnUI } from "react-native-reanimated";
import ProfileViewer from "./ProfileViewer";
import { useAdminMode } from "../contexts/AdminModeContext";
import { useTreeStore } from "../stores/useTreeStore";
import { supabase } from "../services/supabase";

const ProfileSheetWrapper = ({ editMode }) => {
  const { isAdminMode } = useAdminMode();
  const selectedPersonId = useTreeStore((s) => s.selectedPersonId);
  const setSelectedPersonId = useTreeStore((s) => s.setSelectedPersonId);
  const nodesMap = useTreeStore((s) => s.nodesMap);
  const profileSheetProgress = useTreeStore((s) => s.profileSheetProgress);

  // Local state for non-tree profiles (Munasib/spouses from outside family)
  const [munasibProfile, setMunasibProfile] = useState(null);
  const [loadingMunasib, setLoadingMunasib] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Track transitioning state to keep loading skeleton visible
  // Only transition when data is NOT immediately available from cache
  useEffect(() => {
    if (selectedPersonId) {
      // Check if data is cached (either in tree or already loaded as Munasib)
      const isInCache = nodesMap.has(selectedPersonId) ||
                        (munasibProfile?.id === selectedPersonId);
      // Show transition only when NOT cached AND currently loading
      setIsTransitioning(!isInCache && loadingMunasib);
    } else {
      setIsTransitioning(false);
    }
  }, [selectedPersonId, nodesMap, loadingMunasib, munasibProfile?.id]);

  // Lazy-load Munasib profiles when not found in nodesMap
  useEffect(() => {
    if (!selectedPersonId) {
      setMunasibProfile(null);
      setLoadingMunasib(false);
      return;
    }

    // If in nodesMap (Al-Qefari tree member), clear Munasib state
    if (nodesMap.has(selectedPersonId)) {
      setMunasibProfile(null);
      setLoadingMunasib(false);
      setIsTransitioning(false); // Person loaded from tree
      return;
    }

    // Not in nodesMap - might be Munasib, fetch it
    let cancelled = false;
    setLoadingMunasib(true);

    const fetchMunasibProfile = async () => {
      try {
        console.log('[ProfileSheetWrapper] Lazy-loading Munasib profile:', selectedPersonId);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', selectedPersonId)
          .is('deleted_at', null) // Filter soft-deleted profiles
          .single();

        if (cancelled) return;

        if (error) {
          console.error('[ProfileSheetWrapper] Failed to load Munasib:', error);
          Alert.alert('خطأ', 'فشل تحميل الملف الشخصي');
          setSelectedPersonId(null); // Close sheet
          setLoadingMunasib(false);
          return;
        }

        if (data) {
          console.log('[ProfileSheetWrapper] Loaded Munasib profile:', data.name);
          setMunasibProfile(data);
          setIsTransitioning(false); // Person loaded
        } else {
          Alert.alert('خطأ', 'الملف الشخصي غير موجود');
          setSelectedPersonId(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[ProfileSheetWrapper] Fetch error:', err);
          Alert.alert('خطأ', 'حدث خطأ أثناء التحميل');
          setSelectedPersonId(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingMunasib(false);
        }
      }
    };

    fetchMunasibProfile();

    return () => {
      cancelled = true; // Cleanup: prevent race conditions on rapid navigation
      setMunasibProfile(null); // Clear stale data
      setLoadingMunasib(false); // Reset loading state
    };
  }, [selectedPersonId, nodesMap, setSelectedPersonId]);

  // Get person data - try nodesMap first (tree members), fallback to Munasib state
  const person = React.useMemo(() => {
    if (!selectedPersonId) return null;

    console.log('[PROFILE SHEET DEBUG] Resolving person data for:', selectedPersonId, {
      treeStoreSize: nodesMap.size,
      hasMunasibProfile: !!munasibProfile,
      munasibProfileId: munasibProfile?.id
    });

    // 1. Try tree store (Al-Qefari family members with HID)
    const treeNode = nodesMap.get(selectedPersonId);
    if (treeNode) {
      console.log('[PROFILE SHEET DEBUG] ✅ Found in tree store:', {
        id: treeNode.id,
        name: treeNode.name,
        hid: treeNode.hid,
        fieldCount: Object.keys(treeNode).length,
        hasVersion: !!treeNode.version,
        source: 'treeStore'
      });
      return treeNode;
    } else {
      console.log('[PROFILE SHEET DEBUG] ❌ Not found in tree store');
    }

    // 2. Try Munasib state (spouses from outside family, hid=NULL)
    if (munasibProfile?.id === selectedPersonId) {
      console.log('[PROFILE SHEET DEBUG] ✅ Found in Munasib state:', {
        id: munasibProfile.id,
        name: munasibProfile.name,
        isMunasib: true,
        fieldCount: Object.keys(munasibProfile).length,
        hasVersion: !!munasibProfile.version,
        source: 'munasibProfile'
      });
      return munasibProfile;
    } else {
      console.log('[PROFILE SHEET DEBUG] ❌ Not found in Munasib state');
    }

    // 3. Still loading or not found
    console.warn('[PROFILE SHEET DEBUG] ⚠️ Person not found in either source:', {
      selectedPersonId,
      treeStoreHasData: nodesMap.size > 0,
      munasibAvailable: !!munasibProfile
    });
    return null;
  }, [selectedPersonId, nodesMap, munasibProfile]);

  // Critical: Reset profileSheetProgress when switching between modals
  useEffect(() => {
    // When admin mode changes or person selection changes, ensure clean state
    if (!selectedPersonId && profileSheetProgress) {
      runOnUI(() => {
        profileSheetProgress.value = 0;
      })();
    }
  }, [selectedPersonId]);

  const navigateToProfile = (targetId) => {
    if (!targetId) return;
    setSelectedPersonId(targetId);
  };

  const handleUpdate = (updatedData) => {
    if (!person?.id || !updatedData) return;
    useTreeStore.getState().updateNode(person.id, updatedData);
  };

  const handleClose = () => {
    if (profileSheetProgress) {
      runOnUI(() => {
        profileSheetProgress.value = 0;
      })();
    }
    setSelectedPersonId(null);
  };

  // Don't render anything when no profile is selected and not loading
  // This prevents the "no profile selected" empty state from showing on app open
  if (!selectedPersonId && !loadingMunasib) {
    return null;
  }

  // Always render ProfileViewer (with loading state if needed)
  // This provides consistent skeleton loading instead of ActivityIndicator
  return (
    <ProfileViewer
      person={person}
      loading={loadingMunasib || isTransitioning || (!person && !!selectedPersonId)}
      onClose={handleClose}
      onNavigateToProfile={navigateToProfile}
      onUpdate={handleUpdate}
    />
  );
};

export default ProfileSheetWrapper;
