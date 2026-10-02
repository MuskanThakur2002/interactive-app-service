# Monetization Framework Documentation

## Overview

This document describes the complete monetization framework implemented for the interactive story app. The framework includes daily rewards, time-based rewards, scene unlocks, and paid choices.

## Features Implemented

### 1. Daily Rewards System

**Pattern**: 
- Days 1-6: 2 diamonds each
- Day 7: 5 diamonds
- Days 8-13: 3 diamonds each  
- Day 14: 7 diamonds
- Pattern repeats every 14 days

**API Endpoints**:
- `GET /api/monetization/daily-rewards/status/:userId` - Check daily reward status
- `POST /api/monetization/daily-rewards/claim/:userId` - Claim daily reward

**Models**: `DailyRewards`

### 2. Time-Based Rewards

**Reward**: 1 diamond per hour spent on the app

**API Endpoints**:
- `POST /api/monetization/time-tracking/start` - Start time tracking session
- `POST /api/monetization/time-tracking/end` - End time tracking session
- `GET /api/monetization/time-tracking/stats/:userId` - Get time tracking stats

**Models**: `TimeTracking`

### 3. Scene Unlock System

**Free Scenes**: First 2 scenes of each chapter are free
**Paid Unlock**: 3 diamonds per scene after free limit
**Time-Based Unlock**: 24-hour unlock option

**API Endpoints**:
- `POST /api/monetization/scene-unlock` - Unlock a scene
- `GET /api/monetization/scene-access/:userId/:storyId/:chapterId/:sceneId?` - Check scene access

**Models**: `SceneUnlock`, Updated `UserProgressV2`

### 4. Paid Choices System

**AI-Defined Costs**: 1-5 diamonds per choice based on content analysis

**API Endpoints**:
- `POST /api/monetization/paid-choice/process` - Process paid choice purchase
- `POST /api/monetization/paid-choice/cost` - Get choice cost
- `POST /api/monetization/paid-choice/validate` - Validate if user can afford
- `POST /api/monetization/paid-choice/costs` - Get costs for multiple choices

**Services**: `PaidChoiceService`

## Database Models

### DailyRewards
```javascript
{
  userId: ObjectId,
  lastClaimDate: Date,
  consecutiveDays: Number,
  totalDaysClaimed: Number,
  lastRewardAmount: Number
}
```

### TimeTracking
```javascript
{
  userId: ObjectId,
  sessionStartTime: Date,
  sessionEndTime: Date,
  totalSessionTime: Number,
  diamondsEarned: Number,
  isActive: Boolean,
  deviceId: String,
  storyId: ObjectId,
  chapterId: ObjectId
}
```

### SceneUnlock
```javascript
{
  userId: ObjectId,
  storyId: ObjectId,
  chapterId: ObjectId,
  sceneId: ObjectId,
  unlockType: String, // 'PAID', 'TIME_BASED', 'FREE'
  diamondsSpent: Number,
  unlockTime: Date,
  expiresAt: Date,
  isActive: Boolean,
  transactionId: ObjectId
}
```

### Updated UserProgressV2
Added fields:
```javascript
{
  freeScenesUsed: Number,
  paidScenesUnlocked: Number,
  totalDiamondsSpent: Number,
  lastSceneUnlockTime: Date,
  isChapterUnlocked: Boolean,
  chapterUnlockExpiresAt: Date
}
```

## API Usage Examples

### Daily Rewards

**Check Status**:
```bash
GET /api/monetization/daily-rewards/status/64f1a2b3c4d5e6f7g8h9i0j1
```

**Claim Reward**:
```bash
POST /api/monetization/daily-rewards/claim/64f1a2b3c4d5e6f7g8h9i0j1
```

### Time Tracking

**Start Session**:
```bash
POST /api/monetization/time-tracking/start
{
  "userId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "storyId": "64f1a2b3c4d5e6f7g8h9i0j2",
  "chapterId": "64f1a2b3c4d5e6f7g8h9i0j3",
  "deviceId": "device123"
}
```

**End Session**:
```bash
POST /api/monetization/time-tracking/end
{
  "sessionId": "64f1a2b3c4d5e6f7g8h9i0j4",
  "userId": "64f1a2b3c4d5e6f7g8h9i0j1"
}
```

### Scene Unlock

**Unlock Scene**:
```bash
POST /api/monetization/scene-unlock
{
  "userId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "storyId": "64f1a2b3c4d5e6f7g8h9i0j2",
  "chapterId": "64f1a2b3c4d5e6f7g8h9i0j3",
  "sceneId": "64f1a2b3c4d5e6f7g8h9i0j5",
  "unlockType": "PAID"
}
```

**Check Access**:
```bash
GET /api/monetization/scene-access/64f1a2b3c4d5e6f7g8h9i0j1/64f1a2b3c4d5e6f7g8h9i0j2/64f1a2b3c4d5e6f7g8h9i0j3/64f1a2b3c4d5e6f7g8h9i0j5
```

### Paid Choices

**Get Choice Cost**:
```bash
POST /api/monetization/paid-choice/cost
{
  "choiceData": {
    "text": "Take the romantic path",
    "context": "romantic",
    "storyProgress": 0.8,
    "storyId": "64f1a2b3c4d5e6f7g8h9i0j2",
    "chapterId": "64f1a2b3c4d5e6f7g8h9i0j3",
    "sceneId": "64f1a2b3c4d5e6f7g8h9i0j5"
  }
}
```

**Process Choice Purchase**:
```bash
POST /api/monetization/paid-choice/process
{
  "userId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "choiceData": {
    "text": "Take the romantic path",
    "context": "romantic",
    "storyProgress": 0.8,
    "storyId": "64f1a2b3c4d5e6f7g8h9i0j2",
    "chapterId": "64f1a2b3c4d5e6f7g8h9i0j3",
    "sceneId": "64f1a2b3c4d5e6f7g8h9i0j5"
  }
}
```

## Frontend Integration Notes

### Time Tracking
The time tracking should be implemented on the frontend to:
1. Start tracking when user opens the app
2. End tracking when user closes the app or switches to background
3. Send periodic updates to maintain session accuracy

### Scene Access Logic
```javascript
// Frontend logic for scene access
const checkSceneAccess = async (userId, storyId, chapterId, sceneId) => {
  const response = await fetch(`/api/monetization/scene-access/${userId}/${storyId}/${chapterId}/${sceneId}`);
  const data = await response.json();
  
  if (data.data.isUnlocked) {
    // Show scene
    return true;
  } else if (data.data.isFreeScene && data.data.canAccessFree) {
    // Show free scene
    return true;
  } else {
    // Show unlock options
    showUnlockOptions(data.data);
    return false;
  }
};
```

### Daily Rewards UI
```javascript
// Check daily reward status on app launch
const checkDailyReward = async (userId) => {
  const response = await fetch(`/api/monetization/daily-rewards/status/${userId}`);
  const data = await response.json();
  
  if (data.data.canClaim) {
    showDailyRewardPopup(data.data);
  }
};
```

## Configuration

### Environment Variables
No additional environment variables are required for the monetization framework.

### Database Indexes
The following indexes are automatically created:
- `DailyRewards`: `{ userId: 1, lastClaimDate: -1 }`
- `TimeTracking`: `{ userId: 1, sessionStartTime: -1 }`
- `SceneUnlock`: `{ userId: 1, storyId: 1, chapterId: 1 }`
- `UserProgressV2`: `{ userId: 1, storyId: 1, chapterId: 1 }`

## Security Considerations

1. **Authentication**: All endpoints should be protected with authentication middleware
2. **Rate Limiting**: Consider implementing rate limiting for reward claims
3. **Validation**: All user inputs are validated on both frontend and backend
4. **Transaction Integrity**: Diamond transactions are atomic and logged

## Future Enhancements

1. **Weekly Rewards**: Spin the wheel for 10 diamonds (gacha system)
2. **AI Integration**: Connect to actual AI service for choice pricing
3. **Analytics**: Track user spending patterns and engagement
4. **A/B Testing**: Test different pricing strategies
5. **Subscription Model**: Monthly diamond subscriptions

## Testing

### Unit Tests
Create tests for:
- Daily reward calculation logic
- Time tracking calculations
- Scene unlock validation
- Paid choice cost calculation

### Integration Tests
Test complete user flows:
- Daily reward claiming
- Time tracking session
- Scene unlock process
- Paid choice purchase

## Monitoring

### Key Metrics
- Daily reward claim rates
- Time spent in app
- Scene unlock conversion rates
- Paid choice purchase rates
- Diamond transaction volumes

### Logging
All monetization events are logged with:
- User ID
- Action type
- Diamond amounts
- Timestamps
- Success/failure status 