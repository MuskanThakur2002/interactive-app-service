# Database Updates in Time Tracking System

## Overview
The time tracking system now **properly updates the database** with session progress and diamond calculations in real-time.

## Database Updates Explained

### 1. **Session Progress Updates**
When calling `GET /time-tracking/progress/:userId`:

```javascript
// What happens in the database:
const currentTime = new Date();
const currentSessionTime = currentTime.getTime() - activeSession.sessionStartTime.getTime();
const currentSessionDiamonds = TimeTracking.calculateDiamondsFromTime(currentSessionTime);

// ✅ DATABASE UPDATE: Session data is saved
activeSession.totalSessionTime = currentSessionTime;  // Updated in DB
activeSession.diamondsEarned = currentSessionDiamonds; // Updated in DB
await activeSession.save(); // ✅ SAVED TO DATABASE
```

### 2. **Session Stats Updates**
When calling `GET /time-tracking/stats/:userId`:

```javascript
// ✅ DATABASE UPDATE: Active session data is updated
activeSession.totalSessionTime = currentSessionTime;  // Updated in DB
activeSession.diamondsEarned = currentSessionDiamonds; // Updated in DB
await activeSession.save(); // ✅ SAVED TO DATABASE
```

### 3. **Diamond Claims**
When calling `POST /time-tracking/claim-diamonds`:

```javascript
// ✅ DATABASE UPDATE: Claim data is saved
timeTracking.diamondsClaimed = totalDiamondsEarned; // Updated in DB
timeTracking.lastClaimTime = currentTime;           // Updated in DB
timeTracking.totalSessionTime = currentSessionTime; // Updated in DB
await timeTracking.save(); // ✅ SAVED TO DATABASE

// ✅ DATABASE UPDATE: User diamonds are updated
user.diamonds += claimResult.diamondsToClaim; // Updated in DB
await user.save(); // ✅ SAVED TO DATABASE
```

## Database Schema Fields Updated

### TimeTracking Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  deviceId: String,
  sessionStartTime: Date,
  sessionEndTime: Date,
  totalSessionTime: Number,     // ✅ UPDATED: Current session duration
  diamondsEarned: Number,       // ✅ UPDATED: Total diamonds earned
  diamondsClaimed: Number,      // ✅ UPDATED: Diamonds claimed so far
  lastClaimTime: Date,          // ✅ UPDATED: When last claimed
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### User Collection
```javascript
{
  _id: ObjectId,
  diamonds: Number,             // ✅ UPDATED: User's diamond balance
  // ... other user fields
}
```

## API Calls That Update Database

### ✅ **Database Updates Happen In:**

1. **`GET /time-tracking/progress/:userId`**
   - Updates `totalSessionTime` and `diamondsEarned`
   - Logs: "Session progress updated for user X: Y hours, Z diamonds earned"

2. **`GET /time-tracking/stats/:userId`**
   - Updates `totalSessionTime` and `diamondsEarned` for active session
   - Logs: "Session stats updated for user X: Y hours, Z diamonds earned"

3. **`POST /time-tracking/claim-diamonds`**
   - Updates `diamondsClaimed`, `lastClaimTime`, `totalSessionTime`
   - Updates user's `diamonds` balance
   - Logs: "Session diamonds claimed for user X: Y diamonds"

4. **`POST /time-tracking/end`**
   - Updates `sessionEndTime`, `totalSessionTime`, `diamondsEarned`
   - Updates user's `diamonds` balance with final unclaimed diamonds
   - Logs: "Time tracking ended for user X: total earned: Y diamonds, final award: Z diamonds"

## Verification

### Check Database Updates:
```javascript
// 1. Start a session
const session = await startTimeTracking(userId, deviceId);

// 2. Check progress (updates database)
const progress = await getCurrentSessionProgress(userId);

// 3. Verify in database
const sessionInDB = await TimeTracking.findById(session.data.sessionId);
console.log(sessionInDB.totalSessionTime); // Should be updated
console.log(sessionInDB.diamondsEarned);   // Should be updated

// 4. Claim diamonds (updates database)
const claim = await claimSessionDiamonds(session.data.sessionId, userId);

// 5. Verify user balance updated
const user = await User.findById(userId);
console.log(user.diamonds); // Should be increased
```

## Logging

The system now logs all database updates:

```
Session progress updated for user 123: 2.5 hours, 2 diamonds earned
Session stats updated for user 123: 2.5 hours, 2 diamonds earned
Session diamonds claimed for user 123: 2 diamonds
Time tracking ended for user 123: total earned: 4 diamonds, final award: 2 diamonds
```

## Benefits

### ✅ **Accurate Tracking**
- All session data is saved to database in real-time
- No data loss if app crashes
- Consistent state across API calls

### ✅ **Audit Trail**
- Complete history of session progress
- Track when diamonds were claimed
- Monitor user engagement patterns

### ✅ **Reliable Calculations**
- Database always has current session state
- Accurate diamond calculations
- No double-awarding or missing diamonds 