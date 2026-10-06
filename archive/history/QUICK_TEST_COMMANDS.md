# Quick Test Commands for Shift Deletion Fix

## 1️⃣ **Check Current Database State**
```bash
node scripts/test-shift-delete.js
```
Expected: Shows shift count (probably 0 if not imported yet)

## 2️⃣ **Start the Application**
```bash
npm run dev
```
Or for production:
```bash
npm run electron:serve
```

## 3️⃣ **Import Your CSV**
1. Go to Shifts page
2. Click "Import from CSV"
3. Select your 416-shift file
4. Watch for success message

## 4️⃣ **Verify Database After Import**
```bash
node scripts/test-shift-delete.js
```
Expected: Shows "Total shifts in database: 416"

## 5️⃣ **Test Delete Function**
1. Click trash icon on any shift
2. Confirm deletion
3. Should see success message
4. Shift should disappear

## 6️⃣ **Check Console Logs** (F12 in app)
Should see:
- `[DEBUG] Deleting shift with ID: xxx`
- Backend logs showing deletion success

## 7️⃣ **Verify Persistence**
1. Refresh the app (Ctrl+R)
2. Shifts should still be there (minus deleted ones)
3. Delete should continue working

---

**If everything works, the issue is FIXED! 🎉**