# Changelog

All notable changes to the Alqefari Family Tree app will be documented in this file.

## [Unreleased] - January 2025

### Added
- Migration 077: `admin_update_marriage` RPC function for secure marriage updates with permission checks
- Migration 078: Simplified marriage status values from 3 to 2 options
- Comprehensive tests for EditMarriageModal component

### Changed
- **Marriage Status Terminology** (Migration 078):
  - Replaced stigmatizing terms with neutral language
  - Old: 'married'/'divorced'/'widowed' → New: 'current' (حالي)/'past' (سابق)
  - Simplified UI from 3 status options to 2
  - Updated all 12+ app files to use new terminology
- EditMarriageModal: Redesigned with 2 status options and neutral labels
- SelectMotherModal: Now shows ALL wives (including divorced/widowed)
- TabFamily: Updated spouse display with 'سابق' badge for past marriages

### Fixed
- Critical bug where wives disappeared after migration 078 deployment
- Spouse filters now accept both old and new status values for backward compatibility
- Mother selection now includes divorced/widowed wives (they can still be mothers)
- All marriage creation functions now use 'current' as default status

### Technical
- Updated 8 core components to support new marriage status values
- Added backward compatibility layer for transition period
- Updated test mock data to use new status values
- Documented common migration pitfall in CLAUDE.md

## [2.0.0] - 2025-01-15

### 🎉 Major Update - Complete Rebuild with React Native

### Added
- Completely rebuilt with React Native Expo (replacing Flutter)
- Enhanced performance and smoother animations
- Improved Arabic RTL support throughout the app
- Better zoom and pan controls for family tree
- Faster image loading and caching

### Changed
- Entire technology stack from Flutter to React Native
- Modernized UI with neo-native design system
- Improved Supabase integration

### Previous Versions
- [1.2.0] - 2024 (Flutter Version - Last Release)
- [1.0.0] - 2024 (Flutter Version - Initial Release)
