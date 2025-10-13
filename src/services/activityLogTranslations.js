/**
 * Activity Log Field Translations
 * Maps database field names to user-friendly Arabic labels
 * Categorizes fields for better organization in activity logs
 */

// Field name translations (database field → Arabic label)
export const FIELD_LABELS = {
  // Personal Information
  name: 'الاسم',
  kunya: 'الكنية',
  laqab: 'اللقب',
  gender: 'الجنس',

  // Professional Titles
  professional_title: 'المسمى الوظيفي',
  professional_title_label: 'اللقب المهني',

  // Contact Information
  phone: 'رقم الجوال',
  email: 'البريد الإلكتروني',

  // Dates
  date_of_birth: 'تاريخ الميلاد',
  date_of_death: 'تاريخ الوفاة',

  // Family Relationships
  father_id: 'الأب',
  mother_id: 'الأم',

  // Location
  birthplace: 'مكان الميلاد',
  current_residence: 'مكان الإقامة الحالي',

  // Biography
  bio: 'نبذة شخصية',
  achievements: 'الإنجازات',
  timeline: 'السيرة الذاتية',

  // Status
  status: 'الحالة',
  is_verified: 'التحقق',

  // System fields
  hid: 'رقم التسلسل',
  role: 'الدور',
  can_edit: 'صلاحية التعديل',
  is_moderator: 'مشرف فرع',
  moderated_branch: 'الفرع المشرف عليه',

  // Media
  photo_url: 'الصورة الشخصية',

  // Metadata
  created_at: 'تاريخ الإنشاء',
  updated_at: 'آخر تحديث',

  // Additional fields from recent migrations
  dob_data: 'بيانات الميلاد',
  dod_data: 'بيانات الوفاة',
  social_media_links: 'روابط التواصل الاجتماعي',
  nickname: 'اللقب',
  profile_visibility: 'خصوصية الملف',
  dob_is_public: 'نشر تاريخ الميلاد',
  birth_date: 'تاريخ الميلاد',
  death_date: 'تاريخ الوفاة',
  biography: 'السيرة الذاتية',
  claim_status: 'حالة المطالبة',
  search_vector: 'فهرس البحث',
  layout_position: 'موقع في الشجرة',
  occupation: 'المهنة',
  education: 'التعليم',
  user_id: 'معرف المستخدم',
};

// Field categories for grouping
export const FIELD_CATEGORIES = {
  personal: {
    label: 'معلومات شخصية',
    fields: ['name', 'kunya', 'laqab', 'gender', 'date_of_birth', 'birthplace', 'status'],
  },
  professional: {
    label: 'المعلومات المهنية',
    fields: ['professional_title', 'professional_title_label', 'achievements'],
  },
  contact: {
    label: 'معلومات الاتصال',
    fields: ['phone', 'email'],
  },
  family: {
    label: 'العلاقات العائلية',
    fields: ['father_id', 'mother_id'],
  },
  biography: {
    label: 'السيرة الذاتية',
    fields: ['bio', 'timeline'],
  },
  location: {
    label: 'الموقع',
    fields: ['birthplace', 'current_residence'],
  },
  media: {
    label: 'الوسائط',
    fields: ['photo_url'],
  },
  system: {
    label: 'معلومات النظام',
    fields: ['role', 'can_edit', 'is_moderator', 'moderated_branch', 'hid', 'is_verified'],
  },
};

// Get Arabic label for a field
export function getFieldLabel(fieldName) {
  return FIELD_LABELS[fieldName] || fieldName;
}

// Get category for a field
export function getFieldCategory(fieldName) {
  for (const [categoryKey, category] of Object.entries(FIELD_CATEGORIES)) {
    if (category.fields.includes(fieldName)) {
      return {
        key: categoryKey,
        label: category.label,
      };
    }
  }
  return {
    key: 'other',
    label: 'أخرى',
  };
}

// Group changed fields by category
export function groupFieldsByCategory(changedFields) {
  const grouped = {};

  changedFields.forEach(field => {
    const category = getFieldCategory(field);
    if (!grouped[category.key]) {
      grouped[category.key] = {
        label: category.label,
        fields: [],
      };
    }
    grouped[category.key].fields.push(field);
  });

  return grouped;
}

// Value formatters for specific field types
export const VALUE_FORMATTERS = {
  // Phone numbers: Format with spaces (966 50 123 4567)
  phone: (value) => {
    if (!value) return '—';
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('966')) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
    }
    if (cleaned.length === 10 && cleaned.startsWith('05')) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return value;
  },

  // Professional titles: Map enum to Arabic label
  professional_title: (value) => {
    const titles = {
      doctor: 'دكتور (د.)',
      engineer: 'مهندس (م.)',
      professor: 'أستاذ دكتور (أ.د.)',
      sheikh: 'شيخ',
      general: 'اللواء',
      colonel: 'عقيد',
      major: 'رائد',
      captain: 'نقيب',
      mr: 'السيد',
      prince: 'الأمير',
    };
    return titles[value] || value || '—';
  },

  // Gender
  gender: (value) => {
    return value === 'male' ? 'ذكر' : value === 'female' ? 'أنثى' : '—';
  },

  // Status
  status: (value) => {
    const statuses = {
      alive: 'على قيد الحياة',
      deceased: 'متوفى',
    };
    return statuses[value] || value || '—';
  },

  // Booleans
  is_verified: (value) => value ? 'نعم' : 'لا',
  can_edit: (value) => value ? 'نعم' : 'لا',
  is_moderator: (value) => value ? 'نعم' : 'لا',

  // Role
  role: (value) => {
    const roles = {
      super_admin: 'مشرف عام',
      admin: 'مشرف',
      moderator: 'مشرف فرع',
      user: 'مستخدم',
    };
    return roles[value] || value || '—';
  },

  // Dates: Format ISO to Arabic readable
  date_of_birth: (value) => {
    if (!value) return '—';
    try {
      const date = new Date(value);
      return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return value;
    }
  },

  date_of_death: (value) => {
    if (!value) return '—';
    try {
      const date = new Date(value);
      return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return value;
    }
  },

  // NOTE: created_at and updated_at are now formatted in InlineDiff component
  // using formatDateByPreference() to respect user's calendar/format settings
};

// Format a field value for display
export function formatFieldValue(fieldName, value) {
  // Use custom formatter if available
  if (VALUE_FORMATTERS[fieldName]) {
    return VALUE_FORMATTERS[fieldName](value);
  }

  // Default formatters
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';

  // Format complex objects nicely (don't show raw JSON)
  if (typeof value === 'object') {
    // birthdate_data: {hijri: {...}, gregorian: {...}}
    if (value.hijri && value.gregorian) {
      return 'تاريخ محدث'; // Just say "date updated" instead of showing JSON
    }
    // Array
    if (Array.isArray(value)) {
      return `${value.length} عنصر`;
    }
    // Generic object - count properties
    return `كائن (${Object.keys(value).length} حقل)`;
  }

  if (typeof value === 'string' && value.length > 50) {
    return value.substring(0, 50) + '...';
  }

  return String(value);
}

// Generate smart action description from changed fields
export function generateActionDescription(actionType, changedFields, targetName) {
  if (!changedFields || changedFields.length === 0) {
    return `تحديث بيانات`;
  }

  const primaryField = changedFields[0];
  const fieldLabel = getFieldLabel(primaryField);

  // Multiple fields changed - keep it short, name is shown below
  if (changedFields.length > 1) {
    return `تحديث ${changedFields.length} حقول`;
  }

  // Single field changed - short label (name shown separately)
  switch (primaryField) {
    case 'phone':
      return `تحديث: رقم الجوال`;
    case 'name':
      return `تحديث: الاسم`;
    case 'professional_title':
      return `تحديث: المسمى الوظيفي`;
    case 'kunya':
      return `تحديث: الكنية`;
    case 'achievements':
      return `تحديث: الإنجازات`;
    case 'photo_url':
      return `تحديث: الصورة`;
    case 'date_of_birth':
      return `تحديث: تاريخ الميلاد`;
    case 'email':
      return `تحديث: البريد الإلكتروني`;
    default:
      return `تحديث: ${fieldLabel}`;
  }
}
