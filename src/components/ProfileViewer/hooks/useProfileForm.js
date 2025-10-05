import { useEffect, useMemo, useState, useCallback } from 'react';

const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));

export const useProfileForm = (person) => {
  const [original, setOriginal] = useState(() => clone(person));
  const [draft, setDraft] = useState(() => clone(person));
  const [touched, setTouched] = useState(() => new Set());

  useEffect(() => {
    setOriginal(clone(person));
    setDraft(clone(person));
    setTouched(new Set());
  }, [person?.id, person?.version]); // ✅ React to version changes

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
    setDraft(clone(original));
    setTouched(new Set());
  }, [original]);

  const isDirty = useMemo(() => {
    if (!person) return false;
    for (const key of touched) {
      const originalValue = original?.[key];
      const draftValue = draft?.[key];
      if (JSON.stringify(originalValue) !== JSON.stringify(draftValue)) {
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
      if (JSON.stringify(originalValue) !== JSON.stringify(draftValue)) {
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
