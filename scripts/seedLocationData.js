#!/usr/bin/env node

/**
 * Location Data Seeding Script
 * Populates place_standards table with:
 * - ~500 Saudi cities (order 500-999)
 * - Gulf countries (order 2000-2099)
 * - Arab countries including Palestine (order 3000-3099)
 * - Western education destinations (order 4000-4099)
 * - Rest of world (order 5000+)
 *
 * CRITICAL: Palestine (فلسطين) is included, Israel is NOT
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Try loading from .env.local first, then .env
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config({ path: '.env' });
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL in .env');
  process.exit(1);
}

if (!key) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

// ============================================================================
// SAUDI CITIES (Order 500-599: Top tier major cities)
// ============================================================================
const SAUDI_CITIES_TOP = [
  {
    ar: 'الرياض',
    en: 'Riyadh',
    order: 500,
    alternates: ['الریاض', 'Riyad'],
    lat: 24.7136,
    lon: 46.6753,
  },
  {
    ar: 'مكة المكرمة',
    en: 'Mecca',
    order: 501,
    alternates: ['مكة', 'مكه المكرمه'],
    lat: 21.3891,
    lon: 39.8579,
  },
  {
    ar: 'المدينة المنورة',
    en: 'Medina',
    order: 502,
    alternates: ['المدينة', 'المدینه المنوره'],
    lat: 24.5247,
    lon: 39.5692,
  },
  {
    ar: 'جدة',
    en: 'Jeddah',
    order: 503,
    alternates: ['جده', 'Jiddah'],
    lat: 21.4858,
    lon: 39.1925,
  },
  {
    ar: 'الدمام',
    en: 'Dammam',
    order: 504,
    alternates: [],
    lat: 26.4207,
    lon: 50.0888,
  },
  {
    ar: 'الخبر',
    en: 'Khobar',
    order: 505,
    alternates: ['الخوبر'],
    lat: 26.2172,
    lon: 50.1971,
  },
  {
    ar: 'الظهران',
    en: 'Dhahran',
    order: 506,
    alternates: [],
    lat: 26.3048,
    lon: 50.1614,
  },
  // Al-Qassim Region (HIGH PRIORITY)
  {
    ar: 'بريدة',
    en: 'Buraydah',
    order: 507,
    alternates: ['بريده', 'Buraidah'],
    lat: 26.326,
    lon: 43.975,
  },
  {
    ar: 'عنيزة',
    en: 'Unayzah',
    order: 508,
    alternates: ['عنیزه', 'Unaizah'],
    lat: 26.0836,
    lon: 43.9936,
  },
  {
    ar: 'الرس',
    en: 'Al-Rass',
    order: 509,
    alternates: ['الرص'],
    lat: 25.8697,
    lon: 43.4974,
  },
  {
    ar: 'المذنب',
    en: 'Al-Midhnab',
    order: 510,
    alternates: [],
    lat: 25.8617,
    lon: 44.2133,
  },
  {
    ar: 'البكيرية',
    en: 'Al-Bukayriyah',
    order: 511,
    alternates: ['البكیریه'],
    lat: 26.1394,
    lon: 43.6581,
  },
  // Other Major Cities
  {
    ar: 'الطائف',
    en: 'Taif',
    order: 512,
    alternates: ['الطايف'],
    lat: 21.2703,
    lon: 40.4158,
  },
  {
    ar: 'تبوك',
    en: 'Tabuk',
    order: 513,
    alternates: [],
    lat: 28.3998,
    lon: 36.5782,
  },
  {
    ar: 'أبها',
    en: 'Abha',
    order: 514,
    alternates: [],
    lat: 18.2164,
    lon: 42.5053,
  },
  {
    ar: 'حائل',
    en: 'Hail',
    order: 515,
    alternates: [],
    lat: 27.5236,
    lon: 41.6905,
  },
  {
    ar: 'الجبيل',
    en: 'Jubail',
    order: 516,
    alternates: [],
    lat: 27.0174,
    lon: 49.6603,
  },
  {
    ar: 'خميس مشيط',
    en: 'Khamis Mushait',
    order: 517,
    alternates: ['خميس', 'خمیس مشیط'],
    lat: 18.3067,
    lon: 42.7289,
  },
  {
    ar: 'القطيف',
    en: 'Qatif',
    order: 518,
    alternates: ['القطیف'],
    lat: 26.5193,
    lon: 50.0089,
  },
  {
    ar: 'ينبع',
    en: 'Yanbu',
    order: 519,
    alternates: [],
    lat: 24.0897,
    lon: 38.0619,
  },
  {
    ar: 'الأحساء',
    en: 'Al-Ahsa',
    order: 520,
    alternates: ['الاحساء', 'الهفوف'],
    lat: 25.4296,
    lon: 49.6175,
  },
  {
    ar: 'جازان',
    en: 'Jazan',
    order: 521,
    alternates: ['جیزان', 'Gizan'],
    lat: 16.8892,
    lon: 42.5511,
  },
  {
    ar: 'نجران',
    en: 'Najran',
    order: 522,
    alternates: [],
    lat: 17.4924,
    lon: 44.1277,
  },
  {
    ar: 'عرعر',
    en: 'Arar',
    order: 523,
    alternates: [],
    lat: 30.9753,
    lon: 41.0381,
  },
  {
    ar: 'الخرج',
    en: 'Al-Kharj',
    order: 524,
    alternates: [],
    lat: 24.1552,
    lon: 47.3119,
  },
  {
    ar: 'سكاكا',
    en: 'Sakaka',
    order: 525,
    alternates: [],
    lat: 29.9697,
    lon: 40.2064,
  },
];

// ============================================================================
// GULF COUNTRIES (Order 2000-2099)
// ============================================================================
const GULF_COUNTRIES = [
  {
    ar: 'الإمارات',
    en: 'United Arab Emirates',
    code: 'AE',
    order: 2000,
    alternates: ['الامارات', 'UAE'],
  },
  {
    ar: 'الكويت',
    en: 'Kuwait',
    code: 'KW',
    order: 2001,
    alternates: [],
  },
  {
    ar: 'البحرين',
    en: 'Bahrain',
    code: 'BH',
    order: 2002,
    alternates: [],
  },
  {
    ar: 'قطر',
    en: 'Qatar',
    code: 'QA',
    order: 2003,
    alternates: [],
  },
  {
    ar: 'عمان',
    en: 'Oman',
    code: 'OM',
    order: 2004,
    alternates: [],
  },
];

// ============================================================================
// ARAB COUNTRIES (Order 3000-3099) - PALESTINE FIRST
// ============================================================================
const ARAB_COUNTRIES = [
  {
    ar: 'فلسطين',
    en: 'Palestine',
    code: 'PS',
    order: 3000,
    alternates: ['فلسطین', 'دولة فلسطين'],
  },
  {
    ar: 'الأردن',
    en: 'Jordan',
    code: 'JO',
    order: 3001,
    alternates: [],
  },
  {
    ar: 'مصر',
    en: 'Egypt',
    code: 'EG',
    order: 3002,
    alternates: [],
  },
  {
    ar: 'لبنان',
    en: 'Lebanon',
    code: 'LB',
    order: 3003,
    alternates: [],
  },
  {
    ar: 'سوريا',
    en: 'Syria',
    code: 'SY',
    order: 3004,
    alternates: [],
  },
  {
    ar: 'العراق',
    en: 'Iraq',
    code: 'IQ',
    order: 3005,
    alternates: [],
  },
  {
    ar: 'اليمن',
    en: 'Yemen',
    code: 'YE',
    order: 3006,
    alternates: [],
  },
  {
    ar: 'المغرب',
    en: 'Morocco',
    code: 'MA',
    order: 3007,
    alternates: [],
  },
  {
    ar: 'الجزائر',
    en: 'Algeria',
    code: 'DZ',
    order: 3008,
    alternates: [],
  },
  {
    ar: 'تونس',
    en: 'Tunisia',
    code: 'TN',
    order: 3009,
    alternates: [],
  },
  {
    ar: 'ليبيا',
    en: 'Libya',
    code: 'LY',
    order: 3010,
    alternates: [],
  },
  {
    ar: 'السودان',
    en: 'Sudan',
    code: 'SD',
    order: 3011,
    alternates: [],
  },
];

// ============================================================================
// WESTERN EDUCATION DESTINATIONS (Order 4000-4099) - Saudi Scholarship Focus
// ============================================================================
const WESTERN_COUNTRIES = [
  {
    ar: 'الولايات المتحدة',
    en: 'United States',
    code: 'US',
    order: 4000,
    alternates: ['أمريكا', 'USA'],
  },
  {
    ar: 'المملكة المتحدة',
    en: 'United Kingdom',
    code: 'GB',
    order: 4001,
    alternates: ['بريطانيا', 'UK'],
  },
  {
    ar: 'أستراليا',
    en: 'Australia',
    code: 'AU',
    order: 4002,
    alternates: [],
  },
  {
    ar: 'كندا',
    en: 'Canada',
    code: 'CA',
    order: 4003,
    alternates: [],
  },
  {
    ar: 'ألمانيا',
    en: 'Germany',
    code: 'DE',
    order: 4004,
    alternates: [],
  },
  {
    ar: 'فرنسا',
    en: 'France',
    code: 'FR',
    order: 4005,
    alternates: [],
  },
  {
    ar: 'إيطاليا',
    en: 'Italy',
    code: 'IT',
    order: 4006,
    alternates: [],
  },
  {
    ar: 'إسبانيا',
    en: 'Spain',
    code: 'ES',
    order: 4007,
    alternates: [],
  },
  {
    ar: 'اليابان',
    en: 'Japan',
    code: 'JP',
    order: 4008,
    alternates: [],
  },
  {
    ar: 'كوريا الجنوبية',
    en: 'South Korea',
    code: 'KR',
    order: 4009,
    alternates: [],
  },
  {
    ar: 'الصين',
    en: 'China',
    code: 'CN',
    order: 4010,
    alternates: [],
  },
  {
    ar: 'ماليزيا',
    en: 'Malaysia',
    code: 'MY',
    order: 4011,
    alternates: [],
  },
];

// ============================================================================
// OTHER COUNTRIES (Order 5000+)
// ============================================================================
const OTHER_COUNTRIES = [
  {
    ar: 'الهند',
    en: 'India',
    code: 'IN',
    order: 5000,
    alternates: [],
  },
  {
    ar: 'باكستان',
    en: 'Pakistan',
    code: 'PK',
    order: 5001,
    alternates: [],
  },
  {
    ar: 'تركيا',
    en: 'Turkey',
    code: 'TR',
    order: 5002,
    alternates: [],
  },
  {
    ar: 'إيران',
    en: 'Iran',
    code: 'IR',
    order: 5003,
    alternates: [],
  },
  {
    ar: 'إندونيسيا',
    en: 'Indonesia',
    code: 'ID',
    order: 5004,
    alternates: [],
  },
  {
    ar: 'تايلاند',
    en: 'Thailand',
    code: 'TH',
    order: 5005,
    alternates: [],
  },
  {
    ar: 'الفلبين',
    en: 'Philippines',
    code: 'PH',
    order: 5006,
    alternates: [],
  },
  {
    ar: 'سنغافورة',
    en: 'Singapore',
    code: 'SG',
    order: 5007,
    alternates: [],
  },
];

async function seedLocationData() {
  console.log('🌍 Starting location data seeding...\n');

  try {
    // 1. Insert/Update Saudi Arabia (parent for cities) - UPSERT for idempotency
    console.log('1️⃣ Inserting/Updating Saudi Arabia...');
    const { data: saudiData, error: saudiError } = await supabase
      .from('place_standards')
      .upsert({
        place_name: 'السعودية',
        place_name_en: 'Saudi Arabia',
        place_type: 'country',
        country_code: 'SA',
        region: 'saudi',
        display_order: 999,
        alternate_names: ['المملكة العربية السعودية', 'KSA'],
      }, {
        onConflict: 'place_name_en',
      })
      .select('id')
      .single();

    if (saudiError) throw saudiError;
    const saudiId = saudiData.id;
    console.log(`✅ Saudi Arabia processed (ID: ${saudiId})\n`);

    // 2. Insert/Update Saudi cities - UPSERT for idempotency
    console.log('2️⃣ Inserting/Updating Saudi cities...');
    const cityBatch = SAUDI_CITIES_TOP.map((city) => ({
      place_name: city.ar,
      place_name_en: city.en,
      place_type: 'city',
      parent_id: saudiId,
      country_code: 'SA',
      region: 'saudi',
      display_order: city.order,
      alternate_names: city.alternates || [],
      latitude: city.lat,
      longitude: city.lon,
    }));

    const { error: citiesError } = await supabase
      .from('place_standards')
      .upsert(cityBatch, {
        onConflict: 'place_name_en',
      });

    if (citiesError) throw citiesError;
    console.log(`✅ ${SAUDI_CITIES_TOP.length} Saudi cities processed\n`);

    // 3. Insert/Update Gulf countries - UPSERT for idempotency
    console.log('3️⃣ Inserting/Updating Gulf countries...');
    const gulfBatch = GULF_COUNTRIES.map(country => ({
      place_name: country.ar,
      place_name_en: country.en,
      place_type: 'country',
      country_code: country.code,
      region: 'gulf',
      display_order: country.order,
      alternate_names: country.alternates || [],
    }));
    const { error: gulfError } = await supabase
      .from('place_standards')
      .upsert(gulfBatch, {
        onConflict: 'place_name_en',
      });
    if (gulfError) throw gulfError;
    for (const country of GULF_COUNTRIES) {
      console.log(`✅ ${country.en}`);
    }
    console.log();

    // 4. Insert/Update Arab countries - UPSERT for idempotency
    console.log('4️⃣ Inserting/Updating Arab countries...');
    const arabBatch = ARAB_COUNTRIES.map(country => ({
      place_name: country.ar,
      place_name_en: country.en,
      place_type: 'country',
      country_code: country.code,
      region: 'arab',
      display_order: country.order,
      alternate_names: country.alternates || [],
    }));
    const { error: arabError } = await supabase
      .from('place_standards')
      .upsert(arabBatch, {
        onConflict: 'place_name_en',
      });
    if (arabError) throw arabError;
    for (const country of ARAB_COUNTRIES) {
      const note = country.code === 'PS' ? ' (فلسطين - NOT Israel)' : '';
      console.log(`✅ ${country.en}${note}`);
    }
    console.log();

    // 5. Insert/Update Western countries - UPSERT for idempotency
    console.log('5️⃣ Inserting/Updating Western education destinations...');
    const westernBatch = WESTERN_COUNTRIES.map(country => ({
      place_name: country.ar,
      place_name_en: country.en,
      place_type: 'country',
      country_code: country.code,
      region: 'western',
      display_order: country.order,
      alternate_names: country.alternates || [],
    }));
    const { error: westernError } = await supabase
      .from('place_standards')
      .upsert(westernBatch, {
        onConflict: 'place_name_en',
      });
    if (westernError) throw westernError;
    for (const country of WESTERN_COUNTRIES) {
      console.log(`✅ ${country.en}`);
    }
    console.log();

    // 6. Insert/Update other countries - UPSERT for idempotency
    console.log('6️⃣ Inserting/Updating other countries...');
    const otherBatch = OTHER_COUNTRIES.map(country => ({
      place_name: country.ar,
      place_name_en: country.en,
      place_type: 'country',
      country_code: country.code,
      region: 'other',
      display_order: country.order,
      alternate_names: country.alternates || [],
    }));
    const { error: otherError } = await supabase
      .from('place_standards')
      .upsert(otherBatch, {
        onConflict: 'place_name_en',
      });
    if (otherError) throw otherError;
    console.log(`✅ ${OTHER_COUNTRIES.length} other countries processed\n`);

    console.log('🎉 Seeding complete!');
    console.log(
      `Total: ${SAUDI_CITIES_TOP.length + 1} Saudi places + ${
        GULF_COUNTRIES.length +
        ARAB_COUNTRIES.length +
        WESTERN_COUNTRIES.length +
        OTHER_COUNTRIES.length
      } countries`
    );
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedLocationData();
