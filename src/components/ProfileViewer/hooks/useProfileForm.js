import { useEffect, useMemo, useState, useCallback } from 'react';
import { fastEqual, deepClone } from './utils/equality';

export const useProfileForm = (person) => {
  const [original, setOriginal] = useState(() => deepClone(person));
  const [draft, setDraft] = useState(() => deepClone(person));
  const [touched, setTouched] = useState(() => new Set());

  useEffect(() => {
    // ⚠️ CRITICAL: Skip reset if draft has unsaved changes
    // This prevents store updates (from photo deletion, etc.) from erasing
    // user's uncommitted edits during an active edit session
    if (touched.size > 0) {
      console.warn('[useProfileForm] Skipping reset - draft has unsaved changes');
      return;
    }

    setOriginal(deepClone(person));
    setDraft(deepClone(person));
    setTouched(new Set());
  }, [person?.id, person?.version, touched.size]); // ✅ React to version changes + guard on touched

  const updateField = useCallback((key, value) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
    setTouched((prev) => {
      const next = new Set(Array.from(prev));
      next.add(key);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    // Always reset from current person prop, not cached original
    // This ensures we get latest data even if original hasn't updated yet
    setOriginal(deepClone(person));
    setDraft(deepClone(person));
    setTouched(new Set());
  }, [person]);

  const isDirty = useMemo(() => {
    if (!person) return false;
    for (const key of touched) {
      const originalValue = original?.[key];
      const draftValue = draft?.[key];
      // Fast equality check - primitives first, deep check only if needed
      if (!fastEqual(originalValue, draftValue)) {
        return true;
      }
    }
    return false;
  }, [draft, original, person, touched]);

  const dirtyFields = useMemo(() => {
    const result = new Set();
    for (const key of touched) {
      const originalValue = original?.[key];
      const draftValue = draft?.[key];
      // Fast equality check - primitives first, deep check only if needed
      if (!fastEqual(originalValue, draftValue)) {
        result.add(key);
      }
    }
    return result;
  }, [draft, original, touched]);

  const getChanges = useCallback(() => {
    const changes = {};
    dirtyFields.forEach((key) => {
      changes[key] = draft[key];
    });
    return changes;
  }, [draft, dirtyFields]);

  return {
    original,
    draft,
    updateField,
    reset,
    isDirty,
    dirtyFields,
    getChanges,
    setDraft,
  };
};
