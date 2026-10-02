# Weekly Rewards System

This system provides two types of weekly rewards:

## 1. Weekly Login Streak Reward
- **Requirement**: User must log in for 7 consecutive days in a week
- **Reward**: 5 diamonds
- **Reset**: Every week (Monday to Sunday)

## 2. Weekly Story Completion Reward
- **Requirement**: User must complete 5 stories in the same week
- **Reward**: 30 diamonds
- **Reset**: Every week (Monday to Sunday)

## API Endpoints

### Weekly Login Streak

#### Mark Day as Logged In
```
POST /weekly-login/:userId
```
- Marks the current day as logged in for the user
- Creates a new weekly streak record if one doesn't exist for the current week
- Returns the updated weekly streak data

#### Claim Weekly Login Reward
```
POST /claim-weekly/:userId/:weeklyStreakId
```
- Claims the weekly login streak reward (5 diamonds)
- Only works if user has logged in for 7 days and hasn't claimed the reward yet

#### Get Current Week Progress
```
GET /current-week-progress/:userId/:weeklyStreakId
```
- Returns the current week's login streak progress
- Shows days logged in, progress percentage, and reward status

### Weekly Story Completion

#### Check Story Completion Status
```
POST /story-completion/check-completion/:userId/:storyId
```
- Checks if a story is completed and adds it to the weekly streak
- Body: `{ "storyTitle": "Story Title" }` (optional)
- Returns both login streak and story completion progress

#### Claim Weekly Story Reward
```
POST /story-completion/claim-reward/:userId/:weeklyStreakId
```
- Claims the weekly story completion reward (30 diamonds)
- Only works if user has completed 5 stories in the week and hasn't claimed the reward yet

#### Check Reward Status
```
GET /story-completion/reward-status/:userId
```
- Returns current reward status for both weekly login and story completion rewards
- Use this to get the `weeklyStreakId` needed for claiming rewards

#### Get Story Completion Statistics
```
GET /story-completion/statistics/:userId
```
- Returns current week's progress for both login streak and story completion
- Shows overall story completion status

#### Get Story Completion History
```
GET /story-completion/history/:userId
```
- Returns completed stories from the current week
- Supports pagination with `limit` and `page` query parameters

## Data Structure

### WeeklyStreak Model
```javascript
{
  userId: ObjectId,
  weekStartDate: Date, // Monday
  weekEndDate: Date,   // Sunday
  daysLoggedIn: Number,
  totalDaysInWeek: Number, // 7
  weeklyStreakCompleted: Boolean,
  weeklyRewardClaimed: Boolean,
  weeklyRewardAmount: Number, // 5 diamonds
  weeklyRewardClaimedAt: Date,
  lastLoginDate: Date,
  loginDates: [Date],
  missedDates: [Date],
  // Weekly Story Completion fields
  storiesCompletedThisWeek: Number,
  weeklyStoryRewardClaimed: Boolean,
  weeklyStoryRewardAmount: Number, // 30 diamonds
  weeklyStoryRewardClaimedAt: Date,
  completedStoriesThisWeek: [{
    storyId: ObjectId,
    completedAt: Date,
    storyTitle: String
  }]
}
```

## Key Features

1. **Weekly Reset**: Both reward systems reset every Monday
2. **Separate Tracking**: Login streak and story completion are tracked independently
3. **Duplicate Prevention**: Stories completed multiple times in the same week are not counted
4. **Progress Tracking**: Both systems show progress percentages
5. **Reward Validation**: Users can only claim rewards once per week per system
6. **Automatic Diamond Addition**: Rewards are automatically added to user's diamond balance

## Usage Flow

1. User logs in daily → `markDayLoggedIn` endpoint
2. User completes stories → `checkStoryCompletion` endpoint (automatically adds to weekly streak)
3. User can check progress → `getCurrentWeekProgress` or `getStoryCompletionStatistics`
4. User claims rewards when eligible → `claimWeeklyReward` or `claimStoryCompletionReward`

## Notes

- Week starts on Monday and ends on Sunday
- All dates are normalized to midnight UTC for consistency
- Users can earn both rewards in the same week if they meet both requirements
- The system automatically creates new weekly streak records for new weeks 