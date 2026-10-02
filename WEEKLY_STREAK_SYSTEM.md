# Weekly Streak System

## Overview

The Weekly Streak System tracks user login activity on a weekly basis (Monday to Sunday) and provides a special reward only when users complete all 7 days in a week.

## Key Features

1. **Weekly Tracking**: Tracks user login for each day of the week (Monday through Sunday)
2. **Weekly Completion Bonus**: Special reward for completing all 7 days in a week
3. **Multiple Week Records**: Users can have multiple weekly records for different weeks
4. **Missed Day Tracking**: Identifies which days the user didn't log in
5. **No Daily Rewards**: Users only get rewards when they complete the entire week

## Database Schema

### WeeklyStreak Model

```javascript
{
  userId: ObjectId,           // Reference to User
  weekStartDate: Date,        // Monday of the week
  weekEndDate: Date,          // Sunday of the week
  
  // Individual day tracking
  monday: {
    loggedIn: Boolean,         // Whether user logged in on Monday
    loginTime: Date            // When user logged in
  },
  tuesday: { /* same structure */ },
  wednesday: { /* same structure */ },
  thursday: { /* same structure */ },
  friday: { /* same structure */ },
  saturday: { /* same structure */ },
  sunday: { /* same structure */ },
  
  // Weekly summary
  daysLoggedIn: Number,       // Total days logged in this week
  totalDaysInWeek: Number,    // Always 7
  weeklyStreakCompleted: Boolean,  // Whether all 7 days completed
  weeklyRewardClaimed: Boolean,    // Whether weekly reward claimed
  weeklyRewardAmount: Number,      // Amount of weekly reward
  weeklyRewardClaimedAt: Date     // When weekly reward was claimed
}
```

## API Endpoints

### 1. Mark Weekly Login
**POST** `/api/weekly-streak/login/:userId`

Marks that a user has logged in for a specific day in the current week.

**Request Body:**
```json
{
  "date": "2024-01-15"  // Optional, defaults to current date
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "weekStartDate": "2024-01-15T00:00:00.000Z",
    "weekEndDate": "2024-01-21T23:59:59.999Z",
    "daysLoggedIn": 3,
    "totalDaysInWeek": 7,
    "progressPercentage": 43,
    "weeklyStreakCompleted": false,
    "canClaimWeeklyReward": false,
    "weekData": {
      "monday": {
        "loggedIn": true,
        "loginTime": "2024-01-15T10:30:00.000Z"
      },
      // ... other days
    },
    "missedDays": ["wednesday", "friday", "saturday", "sunday"]
  }
}
```

### 2. Claim Weekly Reward
**POST** `/api/weekly-streak/claim-weekly/:userId`

Claims the special weekly completion reward when all 7 days are completed.

**Request Body:**
```json
{
  "weekStartDate": "2024-01-15T00:00:00.000Z"  // Optional, defaults to current week
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rewardAmount": 50,
    "userDiamonds": 200,
    "weekStartDate": "2024-01-15T00:00:00.000Z",
    "weekEndDate": "2024-01-21T23:59:59.999Z",
    "daysLoggedIn": 7,
    "weeklyRewardClaimedAt": "2024-01-21T15:30:00.000Z",
    "weekData": {
      // ... complete week data
    }
  }
}
```

### 3. Get Weekly Streak Status
**GET** `/api/weekly-streak/status/:userId`

Gets the current status of the weekly streak for a user.

**Query Parameters:**
- `weekStartDate`: Optional, defaults to current week

**Response:**
```json
{
  "success": true,
  "data": {
    "weekStartDate": "2024-01-15T00:00:00.000Z",
    "weekEndDate": "2024-01-21T23:59:59.999Z",
    "daysLoggedIn": 5,
    "totalDaysInWeek": 7,
    "progressPercentage": 71,
    "weeklyStreakCompleted": false,
    "canClaimWeeklyReward": false,
    "weeklyRewardClaimed": false,
    "weeklyRewardAmount": 0,
    "weeklyRewardClaimedAt": null,
    "weekData": {
      // ... complete week data
    },
    "missedDays": ["saturday", "sunday"]
  }
}
```

### 4. Get Weekly Streak History
**GET** `/api/weekly-streak/history/:userId`

Gets the history of weekly streaks for a user.

**Query Parameters:**
- `limit`: Number of records to return (default: 10)
- `page`: Page number (default: 1)

**Response:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "weekStartDate": "2024-01-08T00:00:00.000Z",
        "weekEndDate": "2024-01-14T23:59:59.999Z",
        "daysLoggedIn": 7,
        "totalDaysInWeek": 7,
        "progressPercentage": 100,
        "weeklyStreakCompleted": true,
        "weeklyRewardClaimed": true,
        "weeklyRewardAmount": 50,
        "weeklyRewardClaimedAt": "2024-01-14T20:00:00.000Z",
        "weekData": {
          // ... complete week data
        },
        "missedDays": []
      }
      // ... more weeks
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalRecords": 25,
      "limit": 10
    }
  }
}
```

## Reward Structure

### Weekly Completion Reward
- **Weekly Bonus**: 50 diamonds
- **Requirement**: Complete all 7 days in a week
- **Claimable**: Once per week when all days are completed
- **No Daily Rewards**: Users don't get rewards for individual days

## Week Calculation

- **Week Start**: Monday (day 1 of the week)
- **Week End**: Sunday (day 7 of the week)
- **Week Boundaries**: Monday 00:00:00 to Sunday 23:59:59

## Usage Flow

1. **User Login**: When user logs in, call `/api/weekly-streak/login/:userId`
2. **Track Progress**: Use `/api/weekly-streak/status/:userId` to show progress
3. **Weekly Completion**: When all 7 days are completed, user can claim weekly reward via `/api/weekly-streak/claim-weekly/:userId`
4. **History**: Use `/api/weekly-streak/history/:userId` to show past weeks

## Integration with Daily Rewards

The Weekly Streak system is completely separate from the Daily Rewards system:

- **Daily Rewards**: Tracks total days claimed with simple 2 diamond rewards
- **Weekly Streak**: Tracks weekly completion with 50 diamond bonus for completing all 7 days

Users can participate in both systems simultaneously:
- Daily Rewards: Overall login tracking (2 diamonds/day)
- Weekly Streak: Weekly completion tracking (50 diamonds for full week)

## Error Handling

All endpoints return appropriate error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common error scenarios:
- User not found
- No weekly streak record found
- Weekly reward already claimed
- Weekly streak not completed

## Database Indexes

The WeeklyStreak model includes the following indexes for optimal performance:

1. `{ userId: 1, weekStartDate: -1 }` - For finding user's weekly records
2. `{ userId: 1, weeklyStreakCompleted: 1 }` - For finding completed weeks
3. `{ userId: 1, daysLoggedIn: -1 }` - For finding high-performing weeks

## Key Benefits

1. **Clear Goal**: Users have a clear weekly target (7 days)
2. **Higher Engagement**: Encourages daily login to complete the week
3. **Substantial Reward**: 50 diamonds is a meaningful reward for weekly completion
4. **Simple Logic**: No complex daily reward calculations
5. **Progress Tracking**: Users can see their progress throughout the week 