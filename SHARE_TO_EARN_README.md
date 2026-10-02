# Share-to-Earn System Documentation

## Overview

The share-to-earn system allows users to invite friends and earn diamond rewards through a **claim-based system**. Users must manually claim their rewards rather than receiving them automatically.

## Business Rules

### Reward System - CLAIM BASED ⭐
- **Referrer**: +5 💎 (available to claim when friend joins, max 3 per 24h)
- **Friend**: +10 💎 (available to claim on first app open, can only be referred once)
- **New Users Only**: Rewards only available if friend creates account within 5 minutes of clicking referral link
- **Manual Claiming**: Users must call claim APIs to actually receive diamonds

### Key Features
- **Claim-based rewards**: No automatic diamond distribution
- **WebSocket notifications**: Real-time alerts when rewards become available
- **Daily referral limits**: Max 3 successful referrals per referrer per day
- **One-time friend rewards**: Each user can only be referred once ever
- **Time-window validation**: 5-minute window for "new user" eligibility

## API Endpoints

### 1. Create Referral Link
```http
POST /api/share/init
```

**Request:**
```json
{
  "userId": "user123",
  "linkType": "universal" // "universal", "custom-scheme", "smart"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shortUrl": "https://bit.ly/abc123",
    "referralCode": "ABC12345",
    "linkType": "universal",
    "dailyLimit": {
      "count": 1,
      "canRefer": true,
      "remaining": 2
    }
  }
}
```

### 2. Open Referral Link
```http
POST /api/share/open
```

**Request:**
```json
{
  "referralCode": "ABC12345",
  "userId": "friend123", // Optional for pre-login
  "deviceId": "device456",
  "platform": "ios"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Referral link opened successfully - rewards available for claiming",
  "data": {
    "referralId": "ref_789",
    "friendReward": {
      "available": true,
      "amount": 10,
      "message": "+10 💎 welcome bonus available to claim!"
    },
    "referrerReward": {
      "available": true,
      "amount": 5,
      "message": "+5 💎 available to claim from referral!"
    }
  }
}
```

### 3. Claim Friend Reward ⭐ NEW
```http
POST /api/share/claim/friend
```

**Request:**
```json
{
  "userId": "friend123",
  "referralId": "ref_789"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "amount": 10,
    "newBalance": 1010,
    "message": "+10 💎 claimed successfully!"
  }
}
```

### 4. Claim Referrer Reward ⭐ NEW
```http
POST /api/share/claim/referrer
```

**Request:**
```json
{
  "userId": "user123",
  "referralId": "ref_789"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "amount": 5,
    "newBalance": 145,
    "message": "+5 💎 claimed from referral!"
  }
}
```

### 5. Get Available Rewards ⭐ NEW
```http
GET /api/share/rewards/available?userId=user123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "friendRewards": [
      {
        "referralId": "ref_789",
        "amount": 10,
        "referrerName": "John Doe",
        "openedAt": "2024-01-15T10:30:00Z",
        "message": "+10 💎 welcome bonus"
      }
    ],
    "referrerRewards": [
      {
        "referralId": "ref_456",
        "amount": 5,
        "friendName": "Jane Smith",
        "openedAt": "2024-01-15T11:00:00Z",
        "message": "+5 💎 from referral"
      }
    ],
    "totals": {
      "friendRewards": 10,
      "referrerRewards": 5,
      "total": 15
    }
  }
}
```

## WebSocket Events

### 1. Reward Available Notification
```javascript
{
  type: 'referral_notification',
  data: {
    notificationType: 'reward_available',
    type: 'friend_reward', // or 'referrer_reward'
    amount: 10,
    message: "+10 💎 welcome bonus available to claim!",
    referralId: "ref_789",
    actionRequired: 'claim'
  }
}
```

### 2. Successful Claim Notification
```javascript
{
  type: 'diamond_update',
  data: {
    newBalance: 1010,
    message: "+10 💎 claimed successfully!",
    metadata: {
      source: 'referral_friend_reward_claimed',
      referralId: "ref_789",
      amount: 10
    }
  }
}
```

## Updated User Flow

### 1. User A Creates Referral Link
```
User A → POST /share/init → Gets https://bit.ly/abc123
```

### 2. Friend Downloads & Opens App
```
Friend clicks link → Opens app → Referral detected
Friend gets notification: "10 💎 available to claim!"
User A gets notification: "5 💎 available to claim from referral!"
```

### 3. Users Claim Their Rewards
```
Friend → POST /share/claim/friend → Gets +10 💎
User A → POST /share/claim/referrer → Gets +5 💎
```

## Error Handling

### Claim Errors
- **Already Claimed**: `400` - "Friend/Referrer reward already claimed"
- **No Reward Available**: `400` - "No reward available for this referral"
- **Daily Limit Reached**: `429` - "Daily referral limit reached (3/3). Cannot claim more rewards today."
- **Unauthorized**: `400` - "Invalid referral or unauthorized user"

### Open Errors
- **Already Referred**: `409` - User already referred by someone else
- **Existing User**: `403` - Rewards only for new users (within 5 minutes)
- **Self Referral**: `400` - Cannot refer yourself
- **Invalid Code**: `400` - Invalid referral code

## Database Schema Changes

### Referral Model Updates
```javascript
{
  // ... existing fields ...
  claimedAt: Date,              // When rewards were claimed
  friendRewardClaimed: Boolean, // Whether friend claimed their reward
  referrerRewardClaimed: Boolean, // Whether referrer claimed their reward
  friendRewardAmount: Number,   // Amount available for friend
  referrerRewardAmount: Number  // Amount available for referrer
}
```

## Environment Variables

```bash
# Deep Linking
UNIVERSAL_LINK_DOMAIN=troak.onelink.me
CUSTOM_SCHEME=troak://
APP_STORE_ID=your_app_store_id

# Bitly Integration
BITLY_ACCESS_TOKEN=your_bitly_token
BITLY_GROUP_GUID=your_group_guid

# Referral Settings  
NEW_USER_WINDOW_MINUTES=5
REFERRER_REWARD_AMOUNT=5
FRIEND_REWARD_AMOUNT=10
DAILY_REFERRAL_LIMIT=3
```

## Benefits of Claim-Based System

### ✅ **Better User Experience**
- **User Control**: Users decide when to claim rewards
- **Engagement**: Creates interaction moments
- **Clear Actions**: Users know exactly what they need to do

### ✅ **Better Business Logic**
- **Fraud Prevention**: Manual claiming adds verification step
- **Resource Management**: No immediate diamond distribution
- **Analytics**: Track claim rates vs. availability rates

### ✅ **Technical Benefits**
- **Atomic Operations**: Clean transaction handling
- **Audit Trail**: Clear history of when rewards were claimed
- **Flexibility**: Easy to modify reward amounts before claiming

## Migration Notes

- Legacy `/share/convert` endpoint still exists but is deprecated
- Existing automatic reward code has been replaced with claim-based system
- WebSocket notifications now send "available to claim" instead of "diamonds awarded"
- User responses include `actionRequired` guidance

---

**Status**: ✅ **Claim-based system fully implemented**
**Date**: 2024-01-15
**Version**: 2.0 (Claim-based rewards) 