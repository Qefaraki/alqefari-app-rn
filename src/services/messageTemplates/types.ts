/**
 * Message Template System Types
 *
 * Defines the structure for the dynamic WhatsApp message template system.
 * Templates can include variables like {name_chain}, {phone}, etc.
 */

/**
 * Categories for organizing templates
 */
export type TemplateCategory = 'support' | 'content' | 'notifications' | 'requests';

/**
 * Variable that can be used in a template
 */
export interface TemplateVariable {
  /** Variable key used in template (e.g., '{name_chain}') */
  key: string;

  /** Display label in Arabic */
  label: string;

  /** Description of what this variable represents */
  description?: string;

  /** Path to data source (e.g., 'profile.name_chain') */
  source: string;

  /** Example value for testing */
  example: string;

  /** Whether this variable must have a value */
  required: boolean;
}

/**
 * Message template configuration
 */
export interface MessageTemplate {
  /** Unique identifier (e.g., 'onboarding_help') */
  id: string;

  /** Display name in Arabic */
  name: string;

  /** Description of when/where this template is used */
  description: string;

  /** Category for grouping */
  category: TemplateCategory;

  /** Default template text (can include {variables}) */
  defaultMessage: string;

  /** Ionicons icon name */
  icon: string;

  /** AsyncStorage key for persisting custom message */
  storageKey: string;

  /** Variables available in this template */
  variables: TemplateVariable[];

  /** Whether admin can test this template */
  testable: boolean;

  /** Mock data for testing (if testable) */
  testMockData?: Record<string, any>;

  /** Display order in admin UI */
  order: number;
}

/**
 * Template with its current saved value
 */
export interface TemplateWithValue extends MessageTemplate {
  /** Current saved message (or default if not customized) */
  currentMessage: string;

  /** Whether message has been customized from default */
  isCustomized: boolean;
}

/**
 * Result of a template operation
 */
export interface TemplateOperationResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Validation result for template
 */
export interface TemplateValidationResult {
  valid: boolean;
  missingVariables: string[];
  errors: string[];
}

/**
 * Type-safe template IDs
 */
export type TemplateId =
  | 'onboarding_help'
  | 'article_suggestion'
  | 'profile_link_request'
  | 'contact_admin'
  | 'report_issue';
