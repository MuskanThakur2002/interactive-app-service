# Story Completion Reward System

## Overview

The Story Completion Reward System tracks when users complete stories and provides rewards every 5 story completions. This system integrates with the existing UserProgress system to determine when a story is fully completed.

## Key Features

1. **Story Completion Tracking**: Automatically detects when users complete all chapters in a story
2. **Progressive Rewards**: Gives rewards every 5 story completions (5, 10, 15, 20, etc.)
3. **Duplicate Prevention**: Prevents counting the same story multiple times
4. **Progress Tracking**: Shows progress towards the next reward threshold
5. **History Tracking**: Maintains a complete history of completed stories

## Database Schema

### StoryCompletionReward Model

```javascript
{
  userId: ObjectId,           // Reference to User
  totalStoriesCompleted: Number,  // Total stories completed
  lastRewardClaimedAt: Number,    // Number of stories when last reward was claimed
  totalRewardsClaimed: Number,    // Total rewards claimed so far
  lastRewardAmount: Number,       // Amount of last reward claimed
  completedStories: [{
    storyId: ObjectId,        // Reference to Story_v2
    completedAt: Date,        // When story was completed
    storyTitle: String        // Title of the story
  }],
  nextRewardThreshold: Number    // Next threshold for reward (5, 10, 15, etc.)
}
```

## API Endpoints

### 1. Check Story Completion
**POST** `/api/story-completion-rewards/check-completion/:userId/:storyId`

Checks if a story is completed and updates the completion status.

**Response:**
```json
{
  "success": true,
  "data": {
    "storyCompleted": true,
    "isStoryCompleted": true,
    "totalChapters": 5,
    "completedChapters": 5,
    "canClaimReward": true,
    "rewardEarned": true,
    "statistics": {
      "totalStoriesCompleted": 5,
      "totalRewardsClaimed": 0,
      "nextRewardThreshold": 5,
      "canClaimReward": true,
      "progress": {
        "completed": 5,
        "remaining": 0,
        "total": 5,
        "percentage": 100
      },
      "lastRewardAmount": 0
    }
  }
}
```

### 2. Claim Story Completion Reward
**POST** `/api/story-completion-rewards/claim-reward/:userId`

Claims the reward for completing 5 stories.

**Response:**
```json
{
  "success": true,
  "data": {
    "rewardAmount": 25,
    "userDiamonds": 175,
    "statistics": {
      "totalStoriesCompleted": 5,
      "totalRewardsClaimed": 1,
      "nextRewardThreshold": 10,
      "canClaimReward": false,
      "progress": {
        "completed": 0,
        "remaining": 5,
        "total": 5,
        "percentage": 0
      },
      "lastRewardAmount": 25
    },
    "completedStories": [
      {
        "storyId": "507f1f77bcf86cd799439011",
        "completedAt": "2024-01-15T10:30:00.000Z",
        "storyTitle": "Love in Paris"
      }
      // ... more stories
    ]
  }
}
```

### 3. Get Story Completion Statistics
**GET** `/api/story-completion-rewards/statistics/:userId`

Gets comprehensive statistics about story completion progress.

**Response:**
```json
{
  "success": true,
  "data": {
    "statistics": {
      "totalStoriesCompleted": 3,
      "totalRewardsClaimed": 0,
      "nextRewardThreshold": 5,
      "canClaimReward": false,
      "progress": {
        "completed": 3,
        "remaining": 2,
        "total": 5,
        "percentage": 60
      },
      "lastRewardAmount": 0
    },
    "completedStories": [
      // ... completed stories
    ],
    "storyCompletionStatus": [
      {
        "storyId": "507f1f77bcf86cd799439011",
        "storyTitle": "Love in Paris",
        "totalChapters": 5,
        "completedChapters": 5,
        "isCompleted": true,
        "progressPercentage": 100
      },
      {
        "storyId": "507f1f77bcf86cd799439012",
        "storyTitle": "Mystery Manor",
        "totalChapters": 3,
        "completedChapters": 1,
        "isCompleted": false,
        "progressPercentage": 33.33
      }
    ],
    "totalStoriesInProgress": 2
  }
}
```

### 4. Get Story Completion History
**GET** `/api/story-completion-rewards/history/:userId`

Gets the history of completed stories with pagination.

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
        "storyId": "507f1f77bcf86cd799439011",
        "completedAt": "2024-01-15T10:30:00.000Z",
        "storyTitle": "Love in Paris"
      }
      // ... more stories
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalRecords": 15,
      "limit": 10
    }
  }
}
```

## Reward Structure

### Story Completion Rewards
- **Reward Amount**: 25 diamonds
- **Threshold**: Every 5 story completions
- **Progressive**: 5, 10, 15, 20, 25, 30, etc.
- **Claimable**: Once per threshold

## Story Completion Logic

### How Story Completion is Determined:
1. **Chapter Check**: All chapters in the story must be marked as completed
2. **Progress Validation**: Each chapter must have `isCompleted: true` in UserProgress
3. **Duplicate Prevention**: Same story cannot be counted multiple times
4. **Real-time Updates**: Completion is checked when the endpoint is called

### Integration with UserProgress:
- Uses existing `UserProgress` model to check chapter completion
- Leverages `isCompleted` field to determine chapter status
- Integrates with existing story and chapter data

## Usage Flow

1. **Story Progress**: User progresses through chapters (handled by existing system)
2. **Completion Check**: Call `/api/story-completion-rewards/check-completion/:userId/:storyId`
3. **Reward Notification**: System indicates if reward is available
4. **Reward Claim**: User claims reward via `/api/story-completion-rewards/claim-reward/:userId`
5. **Progress Tracking**: Use statistics endpoint to show progress

## Integration Points

### With UserProgress System:
- Reads from `UserProgress` collection to determine completion
- Checks `isCompleted` field for each chapter
- Integrates with existing story and chapter structure

### With User System:
- Updates user's diamond balance when rewards are claimed
- Maintains user-specific completion records

### With Story System:
- References `Story_v2` collection for story details
- Uses story titles in completion history

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
- Story not found
- No chapters found for story
- No story completion record found
- No reward available to claim

## Database Indexes

The StoryCompletionReward model includes the following indexes for optimal performance:

1. `{ userId: 1, totalStoriesCompleted: -1 }` - For finding user's completion records
2. `{ userId: 1, totalRewardsClaimed: -1 }` - For finding reward statistics

## Key Benefits

1. **Clear Progression**: Users know they need to complete 5 stories for each reward
2. **Substantial Rewards**: 25 diamonds is meaningful for story completion
3. **Duplicate Prevention**: System prevents gaming by completing same story multiple times
4. **Progress Visibility**: Users can see their progress towards next reward
5. **Historical Tracking**: Complete history of completed stories
6. **Seamless Integration**: Works with existing UserProgress system

## Example Usage Scenarios

### Scenario 1: First Story Completion
1. User completes their first story
2. Call `check-completion` endpoint
3. System records completion (1/5)
4. No reward available yet

### Scenario 2: Fifth Story Completion
1. User completes their fifth story
2. Call `check-completion` endpoint
3. System records completion (5/5)
4. Reward becomes available
5. User claims 25 diamonds

### Scenario 3: Tenth Story Completion
1. User completes their tenth story
2. Call `check-completion` endpoint
3. System records completion (10/10)
4. Second reward becomes available
5. User claims another 25 diamonds 