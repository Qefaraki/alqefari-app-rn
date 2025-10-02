/**
 * Message Templates Registry
 *
 * ⭐ SINGLE SOURCE OF TRUTH for all WhatsApp message templates
 *
 * To add a new template:
 * 1. Add a new object to MESSAGE_TEMPLATES array below
 * 2. That's it! UI and functionality auto-generate
 */

import { MessageTemplate } from './types';
import { COMMON_VARIABLES } from './variables';

/**
 * All message templates used in the app
 *
 * Templates are displayed in admin UI in the order defined here.
 * Variables in curly braces {} are automatically replaced with user data.
 */
export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  // Support Category
  {
    id: 'onboarding_help',
    name: 'رسالة المساعدة (شاشة البداية)',
    description: 'تظهر عند النقر على "تحتاج مساعدة؟" في شاشة البداية',
    category: 'support',
    defaultMessage: 'مرحباً، أحتاج مساعدة في استخدام تطبيق شجرة عائلة القفاري',
    icon: 'help-circle',
    storageKey: 'admin_onboarding_help_message',
    variables: [],
    testable: true,
    testMockData: {},
    order: 1,
  },

  {
    id: 'contact_admin',
    name: 'رسالة التواصل مع المشرف',
    description: 'رسالة عامة للتواصل مع المشرف',
    category: 'support',
    defaultMessage: `السلام عليكم

الاسم: {name_chain}
الجوال: {phone}`,
    icon: 'chatbubble-ellipses',
    storageKey: 'admin_contact_message',
    variables: [
      COMMON_VARIABLES.USER_IDENTITY[0], // {name_chain}
      COMMON_VARIABLES.USER_IDENTITY[2], // {phone}
    ],
    testable: true,
    testMockData: {
      name_chain: 'محمد بن علي عبدالله القفاري',
      phone: '+966501234567',
    },
    order: 2,
  },

  // Content Category
  {
    id: 'article_suggestion',
    name: 'رسالة اقتراح المقالات',
    description: 'تظهر عند اقتراح مقال من صفحة الأخبار (يتم إضافة الاسم ورقم الجوال تلقائياً)',
    category: 'content',
    defaultMessage: `أود اقتراح مقال للنشر

الاسم: {name_chain}
الجوال: {phone}`,
    icon: 'newspaper-outline',
    storageKey: 'admin_article_suggestion_message',
    variables: [
      COMMON_VARIABLES.USER_IDENTITY[0], // {name_chain}
      COMMON_VARIABLES.USER_IDENTITY[2], // {phone}
    ],
    testable: true,
    testMockData: {
      name_chain: 'علي بن محمد القفاري',
      phone: '+966505551234',
    },
    order: 3,
  },

  // Requests Category
  {
    id: 'profile_link_request',
    name: 'طلب ربط الملف الشخصي',
    description: 'تظهر عند طلب ربط ملف شخصي بحساب المستخدم',
    category: 'requests',
    defaultMessage: `مرحباً، أود ربط ملفي الشخصي بحسابي

الاسم: {name_chain}
الجوال: {phone}
الرقم التعريفي: {hid}`,
    icon: 'link-outline',
    storageKey: 'admin_profile_link_message',
    variables: [
      COMMON_VARIABLES.USER_IDENTITY[0], // {name_chain}
      COMMON_VARIABLES.USER_IDENTITY[2], // {phone}
      COMMON_VARIABLES.USER_IDENTITY[3], // {hid}
    ],
    testable: true,
    testMockData: {
      name_chain: 'فاطمة بنت علي عبدالله القفاري',
      phone: '+966501111111',
      hid: 'A1.B2.C3',
    },
    order: 4,
  },

  {
    id: 'report_issue',
    name: 'الإبلاغ عن مشكلة',
    description: 'تظهر عند الإبلاغ عن مشكلة تقنية أو خطأ في التطبيق',
    category: 'support',
    defaultMessage: `أود الإبلاغ عن مشكلة

الاسم: {name_chain}
الجوال: {phone}

وصف المشكلة:`,
    icon: 'warning-outline',
    storageKey: 'admin_report_issue_message',
    variables: [
      COMMON_VARIABLES.USER_IDENTITY[0], // {name_chain}
      COMMON_VARIABLES.USER_IDENTITY[2], // {phone}
    ],
    testable: true,
    testMockData: {
      name_chain: 'عبدالله بن سعد القفاري',
      phone: '+966502222222',
    },
    order: 5,
  },
];

/**
 * Get template by ID
 */
export function getTemplateById(id: string): MessageTemplate | undefined {
  return MESSAGE_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): MessageTemplate[] {
  return MESSAGE_TEMPLATES.filter(t => t.category === category).sort((a, b) => a.order - b.order);
}

/**
 * Get all templates sorted by order
 */
export function getAllTemplates(): MessageTemplate[] {
  return [...MESSAGE_TEMPLATES].sort((a, b) => a.order - b.order);
}

/**
 * Get template categories (unique)
 */
export function getTemplateCategories(): string[] {
  const categories = MESSAGE_TEMPLATES.map(t => t.category);
  return [...new Set(categories)];
}
