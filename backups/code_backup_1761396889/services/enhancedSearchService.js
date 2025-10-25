import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

/**
 * Enhanced Search Service with recent searches, fuzzy matching, and navigation
 */
class EnhancedSearchService {
  constructor() {
    this.RECENT_SEARCHES_KEY = "@alqefari_recent_searches";
    this.MAX_RECENT_SEARCHES = 20;
    this.recentSearches = [];
    this.loadRecentSearches();
  }

  /**
   * Load recent searches from storage
   */
  async loadRecentSearches() {
    try {
      const stored = await AsyncStorage.getItem(this.RECENT_SEARCHES_KEY);
      if (stored) {
        this.recentSearches = JSON.parse(stored);
      }
    } catch (error) {
      console.error("Error loading recent searches:", error);
      this.recentSearches = [];
    }
  }

  /**
   * Save a search to recent searches
   * @param {Object} searchData - Search data to save
   */
  async saveToRecentSearches(searchData) {
    try {
      // Create search entry
      const entry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        query: searchData.query,
        names: searchData.names,
        resultCount: searchData.resultCount,
        selectedResult: searchData.selectedResult || null,
      };

      // Remove duplicates based on query
      this.recentSearches = this.recentSearches.filter(
        (s) => JSON.stringify(s.names) !== JSON.stringify(entry.names),
      );

      // Add to beginning
      this.recentSearches.unshift(entry);

      // Limit to max searches
      if (this.recentSearches.length > this.MAX_RECENT_SEARCHES) {
        this.recentSearches = this.recentSearches.slice(
          0,
          this.MAX_RECENT_SEARCHES,
        );
      }

      // Save to storage
      await AsyncStorage.setItem(
        this.RECENT_SEARCHES_KEY,
        JSON.stringify(this.recentSearches),
      );

      return true;
    } catch (error) {
      console.error("Error saving recent search:", error);
      return false;
    }
  }

  /**
   * Get recent searches
   * @param {number} limit - Maximum number of searches to return
   * @returns {Array} Recent searches
   */
  async getRecentSearches(limit = 10) {
    await this.loadRecentSearches(); // Refresh from storage
    return this.recentSearches.slice(0, limit);
  }

  /**
   * Clear all recent searches
   */
  async clearRecentSearches() {
    try {
      this.recentSearches = [];
      await AsyncStorage.removeItem(this.RECENT_SEARCHES_KEY);
      return true;
    } catch (error) {
      console.error("Error clearing recent searches:", error);
      return false;
    }
  }

  /**
   * Remove a specific recent search
   * @param {string} searchId - ID of the search to remove
   */
  async removeRecentSearch(searchId) {
    try {
      this.recentSearches = this.recentSearches.filter(
        (s) => s.id !== searchId,
      );
      await AsyncStorage.setItem(
        this.RECENT_SEARCHES_KEY,
        JSON.stringify(this.recentSearches),
      );
      return true;
    } catch (error) {
      console.error("Error removing recent search:", error);
      return false;
    }
  }

  /**
   * Search with the search_name_chain RPC function
   * The RPC already handles partial matching and Arabic normalization
   * @param {Array} names - Array of names to search
   * @param {Object} options - Search options
   * @returns {Promise<{data: Array, error: string|null}>}
   */
  async searchWithFuzzyMatching(names, options = {}) {
    try {
      const { limit = 20, offset = 0 } = options;

      console.log("🔍 RPC call params:", { p_names: names, p_limit: limit, p_offset: offset });

      // Single RPC call - it already handles partial matching and normalization
      const { data, error } = await supabase.rpc("search_name_chain", {
        p_names: names,
        p_limit: limit,
        p_offset: offset,
      });

      console.log("🔍 RPC response:", {
        success: !error,
        resultCount: data?.length || 0,
        hasError: !!error,
        errorMessage: error?.message
      });

      if (error) throw error;

      // Save to recent searches
      await this.saveToRecentSearches({
        query: names.join(" بن "),
        names,
        resultCount: data?.length || 0,
      });

      return { data: data || [], error: null };
    } catch (error) {
      console.error("Search error:", error);
      return { data: [], error: error.message };
    }
  }

  /**
   * Normalize Arabic names for fuzzy matching
   * @param {string} name - Name to normalize
   * @returns {string} Normalized name
   */
  normalizeArabicName(name) {
    if (!name) return "";

    // Remove common variations in Arabic text
    const normalized = name
      // Remove diacritics (tashkeel)
      .replace(/[\u064B-\u065F]/g, "")
      // Normalize alef variations
      .replace(/[أإآ]/g, "ا")
      // Normalize taa marbouta
      .replace(/ة/g, "ه")
      // Normalize yaa
      .replace(/ى/g, "ي")
      // Remove the definite article 'ال'
      .replace(/^ال/g, "")
      // Normalize spaces
      .replace(/\s+/g, " ")
      .trim();

    return normalized;
  }

  /**
   * Perform fuzzy search in the database
   * @param {Array} normalizedNames - Normalized names to search
   * @param {number} limit - Result limit
   * @param {boolean} includePartialMatches - Include partial matches
   * @returns {Promise<Array>} Search results
   */
  async performFuzzySearch(normalizedNames, limit, includePartialMatches) {
    try {
      // Build search patterns for each name
      const searchPatterns = normalizedNames
        .map((name) => {
          // Create variations for common misspellings
          const variations = this.generateNameVariations(name);
          return variations;
        })
        .flat();

      // Query the database with variations
      let query = supabase
        .from("profiles")
        .select("*")
        .is("deleted_at", null)
        .not("hid", "is", null); // Munasib profiles have NULL HID; exclude them from tree search (see docs/system-docs/munasib-system-documentation.md)

      // Add OR conditions for each variation
      if (searchPatterns.length > 0) {
        const orConditions = searchPatterns
          .map((pattern) => `name.ilike.%${pattern}%`)
          .join(",");

        query = query.or(orConditions);
      }

      const { data, error } = await query.limit(limit);

      if (error) throw error;

      // Score and sort results by relevance
      const filteredResults = (data || []).filter((result) => result?.hid);

      const scoredResults = this.scoreSearchResults(
        filteredResults,
        normalizedNames,
      );

      return scoredResults;
    } catch (error) {
      console.error("Fuzzy search error:", error);
      return [];
    }
  }

  /**
   * Generate name variations for fuzzy matching
   * @param {string} name - Name to generate variations for
   * @returns {Array<string>} Name variations
   */
  generateNameVariations(name) {
    const variations = [name];

    // Common substitutions in Arabic names
    const substitutions = [
      { from: "عبدالله", to: "عبد الله" },
      { from: "عبدالرحمن", to: "عبد الرحمن" },
      { from: "عبدالعزيز", to: "عبد العزيز" },
      { from: "محمد", to: "محمّد" },
      { from: "احمد", to: "أحمد" },
      { from: "ابراهيم", to: "إبراهيم" },
      { from: "اسماعيل", to: "إسماعيل" },
    ];

    // Apply substitutions
    substitutions.forEach((sub) => {
      if (name.includes(sub.from)) {
        variations.push(name.replace(sub.from, sub.to));
      }
      if (name.includes(sub.to)) {
        variations.push(name.replace(sub.to, sub.from));
      }
    });

    // Add with/without 'ال' prefix
    if (!name.startsWith("ال")) {
      variations.push(`ال${  name}`);
    }

    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Score search results by relevance
   * @param {Array} results - Search results
   * @param {Array} searchTerms - Search terms
   * @returns {Array} Scored and sorted results
   */
  scoreSearchResults(results, searchTerms) {
    const scoredResults = results.map((result) => {
      let score = 0;
      const resultName = this.normalizeArabicName(result.name || "");

      // Check each search term
      searchTerms.forEach((term) => {
        if (resultName === term) {
          score += 10; // Exact match
        } else if (resultName.includes(term)) {
          score += 5; // Contains match
        } else if (this.calculateSimilarity(resultName, term) > 0.7) {
          score += 3; // Similar match
        }
      });

      // Bonus for generation (prefer recent generations)
      if (result.generation) {
        score += 10 - Math.min(result.generation, 10);
      }

      return { ...result, relevanceScore: score };
    });

    // Sort by score descending
    return scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate similarity between two strings (Levenshtein distance based)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 1.0;
    }

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Combine and deduplicate search results
   * @param {Array} exactResults - Exact match results
   * @param {Array} fuzzyResults - Fuzzy match results
   * @returns {Array} Combined unique results
   */
  combineAndDeduplicateResults(exactResults, fuzzyResults) {
    const seen = new Set();
    const combined = [];

    // Add exact results first (higher priority)
    exactResults.forEach((result) => {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        combined.push({ ...result, matchType: "exact" });
      }
    });

    // Add fuzzy results
    fuzzyResults.forEach((result) => {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        combined.push({ ...result, matchType: "fuzzy" });
      }
    });

    return combined;
  }

  /**
   * Get search suggestions based on partial input
   * @param {string} partialName - Partial name input
   * @param {number} limit - Maximum suggestions
   * @returns {Promise<Array>} Suggestions
   */
  async getSearchSuggestions(partialName, limit = 5) {
    try {
      if (!partialName || partialName.length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, hid, generation")
        .ilike("name", `${partialName}%`)
        .limit(limit)
        .order("generation", { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error("Error getting search suggestions:", error);
      return [];
    }
  }

  /**
   * Search for profiles related to a specific person
   * @param {string} profileId - Profile ID to find relatives for
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Related profiles grouped by relationship
   */
  async findRelatives(profileId, options = {}) {
    try {
      const {
        includeParents = true,
        includeChildren = true,
        includeSiblings = true,
        includeSpouses = true,
      } = options;

      const relatives = {
        parents: [],
        children: [],
        siblings: [],
        spouses: [],
      };

      // Get the profile first
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .single();

      if (profileError) throw profileError;

      // Get parents
      if (includeParents && (profile.father_id || profile.mother_id)) {
        const parentIds = [profile.father_id, profile.mother_id].filter(
          Boolean,
        );
        const { data: parents } = await supabase
          .from("profiles")
          .select("*")
          .in("id", parentIds);

        relatives.parents = parents || [];
      }

      // Get children
      if (includeChildren) {
        const { data: children } = await supabase
          .from("profiles")
          .select("*")
          .or(`father_id.eq.${profileId},mother_id.eq.${profileId}`)
          .order("sibling_order", { ascending: true });

        relatives.children = children || [];
      }

      // Get siblings
      if (includeSiblings && (profile.father_id || profile.mother_id)) {
        const { data: siblings } = await supabase
          .from("profiles")
          .select("*")
          .or(
            `father_id.eq.${profile.father_id},mother_id.eq.${profile.mother_id}`,
          )
          .neq("id", profileId)
          .order("sibling_order", { ascending: true });

        relatives.siblings = siblings || [];
      }

      // Get spouses
      if (includeSpouses) {
        const { data: marriages } = await supabase
          .from("marriages")
          .select(
            `
            *,
            husband:husband_id(*),
            wife:wife_id(*)
          `,
          )
          .or(`husband_id.eq.${profileId},wife_id.eq.${profileId}`);

        if (marriages) {
          relatives.spouses = marriages
            .map((m) => {
              return m.husband_id === profileId ? m.wife : m.husband;
            })
            .filter(Boolean);
        }
      }

      return { data: relatives, error: null };
    } catch (error) {
      console.error("Error finding relatives:", error);
      return { data: null, error: error.message };
    }
  }
}

export default new EnhancedSearchService();
