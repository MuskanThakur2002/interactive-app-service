# ✅ UPDATED: Share-to-Earn API Flow (Immediate Rewards)

## 🎯 **Key Change**: No Scene 1 Completion Required

**OLD FLOW**: Friend gets 10 💎 → Friend completes scene 1 → Referrer gets 5 💎  
**NEW FLOW**: Friend creates account → **BOTH get rewards immediately** (10 💎 + 5 💎)

---

## 🔄 **Updated API Flow Example**

Here's how the APIs work together now:

```javascript
// 1. User A creates referral link
POST /api/share/init 
{
  "userId": "user_A_123",
  "linkType": "universal"
}
// Returns: https://bit.ly/abc123

// 2. User B clicks the Bitly link (pre-login)
POST /api/share/open 
{
  "referralCode": "XYZ789",
  "deviceId": "device_456"
}
// Stores pending referral by deviceId

// 3. User B opens app → createAnonymousUser called
POST /api/users/anonymous-login 
{
  "deviceId": "device_456"
}
// ✨ AUTOMATIC: processPendingReferralForNewUser called
// ✨ BOTH REWARDS GIVEN IMMEDIATELY:
//   - User B: +10 💎 (friend reward)
//   - User A: +5 💎 (referrer reward)

// 4. ✅ DONE! No more steps needed
// 5. Optional: Check statistics anytime
GET /api/share/stats/user_A_id
```

---

## 📱 **Updated Response Examples**

### `createAnonymousUser` Response (with referral):
```json
{
  "user": {
    "_id": "new_user_123",
    "diamonds": 1010,  // 1000 + 10 from referral
    "deviceId": "device_456"
  },
  "authToken": "jwt_token_here",
  "userMobileSetting": {...},
  
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

### `processPendingReferralForNewUser` Response:
```json
{
  "success": true,
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
  "referralCode": "XYZ789",
  "message": "Referral processed successfully",
  "timeDifference": "2.34"
}
```

---

## 🚀 **Real-Time Notifications**

Both users get instant WebSocket notifications:

**Friend receives:**
```javascript
// diamond_update event
{
  "type": "diamond_update",
  "balance": 1010,
  "message": "+10 💎 welcome bonus!",
  "source": "referral_friend_reward"
}

// toast_notification event  
{
  "type": "success",
  "message": "+10 💎 welcome bonus!",
  "icon": "💎",
  "duration": 5000
}
```

**Referrer receives:**
```javascript
// diamond_update event
{
  "type": "diamond_update", 
  "balance": 145,
  "message": "+5 💎 from referral!",
  "source": "referral_referrer_reward"
}

// toast_notification event
{
  "type": "success",
  "message": "+5 💎 from referral!",
  "icon": "💎", 
  "duration": 5000
}
```

---

## ⚠️ **Daily Limit Scenario**

If referrer has reached daily limit (3/day):

```json
{
  "success": true,
  "friendReward": {
    "success": true,
    "amount": 10,
    "newBalance": 1010
  },
  "referrerReward": {
    "success": false,
    "message": "Daily referral limit reached (3/3)",
    "reason": "DAILY_LIMIT_REACHED"
  }
}
```

**Referrer gets notification:**
```javascript
// referral_notification event
{
  "type": "referral_notification",
  "subType": "daily_limit_reached", 
  "message": "A friend joined through your link, but you've reached your daily referral limit (3/day). Try again tomorrow!"
}
```

---

## 🎯 **Key Benefits of Immediate Rewards**

1. **Instant Gratification** - Both users get rewards right away
2. **No Waiting** - No need to complete scenes or wait for actions
3. **Better UX** - Clear immediate feedback
4. **Simpler Logic** - Fewer steps, less complexity
5. **Higher Conversion** - Users see value immediately

---

## 📊 **Updated Endpoint Status**

### ✅ **Active Endpoints:**
- `POST /api/share/init` - Create referral links
- `POST /api/share/deep-links` - Get all link types
- `POST /api/share/open` - Handle link clicks
- `POST /api/share/process-pending` - Auto-called by createAnonymousUser
- `GET /api/share/stats` - Get statistics

### 🔄 **Legacy Endpoint:**
- `POST /api/share/convert` - Now rarely used (kept for backward compatibility)

---

**Users can share anytime they want, and both users get rewards immediately when someone new joins! No scene completion required.** 🎉 