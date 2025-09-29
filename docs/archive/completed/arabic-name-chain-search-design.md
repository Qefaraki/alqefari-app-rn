# Arabic Name Chain Search System Design

## Overview

A scalable search system for finding family members using Arabic naming chains (نسب), designed to handle thousands of nodes efficiently with progressive filtering.

## Use Case

When meeting a relative, they provide their name chain:

- First name (الاسم الأول)
- Father's name (اسم الأب)
- Grandfather's name (اسم الجد)
- Great-grandfather's name (اسم جد الأب)
- And so on...

Users progressively add names to narrow down results from potentially hundreds to the exact person.

## Architecture Decision

### Option 1: PostgreSQL Full-Text Search (Recommended) ✅

**Pros:**

- Native to our Supabase stack
- Supports Arabic text natively with proper collation
- Can index millions of records efficiently
- Built-in ranking and relevance scoring
- No additional services to maintain
- Free with Supabase

**Implementation:**

- Use PostgreSQL's `tsvector` for indexing name chains
- Create GIN indexes for fast lookups
- Implement custom ranking based on chain match depth
- Cache computed name chains in database

### Option 2: Algolia/Typesense

**Pros:**

- Purpose-built for search
- Typo tolerance and fuzzy matching
- Real-time indexing

**Cons:**

- Additional service dependency
- Extra cost ($500+/month for scale)
- Data sync complexity
- Overkill for exact name matching

### Option 3: Elasticsearch

**Pros:**

- Powerful text analysis
- Great for complex queries

**Cons:**

- Heavy infrastructure
- Complex to maintain
- Expensive hosting
- Overkill for our use case

## Recommended Implementation

### 1. Database Schema Enhancement

```sql
-- Add computed name chain column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  name_chain TEXT GENERATED ALWAYS AS (
    -- Concatenate name with all ancestors
    name || ' ' ||
    COALESCE((SELECT name FROM profiles WHERE id = profiles.father_id), '') || ' ' ||
    COALESCE((SELECT name FROM profiles WHERE id = (SELECT father_id FROM profiles WHERE id = profiles.father_id)), '')
    -- Continue for 5-7 generations
  ) STORED;

-- Create GIN index for full-text search
CREATE INDEX idx_name_chain_search ON profiles
  USING gin(to_tsvector('arabic', name_chain));

-- Create trigram index for partial matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_name_chain_trgm ON profiles
  USING gin(name_chain gin_trgm_ops);
```

### 2. Search Function with Ranking

```sql
CREATE OR REPLACE FUNCTION search_name_chain(
  p_names TEXT[], -- Array of names in the chain
  p_limit INT DEFAULT 20
) RETURNS TABLE (
  id UUID,
  hid TEXT,
  name TEXT,
  full_name_chain TEXT,
  match_score FLOAT,
  match_depth INT,
  father_name TEXT,
  grandfather_name TEXT,
  photo_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH recursive ancestry AS (
    -- Build complete name chains for each profile
    SELECT
      p.id,
      p.hid,
      p.name,
      p.father_id,
      p.name as name_chain,
      1 as depth
    FROM profiles p
    WHERE p.deleted_at IS NULL

    UNION ALL

    SELECT
      a.id,
      a.hid,
      a.name,
      p.father_id,
      a.name_chain || ' بن ' || p.name,
      a.depth + 1
    FROM ancestry a
    JOIN profiles p ON p.id = a.father_id
    WHERE a.depth < 7 -- Limit to 7 generations
  ),
  scored_results AS (
    SELECT DISTINCT ON (a.id)
      a.id,
      a.hid,
      a.name,
      a.name_chain,
      -- Calculate match score based on how many names match
      (
        SELECT COUNT(*)::FLOAT / array_length(p_names, 1)::FLOAT
        FROM unnest(p_names) AS search_name
        WHERE a.name_chain ILIKE '%' || search_name || '%'
      ) as match_score,
      -- Calculate match depth (how deep in chain the match occurs)
      array_length(string_to_array(a.name_chain, ' بن '), 1) as match_depth
    FROM ancestry a
    WHERE
      -- All provided names must be in the chain
      (
        SELECT bool_and(a.name_chain ILIKE '%' || search_name || '%')
        FROM unnest(p_names) AS search_name
      )
    ORDER BY a.id, a.depth DESC
  )
  SELECT
    s.id,
    s.hid,
    s.name,
    s.name_chain as full_name_chain,
    s.match_score,
    s.match_depth,
    father.name as father_name,
    grandfather.name as grandfather_name,
    p.photo_url
  FROM scored_results s
  JOIN profiles p ON p.id = s.id
  LEFT JOIN profiles father ON father.id = p.father_id
  LEFT JOIN profiles grandfather ON grandfather.id = father.father_id
  WHERE s.match_score > 0
  ORDER BY
    s.match_score DESC,  -- Prioritize more complete matches
    s.match_depth ASC,   -- Then prefer shorter chains (more recent)
    s.name ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Optimizations

#### Materialized View for Name Chains (Optional for 10k+ profiles)

```sql
CREATE MATERIALIZED VIEW mv_name_chains AS
WITH RECURSIVE ancestry AS (
  -- Pre-compute all name chains
  -- Refresh periodically or on profile updates
);

CREATE INDEX ON mv_name_chains USING gin(to_tsvector('arabic', name_chain));
```

#### Caching Strategy

- Cache search results in app for 5 minutes
- Use Zustand store for client-side result caching
- Implement debouncing (500ms) to reduce API calls

### 4. UI/UX Design

```javascript
// Progressive name input component
const NameChainSearch = () => {
  const [nameInputs, setNameInputs] = useState([""]); // Start with one input
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Add new name input when user fills current one
  const handleNameChange = (index, value) => {
    const newInputs = [...nameInputs];
    newInputs[index] = value;

    // Auto-add new input if last one has content
    if (index === nameInputs.length - 1 && value) {
      newInputs.push("");
    }

    setNameInputs(newInputs);
    debouncedSearch(newInputs.filter((n) => n)); // Search with non-empty names
  };

  // Visual feedback showing narrowing results
  return (
    <View>
      {nameInputs.map((name, index) => (
        <TextInput
          key={index}
          placeholder={getPlaceholder(index)} // "الاسم", "اسم الأب", etc.
          value={name}
          onChangeText={(val) => handleNameChange(index, val)}
        />
      ))}

      <ResultCount>
        {results.length > 0 && `عدد النتائج: ${results.length}`}
      </ResultCount>

      <ResultsList results={results} />
    </View>
  );
};
```

## Performance Targets

- **Search latency**: < 100ms for 10,000 profiles
- **Scale**: Support up to 100,000 profiles without degradation
- **Concurrent users**: Handle 100+ simultaneous searches
- **Result accuracy**: 95%+ match rate for complete name chains

## Implementation Phases

### Phase 1: Basic Search (MVP)

- Simple ILIKE matching on concatenated names
- Basic UI with progressive inputs
- 20 result limit

### Phase 2: Advanced Ranking

- Implement scoring algorithm
- Add fuzzy matching for spelling variations
- Show relationship paths in results

### Phase 3: Performance Optimization

- Add materialized views for large trees
- Implement Redis caching
- Add search analytics

## Alternative Solutions Considered

### 1. Client-Side Search

- Download entire tree and search locally
- ❌ Not scalable beyond 1000 profiles
- ❌ High memory usage on mobile

### 2. Graph Database (Neo4j)

- Natural for relationship traversal
- ❌ Complex infrastructure
- ❌ Not supported by Supabase

### 3. Dedicated Search Service

- Algolia, Typesense, or Meilisearch
- ❌ Additional cost and complexity
- ❌ Overkill for exact name matching

## Conclusion

PostgreSQL with proper indexing provides the best balance of:

- Performance (sub-100ms searches)
- Scalability (100k+ profiles)
- Maintainability (single database)
- Cost (no additional services)
- Arabic support (native collation)

The progressive filtering UX matches the natural way Arabic names are communicated, making it intuitive for users to find family members even in large trees.
