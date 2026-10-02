# Real-Time Diamond Awards (Alternative Implementation)

If you want to award diamonds every hour in real-time (instead of at session end), here's how to implement it:

## Modified Approach

### 1. Hourly Diamond Award API
```javascript
// New endpoint: POST /time-tracking/award-hourly-diamond
const awardHourlyDiamond = async (req, res) => {
  try {
    const { userId, sessionId } = req.body;
    
    const timeTracking = await TimeTracking.findOne({
      _id: sessionId,
      userId,
      isActive: true
    });

    if (!timeTracking) {
      return res.status(404).json({
        success: false,
        message: "Active session not found"
      });
    }

    const currentTime = new Date();
    const sessionTime = currentTime.getTime() - timeTracking.sessionStartTime.getTime();
    const hoursCompleted = Math.floor(sessionTime / (1000 * 60 * 60));
    
    // Check if we should award a diamond
    if (hoursCompleted > timeTracking.diamondsAwarded) {
      const user = await User.findOne({ _id: userId, isDeleted: false });
      if (user) {
        user.diamonds += 1;
        await user.save();
        
        timeTracking.diamondsAwarded = hoursCompleted;
        await timeTracking.save();
        
        return res.status(200).json({
          success: true,
          data: {
            diamondAwarded: true,
            diamondsEarned: 1,
            userDiamonds: user.diamonds,
            hoursCompleted: hoursCompleted
          }
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      data: {
        diamondAwarded: false,
        hoursCompleted: hoursCompleted
      }
    });
  } catch (error) {
    logger.error(`Error awarding hourly diamond: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
```

### 2. Frontend Implementation
```javascript
// Call this every hour
const checkHourlyDiamond = async () => {
  const response = await fetch('/time-tracking/award-hourly-diamond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId: "user123", 
      sessionId: "session789" 
    })
  });
  
  const data = await response.json();
  if (data.data.diamondAwarded) {
    // Show notification: "You earned 1 diamond!"
    showNotification("🎉 You earned 1 diamond for using the app for 1 hour!");
  }
};

// Set up hourly check
setInterval(checkHourlyDiamond, 60 * 60 * 1000); // Every hour
```

## Recommendation

**I recommend sticking with the current system** (awarding diamonds at session end) because:

1. **Simpler**: No need for hourly API calls
2. **More reliable**: No risk of missing hourly checks
3. **Better UX**: Users see their total earnings when they finish
4. **Less server load**: Fewer API calls
5. **Works offline**: No dependency on hourly network calls

## Current System Benefits

- ✅ **Automatic calculation** based on total session time
- ✅ **No missed awards** due to network issues
- ✅ **Accurate tracking** even if app crashes
- ✅ **Better performance** with fewer API calls
- ✅ **Works offline** - awards when connection is restored

## When to Use Each Approach

### Use Current System (Session End Awards) When:
- You want simplicity and reliability
- Users typically use the app for longer sessions
- You want to minimize server load

### Use Real-Time Awards When:
- You want immediate gratification
- Users need frequent positive reinforcement
- You have reliable network connectivity
- You want to show progress in real-time 