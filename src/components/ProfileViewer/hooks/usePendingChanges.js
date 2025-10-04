import { useEffect, useState, useCallback } from 'react';
import suggestionService from '../../../services/suggestionService';

export const usePendingChanges = (profileId, accessMode) => {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!profileId || accessMode === 'direct') {
      setPending([]);
      return;
    }

    try {
      setLoading(true);
      if (typeof suggestionService?.getProfileSuggestions !== 'function') {
        setPending([]);
        return;
      }
      const result = await suggestionService.getProfileSuggestions(
        profileId,
        'pending',
      );
      setPending(result || []);
    } catch (error) {
      console.warn('usePendingChanges error', error);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [profileId, accessMode]);

  useEffect(() => {
    load();
  }, [load]);

  return { pending, loading, refresh: load };
};
