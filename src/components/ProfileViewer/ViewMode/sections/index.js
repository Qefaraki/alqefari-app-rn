/**
 * Profile Viewer Sections - Pattern-Based Components
 *
 * Exports core patterns for flexible profile information display:
 *
 * Pattern 1: EnhancedHero
 * - Centered avatar + profile info + action buttons
 * - Social connectivity bar integrated (phone, WhatsApp, email, social media)
 * - Used at the top of profile sheet
 *
 * Pattern 2: BioSection
 * - 1000 char bio with 150 char preview + expand button
 * - Wikipedia-style biographical display
 *
 * Pattern 3: InlineFieldRow (+ DataFieldsSection variant)
 * - Flexible row with icon + text
 * - Supports unlimited multi-line text wrapping
 * - Base for all data field displays
 * - DataFieldsSection: wrapper for grouping multiple rows
 *
 * Pattern 4: LifeEventsSection
 * - Vertical timeline for birth/death events
 * - Flexible event heights with connecting lines
 * - Polished with larger dots and subtle card background
 */

export { default as EnhancedHero } from './EnhancedHero';
export { default as BioSection } from './BioSection';
export { default as InlineFieldRow } from './InlineFieldRow';
export { default as DataFieldsSection } from './DataFieldsSection';
export { default as LifeEventsSection } from './LifeEventsSection';
