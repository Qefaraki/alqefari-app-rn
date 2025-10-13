import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../../services/supabase';
import { PERMISSION_LEVELS } from '../constants';
import { fetchWithTimeout } from '../../../utils/fetchWithTimeout';

const cache = new Map();
const TTL = 1000 * 60 * 5; // 5 minutes

const deriveAccessMode = (permission) => {
  if (PERMISSION_LEVELS.DIRECT.includes(permission)) {
    return 'direct';
  }
  if (PERMISSION_LEVELS.REVIEW.includes(permission)) {
    return 'review';
  }
  return 'readonly';
};

export const useProfilePermissions = (profileId) => {
  const [permission, setPermission] = useState(null);
  const [accessMode, setAccessMode] = useState('readonly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeProfileId = useRef(profileId);

  const fetchPermission = useCallback(async () => {
    if (!profileId) {
      setPermission(null);
      setAccessMode('readonly');
      setLoading(false);
      return 'readonly';
    }

    try {
      setLoading(true);
      setError(null);

      const cached = cache.get(profileId);
      const now = Date.now();
      if (cached && now - cached.at < TTL) {
        setPermission(cached.permission);
        setAccessMode(deriveAccessMode(cached.permission));
        setLoading(false);
        return cached.permission;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setPermission(null);
        setAccessMode('readonly');
        setLoading(false);
        cache.set(profileId, { permission: 'none', at: now });
        return 'none';
      }

      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!userProfile) {
        setPermission('none');
        setAccessMode('readonly');
        setLoading(false);
        cache.set(profileId, { permission: 'none', at: now });
        return 'none';
      }

      // Wrap permission check with 3-second timeout (typically fast with cache)
      const { data, error: permissionError } = await fetchWithTimeout(
        supabase.rpc('check_family_permission_v4', {
          p_user_id: userProfile.id,
          p_target_id: profileId,
        }),
        3000,
        'Check permissions'
      );

      if (permissionError) {
        throw permissionError;
      }

      const level = data || 'none';
      cache.set(profileId, { permission: level, at: Date.now() });
      setPermission(level);
      setAccessMode(deriveAccessMode(level));
      setLoading(false);
      return level;
    } catch (err) {
      console.error('useProfilePermissions error', err);
      setError(err);
      setPermission('none');
      setAccessMode('readonly');
      setLoading(false);
      return 'none';
    }
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    activeProfileId.current = profileId;
    fetchPermission();
  }, [profileId, fetchPermission]);

  const refresh = useCallback(async () => {
    cache.delete(profileId);
    return fetchPermission();
  }, [fetchPermission, profileId]);

  return {
    permission,
    accessMode,
    loading,
    error,
    refresh,
  };
};
