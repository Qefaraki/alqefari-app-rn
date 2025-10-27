/**
 * URL Validation Utilities
 *
 * Security utilities for validating URLs before use in Image.prefetch(), fetch(), or other
 * network operations. Prevents common attacks: path traversal, external URL injection,
 * data URIs, javascript: URIs, and malicious redirects.
 *
 * @module urlValidation
 */

/**
 * Validates that a photo URL is from trusted Supabase storage
 *
 * Security checks:
 * 1. Must be HTTPS (no http://, file://, data:, javascript:)
 * 2. Must be from Supabase storage domain (<project-ref>.supabase.co)
 * 3. Must be from /storage/v1/object/ path (not API endpoints)
 * 4. No path traversal attempts (../)
 * 5. No redirect parameters (common injection vector)
 *
 * @param url - URL to validate
 * @returns True if URL is safe for Image.prefetch()
 *
 * @example
 * // Valid Supabase storage URL
 * isValidSupabasePhotoUrl('https://abc123.supabase.co/storage/v1/object/public/profiles/photo.jpg')
 * // Returns: true
 *
 * @example
 * // Invalid: External domain
 * isValidSupabasePhotoUrl('https://evil.com/photo.jpg')
 * // Returns: false
 *
 * @example
 * // Invalid: Path traversal
 * isValidSupabasePhotoUrl('https://abc123.supabase.co/storage/../admin/secrets.json')
 * // Returns: false
 */
export function isValidSupabasePhotoUrl(url: string): boolean {
  // Null/undefined/empty check
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    console.warn('[URLValidation] Empty or invalid URL type:', typeof url);
    return false;
  }

  try {
    // Parse URL (throws if malformed)
    const parsedUrl = new URL(url);

    // Check 1: Must be HTTPS
    if (parsedUrl.protocol !== 'https:') {
      console.warn('[URLValidation] Non-HTTPS protocol:', parsedUrl.protocol);
      return false;
    }

    // Check 2: Must be Supabase storage domain
    // Pattern: https://<project-ref>.supabase.co/storage/v1/object/<bucket>/<path>
    // Example: https://ezkioroyhzpavmbfavyn.supabase.co/storage/v1/object/public/profile-photos/...
    const SUPABASE_STORAGE_PATTERN = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/(public|authenticated)\//;

    if (!SUPABASE_STORAGE_PATTERN.test(url)) {
      console.warn('[URLValidation] Not a Supabase storage URL:', url);
      console.warn('[URLValidation] Expected pattern: https://<project>.supabase.co/storage/v1/object/...');
      return false;
    }

    // Check 3: No path traversal attempts
    if (parsedUrl.pathname.includes('..')) {
      console.warn('[URLValidation] Path traversal attempt detected:', parsedUrl.pathname);
      return false;
    }

    // Check 4: No encoded path traversal (URL-encoded ..)
    const decodedPath = decodeURIComponent(parsedUrl.pathname);
    if (decodedPath.includes('..')) {
      console.warn('[URLValidation] Encoded path traversal detected:', decodedPath);
      return false;
    }

    // Check 5: No redirect parameters (common injection vector)
    const suspiciousParams = ['redirect', 'url', 'return', 'next', 'goto'];
    for (const param of suspiciousParams) {
      if (parsedUrl.searchParams.has(param)) {
        console.warn('[URLValidation] Suspicious parameter detected:', param);
        return false;
      }
    }

    // Check 6: No null bytes (can cause weird behavior in some systems)
    if (url.includes('\0') || url.includes('%00')) {
      console.warn('[URLValidation] Null byte detected in URL');
      return false;
    }

    // All checks passed
    return true;
  } catch (error) {
    // URL() constructor throws on invalid URLs
    console.warn('[URLValidation] Invalid URL format:', url, error);
    return false;
  }
}

/**
 * Validates that a URL is safe for general use (not Supabase-specific)
 *
 * More permissive than isValidSupabasePhotoUrl(). Allows any HTTPS URL from
 * any domain, but still blocks dangerous protocols and path traversal.
 *
 * Use this for: External API calls, webhook URLs, general URL validation
 * Don't use for: Image URLs (use isValidSupabasePhotoUrl instead)
 *
 * @param url - URL to validate
 * @returns True if URL is HTTPS with no obvious attacks
 *
 * @example
 * isValidHttpsUrl('https://example.com/api/endpoint')
 * // Returns: true
 *
 * @example
 * isValidHttpsUrl('javascript:alert(1)')
 * // Returns: false
 */
export function isValidHttpsUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    // Must be HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return false;
    }

    // No path traversal
    if (parsedUrl.pathname.includes('..')) {
      return false;
    }

    // No null bytes
    if (url.includes('\0') || url.includes('%00')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard: Checks if URL is a data URI
 *
 * Data URIs can be used for XSS attacks (especially data:text/html or data:image/svg+xml)
 * This function helps detect and reject them.
 *
 * @param url - URL to check
 * @returns True if URL is a data: URI
 *
 * @example
 * isDataUri('data:image/png;base64,iVBORw0KG...')
 * // Returns: true
 *
 * @example
 * isDataUri('https://example.com/image.png')
 * // Returns: false
 */
export function isDataUri(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  return url.trim().toLowerCase().startsWith('data:');
}

/**
 * Type guard: Checks if URL uses javascript: protocol
 *
 * javascript: URLs are a common XSS vector and should never be used in href,
 * src, or Image.prefetch() calls.
 *
 * @param url - URL to check
 * @returns True if URL uses javascript: protocol
 *
 * @example
 * isJavascriptUri('javascript:alert(1)')
 * // Returns: true
 *
 * @example
 * isJavascriptUri('https://example.com')
 * // Returns: false
 */
export function isJavascriptUri(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  return url.trim().toLowerCase().startsWith('javascript:');
}

/**
 * Sanitizes a URL by rejecting dangerous protocols
 *
 * This is a defensive utility that returns null if the URL is unsafe,
 * otherwise returns the original URL unchanged.
 *
 * @param url - URL to sanitize
 * @returns Original URL if safe, null if dangerous
 *
 * @example
 * sanitizeUrl('https://example.com')
 * // Returns: 'https://example.com'
 *
 * @example
 * sanitizeUrl('javascript:alert(1)')
 * // Returns: null
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Reject dangerous protocols
  if (isJavascriptUri(url) || isDataUri(url)) {
    return null;
  }

  // Reject non-HTTPS
  if (!url.startsWith('https://')) {
    return null;
  }

  return url;
}
