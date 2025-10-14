# RPC Logging Implementation - Debugging Guide

**Status**: ✅ Deployed and Active
**Date**: 2025-10-15
**Purpose**: Comprehensive debugging to identify why profile edits aren't working

---

## 🎯 What Was Implemented

### 1. RPC Logger Utility (`src/utils/rpcLogger.js`)

A comprehensive logging system with:
- **Colored emoji indicators** for easy visual scanning
- **Detailed parameter logging** - shows exactly what's being sent to RPC functions
- **Timing metrics** - measures execution time for performance analysis
- **Error details** - captures full error objects with code, message, details, and hints
- **Response data** - shows what the database returns

**Key Functions**:
```javascript
logRPCCall(functionName, params)      // Logs when RPC is called
logRPCResponse(functionName, response, duration)  // Logs success/error
wrapRPCWithLogging(originalRpc)       // Wraps supabase.rpc
```

### 2. Global RPC Interceptor (`src/services/supabase.js`)

**ALL** RPC calls are now automatically logged:
- Intercepts every `supabase.rpc()` call in the entire app
- Logs parameters before execution
- Logs responses after execution
- Measures timing for performance analysis

**No code changes needed** - logging happens automatically!

### 3. Enhanced createProfile Debugging (`src/services/profiles.js`)

Added **detailed debugging** to the `createProfile` function:

**Logs**:
- ✅ Incoming profile data from component
- ✅ Mapped RPC parameters
- ✅ Validation warnings for missing critical fields
- ✅ Full error details if RPC fails
- ✅ Success confirmation with created profile data
- ✅ Exception stack traces for unexpected errors

---

## 📊 What You'll See in Logs

### Example: Successful Profile Creation

```
╔════════════════════════════════════════════════════════════╗
║  🆕 CREATE PROFILE - DETAILED DEBUG LOG                   ║
╚════════════════════════════════════════════════════════════╝

📥 INCOMING PROFILE DATA:
────────────────────────────────────────────────────────────
{
  "name": "أحمد القفاري",
  "gender": "male",
  "generation": 5,
  "father_id": "abc-123-def"
}
────────────────────────────────────────────────────────────

📤 MAPPED RPC PARAMETERS:
────────────────────────────────────────────────────────────
{
  "p_name": "أحمد القفاري",
  "p_gender": "male",
  "p_generation": 5,
  "p_father_id": "abc-123-def",
  "p_mother_id": null,
  ...
}
────────────────────────────────────────────────────────────

✅ All critical fields present

🚀 Calling admin_create_profile RPC...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔵 RPC CALL: admin_create_profile
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Started at: 2025-10-15T01:30:00.000Z
📤 Parameters: { "p_name": "أحمد القفاري", ... }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢 RPC SUCCESS: admin_create_profile
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Completed at: 2025-10-15T01:30:01.234Z
⏲️  Duration: 1234ms
✅ Response Data:
   Object: {
     "id": "new-profile-uuid",
     "name": "أحمد القفاري",
     "hid": "Q5.1.2.3",
     ...
   }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔════════════════════════════════════════════════════════════╗
║  ✅ PROFILE CREATED SUCCESSFULLY                          ║
╚════════════════════════════════════════════════════════════╝
```

### Example: RPC Error

```
╔════════════════════════════════════════════════════════════╗
║  ❌ RPC ERROR OCCURRED                                     ║
╚════════════════════════════════════════════════════════════╝

📍 Error Code: 42883
📍 Error Message: function admin_create_profile(...) does not exist
📍 Error Details: No function matches the given name and argument types
📍 Error Hint: You might need to add explicit type casts.

📍 Full Error Object:
{
  "code": "42883",
  "message": "function admin_create_profile(...) does not exist",
  "details": "No function matches the given name and argument types",
  "hint": "You might need to add explicit type casts."
}
```

---

## 🔍 How to Use This for Debugging

### Step 1: Reproduce the Issue
1. Open the app
2. Try to create/edit a profile
3. Watch the console logs in real-time

### Step 2: Check the Logs

Look for these **key indicators**:

#### 🔴 **Error Code 42883** - Function doesn't exist
```
Error Code: 42883
Error Message: function admin_create_profile() does not exist
```
**Meaning**: The RPC function is missing from the database
**Action**: Check migrations, verify function exists in Supabase

#### 🔴 **Error Code 42P01** - Table doesn't exist
```
Error Code: 42P01
Error Message: relation "profiles" does not exist
```
**Meaning**: Database table is missing
**Action**: Run migrations

#### 🔴 **Error Code 23503** - Foreign key violation
```
Error Code: 23503
Error Message: violates foreign key constraint
```
**Meaning**: Referenced record doesn't exist (e.g., father_id is invalid)
**Action**: Verify parent records exist

#### 🔴 **Error Code 23505** - Duplicate key
```
Error Code: 23505
Error Message: duplicate key value violates unique constraint
```
**Meaning**: Record already exists
**Action**: Check for duplicates

#### ⚠️ **Validation Warnings**
```
⚠️  VALIDATION WARNINGS:
   ⚠️  Missing p_generation (CRITICAL!)
```
**Meaning**: Required field is missing
**Action**: Fix component to provide required data

### Step 3: Share Logs with Developer

Copy the **entire log section** from:
```
╔════════════════════════════════════════════════════════════╗
║  🆕 CREATE PROFILE - DETAILED DEBUG LOG                   ║
╚════════════════════════════════════════════════════════════╝
```

Down to:
```
────────────────────────────────────────────────────────────
```

This gives complete context for debugging.

---

## 📋 Common Error Codes Reference

| Code | Meaning | Common Causes |
|------|---------|---------------|
| **42883** | Function not found | Migration not run, wrong function name |
| **42P01** | Table not found | Migration not run |
| **23503** | Foreign key violation | Referenced record doesn't exist |
| **23505** | Unique constraint violation | Duplicate HID/unique field |
| **22P02** | Invalid input syntax | Wrong data type (e.g., string for integer) |
| **42P02** | Undefined parameter | Missing required parameter |
| **P0001** | Raised exception | Custom error from function (check message) |

---

## 🛠️ Troubleshooting

### No Logs Appearing?

**Check**:
1. Metro bundler is running (`npm start`)
2. Console is open (React Native Debugger or browser console)
3. Log filters aren't hiding messages

### Too Many Logs?

**Filter by emoji**:
- `🔵` - RPC calls starting
- `🟢` - RPC success
- `🔴` - RPC errors
- `🆕` - Profile creation specifically

### Want to Disable Logging?

**Temporary disable**:
```javascript
// In src/services/supabase.js, comment out:
// supabaseClient.rpc = wrapRPCWithLogging(originalRpc);
```

**Restore**:
```javascript
// Uncomment to re-enable
supabaseClient.rpc = wrapRPCWithLogging(originalRpc);
```

---

## 🎯 Next Steps for Debugging

Now that logging is active:

1. **Try creating a profile** - Check what parameters are sent
2. **Try editing a profile** - See if `admin_update_profile` is called
3. **Check error codes** - Match against reference table above
4. **Verify function signatures** - Ensure parameters match database function

**Share the logs** with the full error details to identify the root cause!

---

## 📁 Files Modified

1. ✅ `/Users/alqefari/Desktop/AlqefariTreeRN-Expo/src/utils/rpcLogger.js` - **Created**
2. ✅ `/Users/alqefari/Desktop/AlqefariTreeRN-Expo/src/services/supabase.js` - **Modified** (added RPC wrapper)
3. ✅ `/Users/alqefari/Desktop/AlqefariTreeRN-Expo/src/services/profiles.js` - **Modified** (enhanced createProfile logging)

---

**Status**: Ready for testing! 🚀
