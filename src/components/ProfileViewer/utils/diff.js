export const diffObjects = (original, draft) => {
  if (!original || !draft) return {};
  const changes = {};

  // CRITICAL: Exclude metadata fields from diff
  // These fields are auto-managed by the database/RPC and should not be in payload
  const METADATA_FIELDS = new Set([
    'version',      // Auto-incremented by admin_update_profile
    'updated_at',   // Auto-set by database trigger
    'updated_by',   // Auto-set by admin_update_profile
  ]);

  Object.keys(draft).forEach((key) => {
    if (METADATA_FIELDS.has(key)) return;  // Skip metadata fields

    const originalValue = original[key];
    const draftValue = draft[key];
    if (JSON.stringify(originalValue) !== JSON.stringify(draftValue)) {
      changes[key] = draftValue;
    }
  });
  return changes;
};

export const groupDirtyByTab = (dirtyFields, tabsConfig) => {
  const map = {};
  tabsConfig.forEach((tab) => {
    map[tab.id] = false;
  });

  dirtyFields.forEach((field) => {
    const tabEntry = tabsConfig.find((tab) => tab.fields?.includes(field));
    if (tabEntry) {
      map[tabEntry.id] = true;
    }
  });

  return map;
};
