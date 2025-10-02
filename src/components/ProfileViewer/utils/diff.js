export const diffObjects = (original, draft) => {
  if (!original || !draft) return {};
  const changes = {};
  Object.keys(draft).forEach((key) => {
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
