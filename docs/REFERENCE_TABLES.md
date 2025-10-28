# Reference Tables

Centralized reference tables for quick lookup and feature matrix information.

---

## Admin Dashboard Access by Role

**Feature-Based System**: All feature permissions controlled via `src/config/adminFeatures.js`

**Dashboard Access** (all admin roles): super_admin ✅ | admin ✅ | moderator ✅
**Dashboard Statistics** (all admin roles): All admin roles can access via `admin_get_enhanced_statistics()` RPC

| Feature | Arabic | Super Admin | Admin | Moderator |
|---------|--------|-------------|-------|-----------|
| إدارة الصلاحيات | Permission Manager | ✅ | ❌ | ❌ |
| إشعارات جماعية | Broadcast Manager | ✅ | ❌ | ❌ |
| ربط الملفات | Link Requests | ✅ | ✅ | ❌ |
| سجل النشاط | Activity Log | ✅ | ✅ | ❌ |
| التواصل | Message Templates | ✅ | ✅ | ❌ |
| الأنساب | Munasib Manager | ✅ | ✅ | ✅ |
| مراجعة الاقتراحات | Suggestion Review | ✅ | ✅ | ✅ |

**Architecture Notes (October 24, 2025):**
- `isAdmin` check updated to align with feature-based system (includes moderator)
- `admin_get_enhanced_statistics()` RPC updated to allow all admin roles
- Features still respect granular permissions from `ADMIN_FEATURES` registry
- No manual conditional logic needed in components

**To add new features:**
1. Add feature config to `ADMIN_FEATURES` registry with `requiredRoles` array
2. Feature automatically respects role-based access control via `useFeatureAccess()` hook
3. Feature visibility handled by `canAccess(featureId)` - no manual conditionals needed
4. Route protection and RPC checks automatically respect the system

---

## Critical Migrations Quick Reference

| Migration | Purpose | Status |
|-----------|---------|--------|
| **005** | Family Edit Permissions System | ✅ Deployed |
| **006** | Super Admin Permissions | ✅ Deployed |
| **077** | Admin Update Marriage RPC | ✅ Deployed |
| **078** | Marriage Status Simplification (current/past) | ✅ Deployed |
| **083** | Optimized Mother Picker Query | ✅ Deployed |
| **084a** | Batch Permission Validator | ✅ Deployed |
| **084b** | Cascade Soft Delete | ✅ Deployed |
| **20251014120000** | Undo System (initial) | ✅ Deployed |
| **20251015010000-050000** | Undo Safety Mechanisms (5 migrations) | ✅ Deployed |
| **20251015040000** | Operation Groups Integration | ✅ Deployed |
| **20251016120000** | Permission Manager Optimized RPC | ✅ Deployed |
| **20250116000000** | Simplified Permission System (v4.3) | ✅ Deployed |

See [`MIGRATION_GUIDE.md`](docs/MIGRATION_GUIDE.md) for detailed migration documentation.

---

## Undo System - Supported Action Types

| Action Type | RPC Function | Admin Only | Time Limit | Dangerous |
|-------------|-------------|-----------|-----------|-----------|
| `profile_update` | `undo_profile_update` | ❌ | 30 days | ❌ |
| `profile_soft_delete` | `undo_profile_delete` | ❌ | 30 days | ❌ |
| `profile_cascade_delete` | `undo_cascade_delete` | ✅ | 7 days | ✅ |
| `add_marriage` | `undo_marriage_create` | ✅ | Unlimited | ✅ |
| `admin_update` | `undo_profile_update` | ❌ | 30 days | ❌ |
| `admin_delete` | `undo_profile_delete` | ❌ | 30 days | ❌ |
| `crop_update` | `undo_crop_update` | ❌ | 30 days | ❌ |
| `photo_delete` | `undo_photo_delete` | ❌ | 30 days | ❌ |

See [`UNDO_SYSTEM_TEST_CHECKLIST.md`](docs/UNDO_SYSTEM_TEST_CHECKLIST.md) for comprehensive undo system documentation.

---

## Permission Levels - User Roles

| Permission Level | Edit Rights | Example Relationships |
|-----------------|-------------|---------------------|
| `admin` | Direct edit | Super admin or admin role |
| `moderator` | Direct edit | Branch moderator for assigned subtree |
| `inner` | Direct edit | Self, spouse, parents, children, siblings, descendants |
| `suggest` | Suggest only (manual approval) | Grandparents, aunts, uncles, cousins, extended family |
| `blocked` | None | Explicitly blocked users |
| `none` | None | Not related to target profile |

See [`PERMISSION_SYSTEM_V4.md`](docs/PERMISSION_SYSTEM_V4.md) for full permission system documentation.
