// Utility to measure Arabic text width
// This approximates the width calculation from the web version

export function measureArabicText(text, fontSize = 11) {
  // Arabic characters are generally wider than Latin characters
  // This is a simplified calculation based on average character width
  const avgCharWidth = fontSize * 0.6; // Approximate width per character
  const padding = 12; // Extra padding for Arabic text
  
  // For Arabic text, we need to account for connected letters
  // which can make text slightly more compact
  const textWidth = text.length * avgCharWidth * 0.9;
  
  return Math.ceil(textWidth + padding);
}

// Get node width based on text content
export function getNodeWidth(name, hasPhoto = false) {
  if (hasPhoto) {
    return 85; // Fixed width for photo nodes
  }
  
  // Calculate width based on text length
  const minWidth = 60;
  const maxWidth = 120;
  const textWidth = measureArabicText(name);
  
  return Math.min(maxWidth, Math.max(minWidth, textWidth));
}