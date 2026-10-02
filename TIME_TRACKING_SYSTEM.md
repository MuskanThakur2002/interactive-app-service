# Time Tracking System

## Overview
The time tracking system allows users to earn diamonds based on their app usage time. Users earn **1 diamond per hour** of continuous app usage within a single session.

## How It Works

### 1. Starting a Session
- **Endpoint**: `POST /time-tracking/start`
- **Body**: `{ userId, deviceId }`
- **Action**: Creates a new active session and ends any existing active sessions for the user

### 2. Ending a Session
- **Endpoint**: `POST /time-tracking/end`
- **Body**: `{ sessionId, userId }`
- **Action**: 
  - Calculates total session duration
  - Awards diamonds based on time spent (1 diamond per hour)
  - Updates user's diamond balance
  - Returns session statistics

### 3. Getting Session Statistics
- **Endpoint**: `GET /time-tracking/stats/:userId`
- **Action**: Returns total time spent today and diamonds earned today

### 4. Getting Current Session Progress
- **Endpoint**: `GET /time-tracking/progress/:userId`
- **Action**: Returns real-time progress of current active session

## Diamond Calculation

### Formula
```
Diamonds Earned = Math.floor(Total Session Time in Hours)
```

### Examples
- 30 minutes = 0 diamonds
- 1 hour = 1 diamond
- 1 hour 30 minutes = 1 diamond
- 2 hours = 2 diamonds
- 4 hours = 4 diamonds

## API Response Examples

### Start Time Tracking
```json
{
  "success": true,
  "data": {
    "sessionId": "507f1f77bcf86cd799439011",
    "startTime": "2024-01-15T10:00:00.000Z"
  }
}
```

### End Time Tracking
```json
{
  "success": true,
  "data": {
    "diamondsEarned": 4,
    "sessionTime": 14400000,
    "sessionTimeInHours": 4.0,
    "userDiamonds": 25
  }
}
```

### Get Current Session Progress
```json
{
  "success": true,
  "data": {
    "hasActiveSession": true,
    "sessionId": "507f1f77bcf86cd799439011",
    "sessionStartTime": "2024-01-15T10:00:00.000Z",
    "currentSessionTime": 7200000,
    "currentSessionTimeInHours": 2.0,
    "currentSessionDiamonds": 2,
    "diamondsPerHour": 1,
    "timeUntilNextDiamond": 3600000,
    "nextDiamondInMinutes": 60,
    "progressToNextDiamond": 0.0
  }
}
```

## Important Notes

1. **Session Continuity**: Diamonds are only awarded when the session ends, not in real-time
2. **One Active Session**: Users can only have one active session at a time
3. **Hourly Calculation**: Partial hours do not earn diamonds (e.g., 30 minutes = 0 diamonds)
4. **Session Persistence**: Sessions are stored in the database and can be tracked across app restarts
5. **Daily Tracking**: The system also tracks total time spent per day for analytics

## Frontend Integration

### Starting a Session
```javascript
// Call when user opens the app
const startSession = async () => {
  const response = await fetch('/time-tracking/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, deviceId })
  });
  const data = await response.json();
  return data.data.sessionId;
};
```

### Ending a Session
```javascript
// Call when user closes the app or switches to background
const endSession = async (sessionId) => {
  const response = await fetch('/time-tracking/end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, userId })
  });
  const data = await response.json();
  return data.data.diamondsEarned;
};
```

### Real-time Progress Updates
```javascript
// Call periodically to show progress
const getProgress = async () => {
  const response = await fetch(`/time-tracking/progress/${userId}`);
  const data = await response.json();
  return data.data;
};
``` 