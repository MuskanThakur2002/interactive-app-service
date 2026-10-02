const UserProgress = require("../models/UserProgressV2");
const Story = require("../models/StoryV2");
const Chapter = require("../models/ChapterV2");
const Scene = require("../models/SceneV2");
const User = require("../models/User");
const { mongoose } = require("../utils/DatabaseUtils");
const logger = require("../utils/logger");

/**
 * Get the most recent story that the user has started but not completed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLastUnfinishedStory = async (req, res) => {
  try {
    const { userId } = req.params;
    logger.info(`Fetching last unfinished story for User ID: ${userId}`);

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid user ID provided"
      });
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, isDeleted: false });
    logger.debug(`User found: ${user}`);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "USER_NOT_FOUND",
        message: "User not found"
      });
    }

    // Find the most recent unfinished story - SIMPLIFIED
    const lastUnfinishedStory = await UserProgress.aggregate([
      // Match user and started stories
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          isStarted: true
        }
      },
      // Sort by updatedAt descending (most recently updated first)
      {
        $sort: { updatedAt: -1 }
      },
      // Limit to 1 result
      {
        $limit: 1
      },
      // Lookup story details
      {
        $lookup: {
          from: "story_v2",
          localField: "storyId",
          foreignField: "_id",
          as: "story"
        }
      },
      // Unwind story array
      {
        $unwind: "$story"
      },
      // Filter for active stories (user has access if they have progress)
      {
        $match: {
          "story.isDeleted": false
        }
      },
      // Lookup current chapter details
      {
        $lookup: {
          from: "chapter_v2",
          localField: "chapterId",
          foreignField: "_id",
          as: "chapter"
        }
      },
      // Lookup current scene details
      {
        $lookup: {
          from: "scene_v2",
          localField: "lastViewedSceneId",
          foreignField: "_id",
          as: "scene"
        }
      },
      // Get total chapters for this story
      {
        $lookup: {
          from: "chapter_v2",
          let: { storyId: "$storyId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$storyId", "$$storyId"] },
                    { $eq: ["$isDeleted", false] }
                  ]
                }
              }
            }
          ],
          as: "allChapters"
        }
      },
      // Project the required fields (matching getDefaultStory structure exactly)
      {
        $project: {
          _id: "$story._id",
          title: "$story.title",
          description: "$story.description",
          thumbnail: "$story.thumbnails.portrait",
          thumbnails: "$story.thumbnails",
          videoLink: "$story.videoLink",
          isDefault: "$story.isDefault",
          totalChapters: { $size: "$allChapters" },
          isCompleted: {
            $cond: {
              if: { $eq: ["$chapterProgress", 100] },
              then: true,
              else: false
            }
          },
          userProgress: {
            hasStarted: "$isStarted",
            progress: "$chapterProgress",
            lastReadAt: "$updatedAt"
          }
        }
      }
    ]);

    if (!lastUnfinishedStory || lastUnfinishedStory.length === 0) {
      logger.info(`No unfinished stories found for user: ${userId}`);
      return res.status(200).json({
        success: false,
        message: "No unfinished stories found",
        story: null
      });
    }

    const story = lastUnfinishedStory[0];
    logger.info(`Last unfinished story found for user: ${userId} ${story}`);
    return res.status(200).json({
      success: true,
      message: "Last unfinished story retrieved successfully",
      story: story
    });

  } catch (error) {
    logger.error("Error fetching last unfinished story:", error);
    return res.status(500).json({
      success: false,
      error: "DATABASE_ERROR",
      message: "Internal server error",
      details: {
        error: error.message
      }
    });
  }
};

/**
 * Get the default story for new users or return null if default story is completed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getDefaultStory = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Invalid user ID provided"
      });
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "USER_NOT_FOUND",
        message: "User not found"
      });
    }

    // Find the default story using aggregation
    const defaultStory = await Story.aggregate([
      // Match default, active, published story
      {
        $match: {
          isDefault: true,
          isDeleted: false,
          status: "PUBLISHED"
        }
      },
      // Lookup user progress for this story
      {
        $lookup: {
          from: "userprogresses",
          let: { storyId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$storyId", "$$storyId"] },
                    { $eq: ["$userId", new mongoose.Types.ObjectId(userId)] }
                  ]
                }
              }
            }
          ],
          as: "userProgress"
        }
      },
      // Check if user has completed the default story (100% progress in all chapters)
      {
        $addFields: {
          isCompleted: {
            $and: [
              { $gt: [{ $size: "$userProgress" }, 0] }, // Has progress records
              { 
                $allElementsTrue: {
                  $map: {
                    input: "$userProgress.chapterProgress",
                    as: "progress",
                    in: { $eq: ["$$progress", 100] }
                  }
                }
              }
            ]
          }
        }
      },
      // Get total chapters for this story
      {
        $lookup: {
          from: "chapter_v2",
          let: { storyId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$storyId", "$$storyId"] },
                    { $eq: ["$isDeleted", false] }
                  ]
                }
              }
            }
          ],
          as: "allChapters"
        }
      },
      // Project the required fields
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          thumbnail: "$thumbnails.portrait",
          thumbnails: 1,
          videoLink: 1,
          isDefault: 1,
          totalChapters: { $size: "$allChapters" },
          isCompleted: 1,
          isNewLaunch: 1,
          isWriterStory: 1,
          userProgress: {
            $cond: {
              if: { $gt: [{ $size: "$userProgress" }, 0] },
              then: {
                hasStarted: true,
                progress: { $max: "$userProgress.chapterProgress" }, // Get max progress across chapters
                lastReadAt: { $max: "$userProgress.updatedAt" } // Get most recent update
              },
              else: {
                hasStarted: false,
                progress: 0,
                lastReadAt: null
              }
            }
          }
        }
      }
    ]);

    if (!defaultStory || defaultStory.length === 0) {
      logger.info(`No default story found for user: ${userId}`);
      return res.status(200).json({
        success: false,
        message: "No default story found",
        story: null
      });
    }

    const story = defaultStory[0];
    logger.info(`Default story found for user: ${userId} ${story}`);
    // If the default story is completed, return null so frontend can call getLastUnfinishedStory
    if (story.isCompleted) {
      return res.status(200).json({
        success: false,
        message: "Default story already completed",
        story: null
      });
    }

    logger.info(`Default story retrieved successfully for user: ${userId} ${story}`);
    return res.status(200).json({
      success: true,
      message: "Default story retrieved successfully",
      story: story
    });

  } catch (error) {
    logger.error(`Error fetching default story: ${error}`);
    return res.status(500).json({
      success: false,
      error: "DATABASE_ERROR",
      message: "Internal server error",
      details: {
        error: error.message
      }
    });
  }
};

module.exports = {
  getLastUnfinishedStory,
  getDefaultStory
};
