# RPC Logging - Testing Instructions

**Quick guide to verify the logging system is working**

---

## 🧪 Test 1: Verify Logging is Active

### Step 1: Start the App
```bash
npm start
```

### Step 2: Open Console
- **iOS Simulator**: Press `Cmd + D` → "Debug JS Remotely"
- **Android Emulator**: Press `Cmd + M` → "Debug"
- **Physical Device**: Shake device → "Debug"

### Step 3: Trigger Any RPC Call

**Easiest test**: Open any profile in the app
- This will trigger `get_branch_data` RPC call
- You should see logs like:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔵 RPC CALL: get_branch_data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️  Started at: 2025-10-15T...
📤 Parameters: { "p_hid": "Q1", "p_max_depth": 3, ... }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**✅ If you see these logs** → Logging is working!
**❌ If no logs appear** → Check console is connected

---

## 🧪 Test 2: Test Profile Creation Logging

### Step 1: Navigate to Admin Dashboard
- Login as admin
- Go to Admin Dashboard

### Step 2: Try to Create a Profile
- Click "إضافة فرد جديد" (Add New Person)
- Fill in the form:
  - Name: "اختبار التسجيل" (Logging Test)
  - Gender: Male
  - Generation: 5
  - (Other fields optional)
- Click Submit

### Step 3: Check Console for Detailed Logs

You should see:

```
╔════════════════════════════════════════════════════════════╗
║  🆕 CREATE PROFILE - DETAILED DEBUG LOG                   ║
╚════════════════════════════════════════════════════════════╝

📥 INCOMING PROFILE DATA:
────────────────────────────────────────────────────────────
{
  "name": "اختبار التسجيل",
  "gender": "male",
  "generation": 5,
  ...
}
────────────────────────────────────────────────────────────

📤 MAPPED RPC PARAMETERS:
────────────────────────────────────────────────────────────
{
  "p_name": "اختبار التسجيل",
  "p_gender": "male",
  "p_generation": 5,
  ...
}
────────────────────────────────────────────────────────────

✅ All critical fields present

🚀 Calling admin_create_profile RPC...
```

Then one of two outcomes:

### ✅ Success Case:
```
╔════════════════════════════════════════════════════════════╗
║  ✅ PROFILE CREATED SUCCESSFULLY                          ║
╚════════════════════════════════════════════════════════════╝

📍 Created Profile Data:
{
  "id": "...",
  "name": "اختبار التسجيل",
  "hid": "Q5.1.2.3",
  ...
}
```

### ❌ Error Case:
```
╔════════════════════════════════════════════════════════════╗
║  ❌ RPC ERROR OCCURRED                                     ║
╚════════════════════════════════════════════════════════════╝

📍 Error Code: 42883
📍 Error Message: function admin_create_profile(...) does not exist
📍 Error Details: ...
📍 Error Hint: ...

📍 Full Error Object:
{ ... }
```

---

## 🧪 Test 3: Test Profile Edit Logging

### Step 1: Open Any Profile
- Tap on a profile in the tree

### Step 2: Try to Edit
- Tap the edit/three-dots menu
- Make any change (e.g., add a nickname)
- Save

### Step 3: Check Console

You should see:
```
🔵 RPC CALL: admin_update_profile
📤 Parameters: {
  "p_id": "...",
  "p_version": 1,
  "p_updates": {
    "nickname": "Test Nickname"
  }
}
```

Then either success or error logs.

---

## 📊 What to Look For

### 🟢 Good Signs (Logging Working)
- ✅ Colored emoji boxes appear
- ✅ Parameters are logged before RPC call
- ✅ Response is logged after RPC call
- ✅ Timing is shown (duration in ms)

### 🔴 Bad Signs (Issues to Report)
- ❌ No logs appear → Console not connected
- ❌ Error Code 42883 → RPC function doesn't exist
- ❌ Error Code 23503 → Foreign key violation (parent doesn't exist)
- ❌ Error Code 22P02 → Wrong data type
- ❌ Validation warnings → Missing required fields

---

## 📝 How to Report Issues

When reporting issues, **copy the entire log block** including:

1. **CREATE PROFILE section** (if creating):
```
╔════════════════════════════════════════════════════════════╗
║  🆕 CREATE PROFILE - DETAILED DEBUG LOG                   ║
╚════════════════════════════════════════════════════════════╝
...
```

2. **RPC CALL section**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔵 RPC CALL: admin_create_profile
...
```

3. **RPC RESPONSE section**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 RPC ERROR: admin_create_profile
...
```

**This gives complete context for debugging!**

---

## 🛠️ Troubleshooting

### No Console Logs Appearing?

**Try this**:
1. Restart Metro bundler: `Ctrl+C` then `npm start`
2. Clear cache: `npm start -- --reset-cache`
3. Reload app: Shake device → "Reload"
4. Check console is open: Chrome DevTools or React Native Debugger

### Too Verbose?

**Filter logs** by searching for:
- `🔵` - RPC calls starting
- `🟢` - RPC success
- `🔴` - RPC errors
- `🆕` - Profile creation

### Want Cleaner Logs?

**Temporarily disable** in `src/services/supabase.js`:
```javascript
// Comment this line:
// supabaseClient.rpc = wrapRPCWithLogging(originalRpc);
```

---

## ✅ Success Criteria

After testing, you should be able to answer:

1. **Is logging active?** → Yes, I see emoji logs
2. **What RPC function is called?** → (e.g., admin_create_profile)
3. **What parameters are sent?** → (see 📤 Parameters section)
4. **Did it succeed or fail?** → (🟢 success or 🔴 error)
5. **If failed, what error code?** → (e.g., 42883, 23503)

**Share these answers** along with the logs to debug the issue!

---

**Status**: Ready for testing! 🚀
**Next**: Run the tests above and share the logs
