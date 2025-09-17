# Arabic Name Chain Search - Complete UX Design

## Search Result Display Requirements

### Each Result Card Shows:

1. **Full Name Chain** - Up to 7 generations displayed elegantly
2. **Generation Number** - Badge showing their generation (e.g., "الجيل ٧")
3. **Profile Photo** - Circular 60x60 photo with fallback initials
4. **Relationship Path** - Optional: "ابن عم من الدرجة الثانية"
5. **Age/Birth Year** - If available, in corner (e.g., "١٤٠٥ هـ")
6. **Match Strength** - Visual indicator of how well it matches

### UI Design - Premium iOS Style

```javascript
const SearchResultCard = ({
  id,
  name,
  nameChain, // "محمد بن عبدالله بن سالم بن أحمد"
  generation,
  photoUrl,
  birthYear,
  matchScore,
  onPress,
}) => (
  <Pressable onPress={onPress} style={styles.resultCard}>
    {/* Left: Photo */}
    <View style={styles.photoContainer}>
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.initials}>{getInitials(name)}</Text>
        </View>
      )}
    </View>

    {/* Center: Name Info */}
    <View style={styles.infoContainer}>
      <Text style={styles.primaryName}>{name}</Text>
      <Text style={styles.nameChain} numberOfLines={2}>
        {nameChain}
      </Text>
      <View style={styles.metaRow}>
        <Badge text={`الجيل ${generation}`} />
        {birthYear && <Text style={styles.year}>{birthYear} هـ</Text>}
      </View>
    </View>

    {/* Right: Match Score */}
    <View style={styles.scoreContainer}>
      <MatchIndicator score={matchScore} />
    </View>
  </Pressable>
);
```

## Navigation to Tree Node - The Golden Highlight Effect

### User Flow:

1. User taps search result
2. Search modal dismisses with fade animation
3. Tree smoothly pans and zooms to center the node
4. Node gets golden highlight effect for 2 seconds
5. Subtle haptic feedback confirms selection

### Implementation:

```javascript
// In TreeView.js - Add highlight capability
const highlightedNodeId = useSharedValue(null);
const highlightOpacity = useSharedValue(0);

const highlightNode = useCallback((nodeId) => {
  // Set the highlighted node
  highlightedNodeId.value = nodeId;

  // Animate highlight
  highlightOpacity.value = withSequence(
    withTiming(1, { duration: 300 }), // Fade in
    withTiming(0.8, { duration: 1400 }), // Hold with subtle pulse
    withTiming(0, { duration: 300 }), // Fade out
  );

  // Haptic feedback
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}, []);

// In renderNode - Add golden outline
const renderNodeWithHighlight = (node) => {
  const isHighlighted = highlightedNodeId.value === node.id;

  return (
    <Group>
      {/* Golden highlight ring */}
      {isHighlighted && (
        <Circle
          cx={node.x}
          cy={node.y}
          r={nodeRadius + 8}
          color="gold"
          style="stroke"
          strokeWidth={3}
          opacity={highlightOpacity}
        />
      )}

      {/* Regular node rendering */}
      {renderNode(node)}
    </Group>
  );
};
```

### Navigation Function:

```javascript
const navigateToNode = useCallback(
  (nodeId) => {
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    // Calculate center position
    const targetX = viewport.width / 2 - targetNode.x;
    const targetY = viewport.height / 2 - targetNode.y;
    const targetScale = 1.5; // Zoom in slightly for focus

    // Smooth animation to node
    translateX.value = withTiming(targetX, {
      duration: 800,
      easing: Easing.inOut(Easing.cubic),
    });
    translateY.value = withTiming(targetY, {
      duration: 800,
      easing: Easing.inOut(Easing.cubic),
    });
    scale.value = withTiming(targetScale, {
      duration: 800,
      easing: Easing.inOut(Easing.cubic),
    });

    // Trigger highlight after navigation
    setTimeout(() => highlightNode(nodeId), 850);
  },
  [nodes, viewport],
);
```

## Search Modal Design

### Progressive Input Fields:

```javascript
const SearchModal = () => {
  const [nameInputs, setNameInputs] = useState([
    { id: 1, value: "", placeholder: "الاسم الأول" },
  ]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addNameField = (index) => {
    const placeholders = [
      "الاسم الأول",
      "اسم الأب",
      "اسم الجد",
      "اسم جد الأب",
      "اسم جد الجد",
    ];

    if (nameInputs[index].value && nameInputs.length < 7) {
      setNameInputs([
        ...nameInputs,
        {
          id: Date.now(),
          value: "",
          placeholder: placeholders[nameInputs.length] || "اسم آخر",
        },
      ]);
    }
  };

  return (
    <Modal animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>البحث بسلسلة الأسماء</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} />
          </Pressable>
        </View>

        {/* Progressive Name Inputs */}
        <ScrollView style={styles.inputsContainer}>
          {nameInputs.map((input, index) => (
            <View key={input.id} style={styles.inputRow}>
              <TextInput
                style={styles.nameInput}
                placeholder={input.placeholder}
                value={input.value}
                onChangeText={(text) => {
                  updateInput(index, text);
                  if (text && index === nameInputs.length - 1) {
                    addNameField(index);
                  }
                }}
                autoFocus={index === 0}
              />
              {input.value && (
                <Animated.View entering={FadeIn}>
                  <Ionicons name="checkmark-circle" size={20} color="green" />
                </Animated.View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Results Count */}
        {results.length > 0 && (
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              عدد النتائج: {toArabicNumerals(results.length)}
            </Text>
            {results.length > 20 && (
              <Text style={styles.hint}>
                أضف المزيد من الأسماء لتضييق النتائج
              </Text>
            )}
          </View>
        )}

        {/* Results List */}
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <SearchResultCard
              {...item}
              onPress={() => handleSelectResult(item)}
            />
          )}
          contentContainerStyle={styles.resultsList}
        />

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>جاري البحث...</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};
```

## UX Considerations & Best Practices

### 1. **Search Speed Perception**

- Show loading state immediately (even if cached)
- Display partial results as they arrive
- Use skeleton loaders for smooth transitions
- Implement optimistic UI updates

### 2. **Error Recovery**

- "No results" should suggest alternatives
- Offer "Did you mean?" for common misspellings
- Provide clear messaging for network errors
- Allow offline search with cached data

### 3. **Visual Hierarchy**

- Primary name in large, bold font
- Name chain in smaller, gray text
- Generation badge with accent color
- Match score with visual indicator (dots/stars)

### 4. **Interaction Feedback**

- Haptic feedback on result tap
- Smooth dismiss animation for modal
- Loading shimmer effect
- Success haptic when node found

### 5. **Accessibility**

- VoiceOver support for screen readers
- Minimum touch target 44x44 points
- High contrast text (WCAG AA)
- Dynamic Type support

### 6. **Performance Optimizations**

- Virtualized list for results (FlatList)
- Image lazy loading with placeholders
- Debounced search (500ms)
- Cancel previous search on new input

## SQL Function Updates

```sql
CREATE OR REPLACE FUNCTION search_name_chain_with_details(
  p_names TEXT[],
  p_limit INT DEFAULT 20
) RETURNS TABLE (
  id UUID,
  name TEXT,
  name_chain TEXT,
  generation INT,
  photo_url TEXT,
  birth_year_hijri INT,
  death_year_hijri INT,
  match_score FLOAT,
  father_name TEXT,
  grandfather_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE ancestry AS (
    -- Build name chains dynamically
    SELECT
      p.id,
      p.name,
      p.father_id,
      ARRAY[p.name] as name_array,
      p.name as current_chain,
      1 as depth,
      p.generation,
      p.photo_url,
      p.birth_year_hijri,
      p.death_year_hijri
    FROM profiles p
    WHERE p.deleted_at IS NULL

    UNION ALL

    SELECT
      a.id,
      a.name,
      parent.father_id,
      a.name_array || parent.name,
      a.current_chain || ' بن ' || parent.name,
      a.depth + 1,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri
    FROM ancestry a
    JOIN profiles parent ON parent.id = a.father_id
    WHERE a.depth < 7
      AND parent.deleted_at IS NULL
  ),
  matches AS (
    SELECT DISTINCT ON (a.id)
      a.id,
      a.name,
      a.current_chain as name_chain,
      a.generation,
      a.photo_url,
      a.birth_year_hijri,
      a.death_year_hijri,
      -- Calculate match score
      (
        SELECT COUNT(*)::FLOAT / array_length(p_names, 1)::FLOAT
        FROM unnest(p_names) AS search_name
        WHERE search_name = ANY(a.name_array)
      ) as match_score,
      a.name_array[2] as father_name,
      a.name_array[3] as grandfather_name
    FROM ancestry a
    WHERE
      -- All search names must be in the chain
      p_names <@ a.name_array
    ORDER BY a.id, a.depth DESC
  )
  SELECT
    m.id,
    m.name,
    m.name_chain,
    m.generation,
    m.photo_url,
    m.birth_year_hijri,
    m.death_year_hijri,
    m.match_score,
    m.father_name,
    m.grandfather_name
  FROM matches m
  WHERE m.match_score = 1.0  -- All names must match
  ORDER BY
    m.generation DESC,  -- Recent generations first
    m.match_score DESC,
    m.name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Animation Specifications

### Golden Highlight Effect:

```javascript
// Skia shader for golden glow
const goldenGlow = {
  color: "#FFD700",
  shadowColor: "#FFA500",
  shadowBlur: 20,
  shadowOpacity: 0.6,
  pulseAnimation: {
    duration: 2000,
    keyframes: [
      { opacity: 0, scale: 1, time: 0 },
      { opacity: 1, scale: 1.1, time: 0.15 },
      { opacity: 0.8, scale: 1.05, time: 0.7 },
      { opacity: 0, scale: 1, time: 1 },
    ],
  },
};
```

### Modal Transitions:

- **Entry**: Slide up with spring physics (500ms)
- **Exit**: Fade + scale down (300ms)
- **Result tap**: Scale feedback (0.95 → 1.0)

## Monitoring & Analytics

Track these metrics:

1. **Search performance**: p50, p95, p99 latency
2. **Result relevance**: Click-through rate
3. **User behavior**: Names added before finding target
4. **Error rate**: Failed searches, timeouts
5. **Navigation success**: Did user stay on found node?

## Future Enhancements

1. **Voice Search** - "ابحث عن محمد بن عبدالله"
2. **Recent Searches** - Quick access to history
3. **Fuzzy Matching** - Handle spelling variations
4. **Smart Suggestions** - "People also searched for"
5. **Relationship Calculator** - Show exact relationship
6. **Share Result** - Send location to family member
