import { supabase } from './supabase';

/**
 * Lookup place in place_standards by Arabic name
 * Returns normalized data matching current_residence_normalized structure
 *
 * @param {string} placeName - Arabic place name (city or country)
 * @returns {Promise<object|null>} Normalized data with structure:
 *   {
 *     original: string,
 *     country: { ar, en, code, id },
 *     city?: { ar, en, id },
 *     confidence: number
 *   }
 */
export const lookupPlaceByName = async (placeName) => {
  // Skip special values
  if (!placeName || placeName.startsWith('─') || placeName === 'دول أخرى') {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('search_place_autocomplete', {
      p_query: placeName,
      p_limit: 1,
    });

    if (error) {
      console.error('[locationLookup] RPC error:', error);
      return null;
    }

    if (!data || data.length === 0) {
      // Fallback: create basic normalized data without ID
      console.warn(`[locationLookup] No match found for "${placeName}", using fallback`);
      return {
        original: placeName,
        country: {
          ar: placeName,
          en: placeName,
          code: null,
          id: null,
        },
        confidence: 0.5, // Low confidence for unmatched
      };
    }

    // Return normalized_data from database
    const normalized = data[0].normalized_data || {};
    return {
      original: normalized.original || placeName,
      country: normalized.country || {
        ar: placeName,
        en: placeName,
        code: null,
        id: null,
      },
      ...(normalized.city && { city: normalized.city }),
      confidence: normalized.confidence ?? 1,
    };
  } catch (err) {
    console.error('[locationLookup] Unexpected error:', err);
    return null;
  }
};

export default lookupPlaceByName;
