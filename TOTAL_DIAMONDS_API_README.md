# Total Diamonds Earned Today API

## Overview
This API calculates the total diamonds a user has earned today across all reward systems in the interactive app service.

## Endpoint
```
GET /api/monetization/total-diamonds-earned-today/:userId
```

## Parameters
- `userId` (string, required): The user's unique identifier

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "data": {
    "totalDiamondsEarnedToday": 15,
    "breakdown": {
      "dailyRewards": {
        "earned": 2,
        "description": "Daily login rewards"
      },
      "timeTracking": {
        "earned": 8,
        "description": "Time spent in app (1 diamond per hour)"
      },
      "weeklyStreak": {
        "earned": 5,
        "description": "Weekly streak completion rewards"
      },
      "storyCompletion": {
        "earned": 0,
        "description": "Story completion milestone rewards"
      }
    },
    "date": "2024-01-15"
  }
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "User ID is required"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "User not found"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Error details"
}
```

## Reward Systems Tracked

### 1. Daily Rewards
- **Reward**: 2 diamonds per day
- **Tracking**: Checks if user claimed daily reward today
- **Logic**: Looks at `lastClaimDate` in DailyRewards model

### 2. Time Tracking
- **Reward**: 1 diamond per hour spent in app
- **Tracking**: Calculates total time spent today
- **Logic**: Uses `TimeTracking.getTotalTimeToday()` method

### 3. Weekly Streak
- **Reward**: 5 diamonds for completing weekly streak
- **Tracking**: Checks if weekly streak was completed and claimed today
- **Logic**: Looks at `weeklyRewardClaimedAt` in WeeklyStreak model

### 4. Story Completion
- **Reward**: 30 diamonds for every 5 stories completed
- **Tracking**: Checks if story completion milestone was reached today
- **Logic**: Analyzes completed stories and milestone thresholds

## Usage Examples

### cURL
```bash
curl -X GET "http://localhost:3010/api/monetization/total-diamonds-earned-today/507f1f77bcf86cd799439011"
```

### JavaScript (Axios)
```javascript
const axios = require('axios');

const response = await axios.get(
  'http://localhost:3010/api/monetization/total-diamonds-earned-today/507f1f77bcf86cd799439011'
);

console.log('Total diamonds earned today:', response.data.data.totalDiamondsEarnedToday);
```

### JavaScript (Fetch)
```javascript
const response = await fetch(
  'http://localhost:3010/api/monetization/total-diamonds-earned-today/507f1f77bcf86cd799439011'
);

const data = await response.json();
console.log('Total diamonds earned today:', data.data.totalDiamondsEarnedToday);
```

## Testing
Run the test script to verify the API:
```bash
node test_total_diamonds_api.js
```

Make sure to:
1. Update the `TEST_USER_ID` in the test script with a valid user ID
2. Ensure the server is running on the correct port
3. Have some test data in the database for the user

## Implementation Details

### Files Modified
- `src/controllers/monetizationController.js` - Added `getTotalDiamondsEarnedToday` function
- `src/routes/monetizationRoutes.js` - Added route for the new endpoint

### Dependencies
The API uses the following models:
- `DailyRewards` - For daily login rewards
- `TimeTracking` - For time-based rewards
- `WeeklyStreak` - For weekly streak rewards
- `StoryCompletionReward` - For story completion rewards
- `User` - For user validation

### Date Handling
- All date comparisons are done at midnight UTC to ensure consistent day boundaries
- Uses `setHours(0, 0, 0, 0)` to normalize dates for comparison

### Logging
The API includes comprehensive logging for debugging:
- Total diamonds earned with breakdown
- Individual reward system calculations
- Error logging for troubleshooting 