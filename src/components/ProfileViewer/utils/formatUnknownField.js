export const formatUnknownFieldValue = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  try {
    const json = JSON.stringify(value, null, 2);
    return json.length > 160 ? `${json.slice(0, 157)}...` : json;
  } catch (error) {
    return String(value);
  }
};
