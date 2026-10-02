// Centralized scenes configuration

// Free scenes per story (configured here; not from env)
const DEFAULT_FREE_SCENES = 4;
const DEFAULT_FREE_SCENES_NON_NEW_LAUNCH = 1;
const NEW_LAUNCH_MAX_SCENES = 10; // Maximum scenes that can be unlocked for new launch non-writer stories

const STORY_FREE_SCENES_OVERRIDES = {
  // Request: story_id 689ee853d994c9fa8f047804 should have only first 2 scenes free
  // '689ee853d994c9fa8f047804': 2,
};

async function getFreeScenesLimitForStory(storyId) {
  if (!storyId) return DEFAULT_FREE_SCENES;
  
  try {
    // Get the story to check isNewLaunch flag
    const Story = require('../models/StoryV2');
    const story = await Story.findById(storyId);
    
    // If story is not found or isNewLaunch is false, return 1 scene

    console.log("story", story);
    if (!story || !story.isNewLaunch) {
      return DEFAULT_FREE_SCENES_NON_NEW_LAUNCH;
    }

    // Check for story-specific overrides
    const key = String(storyId);
    if (Object.prototype.hasOwnProperty.call(STORY_FREE_SCENES_OVERRIDES, key)) {
      return STORY_FREE_SCENES_OVERRIDES[key];
    }

    // Return default 4 scenes for new launch stories
    return DEFAULT_FREE_SCENES;
  } catch (error) {
    console.error('Error getting free scenes limit:', error);
    return DEFAULT_FREE_SCENES_NON_NEW_LAUNCH; // Default to 1 scene on error
  }
}

// Check if a story has reached its maximum unlock limit
async function canUnlockMoreScenes(storyId, unlockedCount) {
  try {
    const Story = require('../models/StoryV2');
    const story = await Story.findById(storyId);
    
    // If story is not found, allow unlocking with no limit
    if (!story) return { canUnlock: true, remainingScenes: Infinity };
    
    // If story is not new launch or is a writer story, no limit
    if (!story.isNewLaunch || story.isWriterStory) return { canUnlock: true, remainingScenes: Infinity };
    
    // For new launch non-writer stories, check against max limit
    const remainingScenes = Math.max(0, NEW_LAUNCH_MAX_SCENES - unlockedCount);
    return {
      canUnlock: remainingScenes > 0,
      remainingScenes: remainingScenes
    };
  } catch (error) {
    console.error('Error checking scene unlock limit:', error);
    return { canUnlock: true, remainingScenes: Infinity }; // On error, allow unlocking to prevent blocking users
  }
}

// Next scenes unlock limit (configured here; not from env)
// Increased from 2 to 4 for both PAID and TIME_BASED unlocks
const NEXT_SCENES_UNLOCK_LIMIT = 4;

// Share and unlock scenes limit (configured here; not from env)
const SHARE_AND_UNLOCK_SCENES_LIMIT = 4;

module.exports = {
  // Free scenes config
  getFreeScenesLimitForStory,
  DEFAULT_FREE_SCENES,
  // Next scenes config
  NEXT_SCENES_UNLOCK_LIMIT,
  // Share and unlock config
  SHARE_AND_UNLOCK_SCENES_LIMIT,
  // Scene unlock limits
  NEW_LAUNCH_MAX_SCENES,
  canUnlockMoreScenes,
  // Referral rewards
  REFERRED_USER_REWARD: 10,
  REFERRER_REWARD: 10,
};


