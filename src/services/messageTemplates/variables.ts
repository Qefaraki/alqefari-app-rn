/**
 * Common Variables Registry
 *
 * Defines reusable variables that can be used in message templates.
 * These variables are automatically replaced with actual user data at runtime.
 */

import { TemplateVariable } from './types';

/**
 * User identity variables (name, contact info)
 */
export const USER_IDENTITY_VARIABLES: TemplateVariable[] = [
  {
    key: '{name_chain}',
    label: 'السلسلة الكاملة للاسم',
    description: 'الاسم الكامل مع الأجداد (مثال: محمد بن علي عبدالله القفاري)',
    source: 'profile.full_chain || buildNameChain(profile)',
    example: 'محمد بن علي عبدالله القفاري',
    required: false,
  },
  {
    key: '{first_name}',
    label: 'الاسم الأول فقط',
    description: 'الاسم الأول بدون الأجداد (مثال: محمد)',
    source: 'profile.name',
    example: 'محمد',
    required: false,
  },
  {
    key: '{phone}',
    label: 'رقم الجوال',
    description: 'رقم الجوال بالصيغة الدولية (مثال: +966501234567)',
    source: 'profile.phone',
    example: '+966501234567',
    required: false,
  },
  {
    key: '{hid}',
    label: 'الرقم التعريفي العائلي',
    description: 'الرقم الهرمي في شجرة العائلة (مثال: A1.B2.C3)',
    source: 'profile.hid',
    example: 'A1.B2.C3',
    required: false,
  },
  {
    key: '{title}',
    label: 'اللقب المهني',
    description: 'الاختصار المهني (د., م., أ.د.)',
    source: 'getTitleAbbreviation(profile)',
    example: 'د.',
    required: false,
  },
];

/**
 * Profile detail variables (personal info)
 */
export const PROFILE_DETAIL_VARIABLES: TemplateVariable[] = [
  {
    key: '{gender}',
    label: 'الجنس',
    description: 'الجنس باللغة العربية (ذكر أو أنثى)',
    source: 'profile.gender === "male" ? "ذكر" : "أنثى"',
    example: 'ذكر',
    required: false,
  },
  {
    key: '{father_name}',
    label: 'اسم الأب',
    description: 'الاسم الأول للأب فقط',
    source: 'profile.father_name',
    example: 'علي',
    required: false,
  },
  {
    key: '{mother_name}',
    label: 'اسم الأم',
    description: 'اسم الأم الكامل',
    source: 'profile.mother_name',
    example: 'فاطمة العتيبي',
    required: false,
  },
  {
    key: '{birth_year}',
    label: 'سنة الميلاد الهجرية',
    description: 'سنة الميلاد بالتقويم الهجري',
    source: 'profile.birth_hijri_year',
    example: '1400',
    required: false,
  },
  {
    key: '{death_year}',
    label: 'سنة الوفاة الهجرية',
    description: 'سنة الوفاة بالتقويم الهجري (إن وجدت)',
    source: 'profile.death_hijri_year',
    example: '1445',
    required: false,
  },
];

/**
 * System variables (date, time, etc.)
 */
export const SYSTEM_VARIABLES: TemplateVariable[] = [
  {
    key: '{date}',
    label: 'التاريخ الحالي',
    description: 'التاريخ الحالي بالتقويم الميلادي',
    source: 'new Date().toLocaleDateString("ar-SA")',
    example: '١٥/٤/٢٠٢٥',
    required: false,
  },
  {
    key: '{hijri_date}',
    label: 'التاريخ الهجري الحالي',
    description: 'التاريخ الحالي بالتقويم الهجري',
    source: 'getHijriDate()',
    example: '٢٥/١٠/١٤٤٦',
    required: false,
  },
  {
    key: '{time}',
    label: 'الوقت الحالي',
    description: 'الوقت الحالي',
    source: 'new Date().toLocaleTimeString("ar-SA")',
    example: '٣:٤٥ م',
    required: false,
  },
];

/**
 * Combined common variables registry
 */
export const COMMON_VARIABLES = {
  USER_IDENTITY: USER_IDENTITY_VARIABLES,
  PROFILE_DETAILS: PROFILE_DETAIL_VARIABLES,
  SYSTEM: SYSTEM_VARIABLES,
};

/**
 * Get variable by key
 */
export function getVariableByKey(key: string): TemplateVariable | undefined {
  const allVariables = [
    ...USER_IDENTITY_VARIABLES,
    ...PROFILE_DETAIL_VARIABLES,
    ...SYSTEM_VARIABLES,
  ];

  return allVariables.find(v => v.key === key);
}

/**
 * Get all variables as flat array
 */
export function getAllVariables(): TemplateVariable[] {
  return [
    ...USER_IDENTITY_VARIABLES,
    ...PROFILE_DETAIL_VARIABLES,
    ...SYSTEM_VARIABLES,
  ];
}
