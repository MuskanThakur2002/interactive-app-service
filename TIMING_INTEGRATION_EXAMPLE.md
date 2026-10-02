# Share-to-Earn Timing Integration Example

## 🕐 How the 5-Minute Window Works with `createAnonymousUser`

This example shows the **exact flow** of how timing is checked when users click referral links and open your app.

## 📱 Real-World Scenario

### **User A** (Referrer) creates link:
```javascript
// User A calls your API
POST /api/share/init
{
  "userId": "user_A_123",
  "linkType": "universal"
}

// Response: Bitly deep link
{
  "shortUrl": "https://bit.ly/abc123",
  "referralCode": "XYZ789"
}
```

### **User B** (Friend) clicks link:
```javascript
// 1. User B taps Bitly link → opens web page → calls your API
POST /api/share/open
{
  "referralCode": "XYZ789",
  "deviceId": "device_456",
  "isDeepLink": true,
  "platform": "ios"
}

// System stores: referralOpenTime = "2024-01-15T10:00:00Z"
// Sets cookie: pending_referral_device_456
```

### **User B** opens mobile app:
```javascript
// 2. User B's app calls createAnonymousUser (your existing API)
POST /api/users/anonymous-login
{
  "deviceId": "device_456"
}

// 🔍 AUTOMATIC TIMING CHECK HAPPENS HERE:
// - System finds pending referral by deviceId
// - Compares: userCreatedAt vs referralOpenTime
// - If ≤ 5 minutes → NEW USER → Give BOTH rewards immediately!
//   * Friend: +10 💎 (welcome bonus)
//   * Referrer: +5 💎 (referral reward)
```

## ⏱️ Timing Scenarios

### ✅ **Scenario 1: IMMEDIATE (Both Rewards Given)**
```
10:00:00 - User B clicks referral link
10:01:30 - User B opens app → createAnonymousUser called
         - Time difference: 1.5 minutes ≤ 5 minutes ✅
         - Result: NEW USER → +10 💎 for User B, +5 💎 for User A
```

### ✅ **Scenario 2: QUICK (Both Rewards Given)**
```
10:00:00 - User B clicks referral link
10:04:45 - User B opens app → createAnonymousUser called
         - Time difference: 4.75 minutes ≤ 5 minutes ✅
         - Result: NEW USER → +10 💎 for User B, +5 💎 for User A
```

### ❌ **Scenario 3: TOO SLOW (No Rewards)**
```
10:00:00 - User B clicks referral link
10:06:30 - User B opens app → createAnonymousUser called
         - Time difference: 6.5 minutes > 5 minutes ❌
         - Result: EXISTING USER → No rewards for anyone
```

### ❌ **Scenario 4: EXISTING USER (No Rewards)**
```
09:30:00 - User B already created account (existing user)
10:00:00 - User B clicks referral link
10:01:00 - User B opens app → createAnonymousUser finds existing user
         - Result: EXISTING USER → No rewards
```

## 🔧 Code Integration

### Your existing `createAnonymousUser` now automatically handles this:

```javascript
// Before (your old code):
const user = new User({
  deviceId,
  name: "Anonymous", 
  authProvider: "anonymous",
  diamonds: 1000
});
await user.save();

// After (automatic integration):
const user = new User({
  deviceId,
  name: "Anonymous",
  authProvider: "anonymous", 
  diamonds: 1000
});
await user.save();

// 🚀 NEW: Automatic referral check (BOTH rewards given immediately)
const referralResult = await processPendingReferralForNewUser(user._id, deviceId, req, res);
if (referralResult.success) {
  user.diamonds += referralResult.friendReward.amount; // +10 💎 for friend
  await user.save();
  // Referrer automatically gets +5 💎 (handled by service)
}
```

### Enhanced Response Format:

```javascript
// Your createAnonymousUser now returns:
{
  "user": {
    "_id": "new_user_123",
    "diamonds": 1010,  // 1000 + 10 from referral
    "deviceId": "device_456"
  },
  "authToken": "jwt_token_here",
  "userMobileSetting": {...},
  
  // 🆕 NEW: Referral info (if user was referred)
  "referralInfo": {
    "wasReferred": true,
    "referralCode": "XYZ789",
    "friendReward": {
      "success": true,
      "amount": 10,
      "newBalance": 1010
    },
    "referrerReward": {
      "success": true,
      "amount": 5,
      "newBalance": 145
    },
    "message": "Welcome! You got 10 💎 from a friend's referral!"
  }
}
```

## 🎯 Key Benefits

1. **Zero code changes needed** - Works with your existing `createAnonymousUser`
2. **Accurate timing** - Exact timestamp comparison 
3. **Prevents abuse** - Only genuine new users get rewards
4. **Seamless UX** - Users get rewards immediately when app opens
5. **Extended window** - 30 minutes to open app, but 5 minutes for "new" status

## 📊 Monitoring & Logs

The system logs everything for debugging:

```
INFO: Share opened: XYZ789 {
  referralCode: 'XYZ789',
  userId: 'pre-login', 
  deviceId: 'device_456',
  event: 'share_opened'
}

INFO: NEW USER new_user_123 referred via XYZ789: Friend reward = 10 diamonds

INFO: User new_user_123 newness check: created 2.34 minutes before referral open. Considered: NEW
```

---

**Result**: Your existing app flow works perfectly, but now **BOTH** users get rewards immediately when someone joins through a referral link - no waiting or scene completion needed! 🎉

**Friend**: +10 💎 instantly when account created  
**Referrer**: +5 💎 instantly when friend joins (if under daily limit) 