# Time Tracking Claim System

## Overview
The time tracking system now supports **claiming diamonds during active sessions**. Users can claim diamonds periodically while using the app, rather than waiting until the session ends.

## How It Works

### 1. **Session Progress Tracking**
- **Endpoint**: `GET /time-tracking/progress/:userId`
- **Purpose**: Check current session progress and claimable diamonds
- **Call Frequency**: Every 5-10 minutes to show progress

### 2. **Claim Diamonds During Session**
- **Endpoint**: `POST /time-tracking/claim-diamonds`
- **Purpose**: Claim earned diamonds immediately
- **Call Frequency**: When user wants to claim diamonds

### 3. **End Session**
- **Endpoint**: `POST /time-tracking/end`
- **Purpose**: End session and award any remaining unclaimed diamonds
- **Call Frequency**: When user closes app

## API Usage Examples

### Check Progress and Claimable Diamonds
```javascript
// Check current session progress
const getProgress = async (userId) => {
  const response = await fetch(`/time-tracking/progress/${userId}`);
  const data = await response.json();
  
  console.log(data.data);
  // Returns:
  // {
  //   hasActiveSession: true,
  //   sessionId: "session123",
  //   currentSessionTimeInHours: 2.5,
  //   currentSessionDiamonds: 2,
  //   claimableDiamonds: 2,        // Diamonds available to claim
  //   canClaimDiamonds: true,      // Whether user can claim
  //   totalDiamondsEarned: 2,      // Total earned in session
  //   diamondsClaimed: 0,          // Already claimed in session
  //   lastClaimTime: null
  // }
};
```

### Claim Diamonds During Session
```javascript
// Claim diamonds from active session
const claimDiamonds = async (sessionId, userId) => {
  const response = await fetch('/time-tracking/claim-diamonds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, userId })
  });
  
  const data = await response.json();
  console.log(data.data);
  // Returns:
  // {
  //   diamondsClaimed: 2,          // Diamonds just claimed
  //   userDiamonds: 25,            // Updated user balance
  //   totalDiamondsEarned: 2,      // Total earned in session
  //   diamondsClaimedInSession: 2, // Total claimed in session
  //   lastClaimTime: "2024-01-15T12:00:00.000Z",
  //   message: "Diamonds claimed successfully"
  // }
};
```

## Diamond Calculation Logic

### During Session
- **Formula**: `Math.floor(Total Session Time in Hours)`
- **Claimable**: `Total Earned - Already Claimed`
- **Example**: 2.5 hours = 2 diamonds earned, 2 diamonds claimable

### At Session End
- **Final Award**: `Total Earned - Already Claimed`
- **Example**: 4 hours total, 2 already claimed = 2 final diamonds

## Database Schema Updates

### TimeTracking Model
```javascript
{
  userId: ObjectId,
  deviceId: String,
  sessionStartTime: Date,
  sessionEndTime: Date,
  totalSessionTime: Number,
  diamondsEarned: Number,      // Total diamonds earned in session
  diamondsClaimed: Number,     // Diamonds claimed during session
  lastClaimTime: Date,         // When diamonds were last claimed
  isActive: Boolean
}
```

## Frontend Integration Flow

### 1. App Opens
```javascript
// Start session
const session = await startTimeTracking(userId, deviceId);
const sessionId = session.data.sessionId;
```

### 2. Periodic Progress Check
```javascript
// Check progress every 10 minutes
setInterval(async () => {
  const progress = await getProgress(userId);
  
  if (progress.data.canClaimDiamonds) {
    // Show claim button: "Claim 2 Diamonds!"
    showClaimButton(progress.data.claimableDiamonds);
  } else {
    // Show progress: "1 hour until next diamond"
    showProgress(progress.data.nextDiamondInMinutes);
  }
}, 10 * 60 * 1000);
```

### 3. User Claims Diamonds
```javascript
// When user clicks claim button
const claimResult = await claimDiamonds(sessionId, userId);
showNotification(`🎉 You claimed ${claimResult.data.diamondsClaimed} diamonds!`);
updateUserBalance(claimResult.data.userDiamonds);
```

### 4. App Closes
```javascript
// End session and get final diamonds
const endResult = await endTimeTracking(sessionId, userId);
if (endResult.data.diamondsEarned > 0) {
  showNotification(`Session ended! You earned ${endResult.data.diamondsEarned} more diamonds.`);
}
```

## Benefits of Claim System

### ✅ **Immediate Gratification**
- Users get diamonds as they earn them
- No waiting until session ends

### ✅ **Better User Engagement**
- Frequent positive reinforcement
- Users can see their progress in real-time

### ✅ **Flexible Claiming**
- Users can claim when they want
- No forced waiting periods

### ✅ **Accurate Tracking**
- All claims are recorded in database
- No double-awarding of diamonds

## Error Handling

### No Active Session
```json
{
  "success": false,
  "message": "Active session not found"
}
```

### No Diamonds to Claim
```json
{
  "success": false,
  "message": "No diamonds available to claim yet"
}
```

### Invalid Session
```json
{
  "success": false,
  "message": "Session ID and User ID are required"
}
```

## Best Practices

1. **Check Progress Regularly**: Call progress API every 5-10 minutes
2. **Show Claim Button**: Display claim button when `canClaimDiamonds` is true
3. **Update UI Immediately**: Refresh user balance after successful claim
4. **Handle Errors Gracefully**: Show appropriate messages for different error states
5. **End Session Properly**: Always call end session when app closes 