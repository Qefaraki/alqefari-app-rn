/**
 * Centralized permission and error messages for TabFamily
 *
 * This file contains all error messages, alert titles, and descriptions
 * used in family editing operations to ensure consistency and reduce duplication.
 *
 * Usage:
 * import { PERMISSION_MESSAGES, ERROR_MESSAGES } from './permissionMessages';
 * Alert.alert(PERMISSION_MESSAGES.UNAUTHORIZED_EDIT.title, PERMISSION_MESSAGES.UNAUTHORIZED_EDIT.message);
 */

export const PERMISSION_MESSAGES = {
  // Permission denied messages
  UNAUTHORIZED_EDIT: {
    title: 'غير مصرح',
    message: 'ليس لديك صلاحية لتعديل هذا الملف الشخصي.\n\nيمكنك فقط تعديل:\n• ملفك الشخصي\n• ملفات زوجتك\n• ملفات والديك\n• ملفات إخوتك\n• ملفات أبنائك وأحفادك',
  },

  UNAUTHORIZED_DELETE: {
    title: 'غير مصرح',
    message: 'ليس لديك صلاحية لحذف هذا السجل.',
  },

  UNAUTHORIZED_ADD_SPOUSE: {
    title: 'غير مصرح',
    message: 'ليس لديك صلاحية لإضافة زواج.\n\nيمكنك فقط تعديل:\n• ملفك الشخصي\n• ملفات زوجتك\n• ملفات والديك\n• ملفات إخوتك\n• ملفات أبنائك وأحفادك',
  },

  UNAUTHORIZED_ADD_CHILD: {
    title: 'غير مصرح',
    message: 'ليس لديك صلاحية لإضافة ابن/ابنة.\n\nيمكنك فقط تعديل:\n• ملفك الشخصي\n• ملفات زوجتك\n• ملفات والديك\n• ملفات إخوتك\n• ملفات أبنائك وأحفادك',
  },

  UNAUTHORIZED_MOTHER_EDIT: {
    title: 'غير مصرح',
    message: 'ليس لديك صلاحية لتعديل الأم.\n\nيمكنك فقط تعديل:\n• ملفك الشخصي\n• ملفات زوجتك\n• ملفات والديك\n• ملفات إخوتك\n• ملفات أبنائك وأحفادك',
  },

  UNAUTHORIZED_MOTHER_CLEAR: {
    title: 'غير مصرح',
    message: 'ليس لديك صلاحية لإزالة الأم.',
  },

  UNAUTHORIZED_SAVE: {
    title: 'غير مصرح',
    message: 'ليس لديك صلاحية لحفظ التعديلات.\n\nيمكنك فقط تعديل:\n• ملفك الشخصي\n• ملفات زوجتك\n• ملفات والديك\n• ملفات إخوتك\n• ملفات أبنائك وأحفادك',
  },
};

export const ERROR_MESSAGES = {
  // Version conflict errors
  VERSION_CONFLICT: {
    title: 'تعارض في التعديلات',
    message: 'تم تعديل هذا الملف الشخصي من قبل شخص آخر. يرجى تحديث الصفحة والمحاولة مرة أخرى.',
  },

  // Validation errors
  EMPTY_SPOUSE_NAME: {
    title: 'خطأ',
    message: 'يرجى كتابة اسم الزوجة',
  },

  EMPTY_CHILD_NAME: {
    title: 'خطأ',
    message: 'يرجى كتابة اسم الابن/الابنة',
  },

  INVALID_NAME_FORMAT: {
    title: 'عفواً عمي...',
    message: 'أدخل الاسم كاملاً من فضلك\n\nمثال: مريم محمد علي سليمان السعوي\nالحد الأدنى: اسمان (الاسم الأول + العائلة)',
  },

  // Missing data errors
  MISSING_MARRIAGE_DATA: {
    title: 'خطأ',
    message: 'بيانات الزواج غير مكتملة. يرجى التواصل مع المسؤول.',
  },

  MISSING_PROFILE_DATA: {
    title: 'خطأ',
    message: 'بيانات الملف الشخصي غير مكتملة. يرجى التواصل مع المسؤول.',
  },

  // Save errors
  SAVE_FAILED: {
    title: 'خطأ',
    message: 'تعذر حفظ التعديلات، حاول مرة أخرى',
  },

  // Delete errors
  DELETE_FAILED: {
    title: 'خطأ',
    message: 'فشل حذف الملف الشخصي',
  },

  // Mother assignment errors
  ASSIGN_MOTHER_FAILED: {
    title: 'خطأ',
    message: 'فشل تعيين الأم',
  },

  CLEAR_MOTHER_FAILED: {
    title: 'خطأ',
    message: 'فشل إزالة الأم',
  },
};

export const WARNING_MESSAGES = {
  // Warnings
  ADD_FATHER_FIRST: {
    title: 'تنبيه',
    message: 'أضف الأب أولاً لتتمكن من الانتقال إلى ملفه.',
  },

  ADD_SPOUSE_BEFORE_CHILDREN: {
    title: 'تنبيه',
    message: 'يجب إضافة زوج أولاً قبل إضافة الأبناء',
  },
};

/**
 * Helper function to show permission error alert
 * @param {string} messageKey - Key from PERMISSION_MESSAGES object
 */
export const showPermissionError = (messageKey) => {
  const { title, message } = PERMISSION_MESSAGES[messageKey];
  if (!title || !message) {
    console.warn(`Invalid permission message key: ${messageKey}`);
    return;
  }
  Alert.alert(title, message);
};

/**
 * Helper function to show error alert
 * @param {string} messageKey - Key from ERROR_MESSAGES object
 */
export const showError = (messageKey) => {
  const { title, message } = ERROR_MESSAGES[messageKey];
  if (!title || !message) {
    console.warn(`Invalid error message key: ${messageKey}`);
    return;
  }
  Alert.alert(title, message);
};

/**
 * Helper function to show warning alert
 * @param {string} messageKey - Key from WARNING_MESSAGES object
 */
export const showWarning = (messageKey) => {
  const { title, message } = WARNING_MESSAGES[messageKey];
  if (!title || !message) {
    console.warn(`Invalid warning message key: ${messageKey}`);
    return;
  }
  Alert.alert(title, message);
};
