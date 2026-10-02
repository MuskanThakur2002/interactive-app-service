const UserProgress = require("../models/UserProgressV2");
const Chapter = require("../models/ChapterV2");
const Story = require("../models/StoryV2");
const Scene = require("../models/SceneV2");
const BackgroundImage = require("../models/BackgroundImageV2");
const Character = require("../models/CharacterV2");
const Outfit = require("../models/OutfitV2");
const SubScene = require("../models/SubSceneV2");
const { mongoose } = require("../utils/DatabaseUtils");
const User = require("../models/User");
const logger = require("../utils/logger");
const StoryReaction = require("../models/StoryReaction");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const crypto = require('crypto');
const { createShareAndUnlockRecord } = require('../services/SceneUnlockService');
// AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Multer configuration for thumbnail uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for thumbnails
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  }
});

const getStoryByStoryId = async (req, res) => {
  try {
    const { storyId } = req.params;
    const story = await Story.findOne({
      _id: new mongoose.Types.ObjectId(storyId),
      isDeleted: false
    });
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }
    return res.status(200).json({
      success: true,
      data: story
    });
  } catch (error) {
    console.error("Error fetching story by story ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

// @deprecated - This endpoint is deprecated. Use getUserStoriesV2 instead.
const getUserStoriesV1 = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Fetch user details
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Determine story status based on user role
    const storyStatus =
      user.role === "REVIEWER" ? ["REVIEW", "PUBLISHED"] : ["PUBLISHED"];
      
    // Get all stories based on user role
    const allStories = await Story.find({
      status: { $in: storyStatus },
      isDeleted: false
    }).sort({ createdAt: -1 });

    // Get like counts for all stories
    const storyIds = allStories.map(story => story._id);
    const likeCounts = await StoryReaction.aggregate([
      {
        $match: {
          storyId: { $in: storyIds },
          reaction: "LIKE"
        }
      },
      {
        $group: {
          _id: "$storyId",
          likeCount: { $sum: 1 }
        }
      }
    ]);

    // Create a map of storyId to like count
    const likeCountMap = likeCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.likeCount;
      return acc;
    }, {});

    // Add like counts to stories
    const storiesWithLikes = allStories.map(story => {
      const storyObj = story.toObject();
      return {
        ...storyObj,
        likeCount: likeCountMap[story._id.toString()] || 0
      };
    });

    const uniqueStoryIds = await UserProgress.distinct("storyId", { userId });

    const inProgressStories = await Promise.all(
      uniqueStoryIds.map(async (storyId) => {
        const story = await Story.findById(storyId);
        if (!story) {
          return null; // Return null for non-existent stories
        }
        const allChapterProgress = await UserProgress.find({
          userId,
          storyId
        });

        const chapters = await Chapter.find({
          storyId,
          isDeleted: false
        }).sort({
          createdAt: 1
        });

        const totalChapterPercentage = chapters.length * 100

        let totalProgress = 0
        for(let inprogressChapter of allChapterProgress){
          totalProgress += inprogressChapter.chapterProgress
        }

        const totalProgressPercentage = (totalProgress / totalChapterPercentage) * 100

        const storyObject = story.toObject();
        return { 
          ...storyObject, 
          progress: Math.min(totalProgressPercentage, 100),
          likeCount: likeCountMap[story._id.toString()] || 0
        };
      })
    ).then((stories) => stories.filter((story) => story !== null)); // Filter out null stories

    // Get 2 random stories for recommendations
    const otherStories = storiesWithLikes.filter(
      (story) => !inProgressStories.some((ps) => ps._id.equals(story._id))
    );
    // Exclude last 3 stories and randomly select from remaining
    const storiesToChooseFrom = otherStories.slice(0, -3);
    const recommendedStories = storiesToChooseFrom
      ?.sort(() => 0.5 - Math.random())
      .slice(0, 2);

    return res.status(200).json({
      success: true,
      data: {
        allStories: storiesWithLikes,
        inProgressStories,
        recommendedStories
      }
    });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getUserStoriesV2 = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Fetch user details
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Determine story status based on user role
    const storyStatus =
      user.role === "REVIEWER" ? ["REVIEW", "PUBLISHED"] : ["PUBLISHED"];

    // Try to get cached stories first
    const cacheManager = require("../utils/cacheManager");
    const cacheKey = `stories:all:${user.role}`;
    let allStories = await cacheManager.getCache(cacheKey);
    
    if (!allStories) {
      console.log(`Cache miss for stories: ${cacheKey}, fetching from database`);
      
      // Get all stories based on user role
      allStories = await Story.find({
        status: { $in: storyStatus },
        isDeleted: false
      }).sort({ createdAt: -1 });

      // Cache the stories for 2 hours
      await cacheManager.setCache(cacheKey, allStories, 7200);
      console.log(`Cached stories for key: ${cacheKey}`);
    } else {
      console.log(`Cache hit for stories: ${cacheKey}`);
    }

    // TODO: Temporarily disabled like counts for all stories until we have a full ideation on social validation is done
    // Get like counts for all stories
    // const storyIds = allStories.map(story => story._id);
    // const likeCounts = await StoryReaction.aggregate([
    //   {
    //     $match: {
    //       storyId: { $in: storyIds },
    //       reaction: "LIKE"
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: "$storyId",
    //       likeCount: { $sum: 1 }
    //     }
    //   }
    // ]);

    // // Create a map of storyId to like count
    // const likeCountMap = likeCounts.reduce((acc, curr) => {
    //   acc[curr._id.toString()] = curr.likeCount;
    //   return acc;
    // }, {});

    // // Add like counts to stories
    // const storiesWithLikes = allStories.map(story => {
    //   const storyObj = story.toObject();
    //   return {
    //     ...storyObj,
    //     likeCount: likeCountMap[story._id.toString()] || 0
    //   };
    // });

    const uniqueStoryIds = await UserProgress.distinct("storyId", { userId });

    // Initialize inProgressStories as empty array
    let inProgressStories = [];

    if (uniqueStoryIds.length > 0) {
      // 🚀 BATCH QUERY 1: Fetch all in-progress stories at once
      const inProgressStoriesData = await Story.find({
        _id: { $in: uniqueStoryIds }
      });

      // ✅ Handle missing stories - create a map for easy lookup
      const storyMap = new Map();
      inProgressStoriesData.forEach(story => {
        storyMap.set(story._id.toString(), story);
      });

      // 🚀 BATCH QUERY 2: Fetch all user progress at once
      const userProgress = await UserProgress.find({
        userId,
        storyId: { $in: uniqueStoryIds }
      });

      // 🚀 BATCH QUERY 3: Fetch all chapters at once
      const allChapters = await Chapter.find({
        storyId: { $in: uniqueStoryIds },
        isDeleted: false
      }).sort({ createdAt: 1 });

      // ✅ Process only existing stories (handle nulls)
      inProgressStories = uniqueStoryIds
        .map(storyId => {
          const story = storyMap.get(storyId.toString());
          
          // ✅ Skip non-existent stories (same as original null handling)
          if (!story) {
            return null;
          }

          const storyProgress = userProgress.filter(
            progress => progress.storyId.toString() === story._id.toString()
          );
          
          const storyChapters = allChapters.filter(
            chapter => chapter.storyId.toString() === story._id.toString()
          );

          const totalChapterPercentage = storyChapters.length * 100;
          let totalProgress = 0;
          
          for (let inprogressChapter of storyProgress) {
            totalProgress += inprogressChapter.chapterProgress;
          }

          const totalProgressPercentage = (totalProgress / totalChapterPercentage) * 100;

          return {
            ...story.toObject(),
            progress: Math.min(totalProgressPercentage, 100),
            // likeCount: likeCountMap[story._id.toString()] || 0
          };
        })
        .filter(story => story !== null); // ✅ Filter out nulls (same as original)
    }
    // Get 2 random stories for recommendations
    // const otherStories = storiesWithLikes.filter(
    //   (story) => !inProgressStories.some((ps) => ps._id.equals(story._id))
    // );
    // // Exclude last 3 stories and randomly select from remaining
    // const storiesToChooseFrom = otherStories.slice(0, -3);
    // const recommendedStories = storiesToChooseFrom
    //   ?.sort(() => 0.5 - Math.random())
    //   .slice(0, 2);

    return res.status(200).json({
      success: true,
      data: {
        allStories: allStories,
        inProgressStories,
        // recommendedStories
      }
    });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getMomentUserStories = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Fetch user details
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const storyStatus =
      user.role === "REVIEWER" ? ["REVIEW", "PUBLISHED"] : ["PUBLISHED"];
    const allStories = await Story.find({
      status: { $in: storyStatus },
      isDeleted: false,
      story_type: "Moment"
    }).sort({ createdAt: -1 });

    // Removed temporarily until a full ideation on social validation is done
    // Get like counts for all stories
    // const storyIds = allStories.map(story => story._id);
    // const likeCounts = await StoryReaction.aggregate([
    //   {
    //     $match: {
    //       storyId: { $in: storyIds },
    //       reaction: "LIKE"
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: "$storyId",
    //       likeCount: { $sum: 1 }
    //     }
    //   }
    // ]);

    // // Create a map of storyId to like count
    // const likeCountMap = likeCounts.reduce((acc, curr) => {
    //   acc[curr._id.toString()] = curr.likeCount;
    //   return acc;
    // }, {});

    // // Add like counts to stories
    // const storiesWithLikes = allStories.map(story => {
    //   const storyObj = story.toObject();
    //   return {
    //     ...storyObj,
    //     likeCount: likeCountMap[story._id.toString()] || 0
    //   };
    // });

    return res.status(200).json({
      success: true,
      data: allStories
    });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getUserNormalStories = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Fetch user details
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const storyStatus =
      user.role === "REVIEWER" ? ["REVIEW", "PUBLISHED"] : ["PUBLISHED"];
    const allStories = await Story.find({
      status: { $in: storyStatus },
      isDeleted: false,
      story_type: { $ne: "Moment" }
    }).sort({ createdAt: -1 });

    // Get like counts for all stories
    const storyIds = allStories.map(story => story._id);
    const likeCounts = await StoryReaction.aggregate([
      {
        $match: {
          storyId: { $in: storyIds },
          reaction: "LIKE"
        }
      },
      {
        $group: {
          _id: "$storyId",
          likeCount: { $sum: 1 }
        }
      }
    ]);

    // Create a map of storyId to like count
    const likeCountMap = likeCounts.reduce((acc, curr) => {
      acc[curr._id.toString()] = curr.likeCount;
      return acc;
    }, {});

    // Add like counts to stories
    const storiesWithLikes = allStories.map(story => {
      const storyObj = story.toObject();
      return {
        ...storyObj,
        likeCount: likeCountMap[story._id.toString()] || 0
      };
    });

    return res.status(200).json({
      success: true,
      data: storiesWithLikes
    });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const previewStoryScene = async (req, res) => {
  try {
    let { sceneId } = req.params;

    sceneId = sceneId.trim().replace(/[^0-9a-f]/g, "");

    console.log(`Starting to retrieve scenes for chapter ID: ${sceneId}`);

    const scenes = await Scene.find({
      _id: new mongoose.Types.ObjectId(sceneId),
      isDeleted: false
    })
      .sort({ sceneNumber: 1 })
      .populate("backgroundId")
      .populate({
        path: "characters.characterId",
        model: "Character_v2"
      })
      .populate({
        path: "characters.outfitId",
        model: "Outfit_v2"
      })
      .populate({
        path: "characters.protagonistOptions.characterId",
        model: "Character_v2"
      })
      .populate({
        path: "characters.protagonistOptions.outfitId",
        model: "Outfit_v2"
      })
      .populate({
        path: "characters.loveInterestOptions.characterId",
        model: "Character_v2"
      })
      .populate({
        path: "characters.loveInterestOptions.outfitId",
        model: "Outfit_v2"
      })
      .populate({
        path: "workflows.choices.subSceneIds",
        model: "Sub_scene_v2"
      })
      .populate({
        path: "workflows.choices.outfitId",
        model: "Outfit_v2"
      })
      .populate({
        path: "workflows.background.backgroundId",
        model: "BackgroundImage"
      });

    if (!scenes.length) {
      return res
        .status(404)
        .json({ message: "No scenes found for this chapter." });
    }

    console.log("scenes", scenes);
    // Sort scenes by sceneNumber
    scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);

    // Sort workflows by createdAt for each scene
    scenes.forEach((scene) => {
      scene.workflows.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
    });

    res.json(scenes);
  } catch (error) {
    console.error("Error fetching story scene:", error);
  }
}
const previewSceneV2 = async (req, res) => {
  try {
    let { chapterId } = req.params;
    chapterId = chapterId.trim().replace(/[^0-9a-f]/g, "");

    // Input validation
    if (!chapterId || !mongoose.Types.ObjectId.isValid(chapterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chapter ID provided"
      });
    }

    console.log(`Starting to retrieve scenes for chapter ID: ${chapterId}`);

    // Try to get from cache first
    const cacheManager = require("../utils/cacheManager");
    const cachedScenes = await cacheManager.getScenePreview(chapterId);
    
    if (cachedScenes) {
      console.log(`Cache hit for chapter ID: ${chapterId}`);
      return res.json(cachedScenes);
    }

    console.log(`Cache miss for chapter ID: ${chapterId}, fetching from database`);

    // Fetch from database
    const scenes = await Scene.find({
      chapterId: new mongoose.Types.ObjectId(chapterId),
      isDeleted: false
    }).sort({ sceneNumber: 1 });

    // Get storyId for cache metadata
    const chapter = await Chapter.findById(chapterId).select("storyId");
    const storyId = chapter ? chapter.storyId : null;

    // Store in cache (1 hour TTL)
    await cacheManager.setScenePreview(chapterId, scenes, storyId, 3600);

    res.json(scenes);
  } catch (error) {
    console.error("Error fetching scenes by chapter ID:", error);
    res.status(500).json({ message: "Error fetching scenes by chapter ID" });
  }
};

const previewScene = async (req, res) => {
  try {
    let { chapterId, sceneNumber, sceneId } = req.params;
    chapterId = chapterId.trim().replace(/[^0-9a-f]/g, "");
    // Check hybrid cache first
    // const CacheManager = require('../utils/cacheManager');
    // let scenes = await CacheManager.getScenePreview(chapterId);
    
    // if (scenes) {
    //   console.log(`Cache hit for chapter ID: ${chapterId}`);
    //   return res.json(scenes);
    // }

    console.log(`Cache miss - fetching scenes for chapter ID: ${chapterId}`);

    // Get storyId for cache metadata
    const Chapter = require('../models/ChapterV2');
    const chapter = await Chapter.findById(chapterId).select('storyId');
    if (!chapter) {
      return res.status(404).json({ message: "Chapter not found." });
    }

    let scenes = [];
    if(sceneId && sceneId !== "undefined" && sceneId !== "null"){
      scenes = await Scene.find({
        _id: new mongoose.Types.ObjectId(sceneId),
        isDeleted: false
      })
        .populate([
          {
            path: "backgroundId",
            model: "BackgroundImage"
          },
          {
            path: "characters.characterId",
            model: "Character_v2"
          },
          {
            path: "characters.outfitId",
            model: "Outfit_v2"
          },
          {
            path: "characters.protagonistOptions.characterId",
            model: "Character_v2"
          },
          {
            path: "characters.protagonistOptions.outfitId",
            model: "Outfit_v2"
          },
          {
            path: "characters.loveInterestOptions.characterId",
            model: "Character_v2"
          },
          {
            path: "characters.loveInterestOptions.outfitId",
            model: "Outfit_v2"
          },
          {
            path: "workflows.choices.subSceneIds",
            model: "Sub_scene_v2"
          },
          {
            path: "workflows.choices.outfitId",
            model: "Outfit_v2"
          },
          {
            path: "workflows.background.backgroundId",
            model: "BackgroundImage"
          }
        ]);
  
    }
    else{
      scenes = await Scene.find({
        chapterId: new mongoose.Types.ObjectId(chapterId),
        sceneNumber: parseInt(sceneNumber),
        isDeleted: false
      })
        .populate([
          {
            path: "backgroundId",
            model: "BackgroundImage"
          },
          {
            path: "characters.characterId",
            model: "Character_v2"
          },
          {
            path: "characters.outfitId",
            model: "Outfit_v2"
          },
          {
            path: "characters.protagonistOptions.characterId",
            model: "Character_v2"
          },
          {
            path: "characters.protagonistOptions.outfitId",
            model: "Outfit_v2"
          },
          {
            path: "characters.loveInterestOptions.characterId",
            model: "Character_v2"
          },
          {
            path: "characters.loveInterestOptions.outfitId",
            model: "Outfit_v2"
          },
          {
            path: "workflows.choices.subSceneIds",
            model: "Sub_scene_v2"
          },
          {
            path: "workflows.choices.outfitId",
            model: "Outfit_v2"
          },
          {
            path: "workflows.background.backgroundId",
            model: "BackgroundImage"
          }
        ]);
  
    }

    if (!scenes.length) {
      return res
        .status(404)
        .json({ message: "No scenes found for this chapter." });
    }

    // Get total number of scenes in this chapter
    const totalScenes = await Scene.countDocuments({ 
      chapterId: new mongoose.Types.ObjectId(chapterId),
      isDeleted: false 
    });

    // Sort workflows by createdAt for each scene
    scenes.forEach((scene) => {
      scene.workflows.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
    });

    // Check if this is the last scene
    const isLastScene = parseInt(sceneNumber) === totalScenes;
    
    res.json({ 
      data: scenes,
      isLastScene,
      totalScenes,
      currentSceneNumber: parseInt(sceneNumber)
    });
  } catch (error) {
    console.error("Error fetching scenes by chapter ID:", error);
    res.status(500).json({ message: "Error fetching scenes by chapter ID" });
  }
};

const getChaptersByStoryId = async (req, res) => {
  const { userId, storyId } = req.params;
  if (!storyId) {
    logger.error("Story ID is required for getting chapters by story ID");
    return res.status(400).json({
      success: false,
      message: "Story ID is required"
    });
  }

  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) {
    logger.error("User not found for getting chapters by story ID");
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }
  try {
    // const chapterStatus =
    //   user.role === "REVIEWER" ? ["REVIEW", "PUBLISHED"] : ["PUBLISHED"];
    logger.info(`Getting chapters by story ID: ${storyId} for user: ${userId}`);
    const chapters = await Chapter.find({
      storyId,
      // status: { $in: chapterStatus },
      isDeleted: false
    }).sort({ createdAt: 1 });

    if (!chapters.length) {
      logger.error(`No published chapters found for this story ${storyId}`);
      return res.status(404).json({
        success: false,
        message: "No published chapters found for this story"
      });
    }

    logger.info(`Chapters found for this story ${storyId}`);
    let chaptersWithProgress = chapters;

    if (userId) {
      logger.info(`Getting user progress for this story ${storyId} for user: ${userId}`);
      const userProgress = await UserProgress.find({
        userId,
        storyId
      });

      logger.info(`User progress found for this story ${storyId} for user: ${userId}`);
      chaptersWithProgress = chapters.map((chapter) => {
        const progress = userProgress.find(
          (up) => up.chapterId.toString() === chapter._id.toString()
        );
        return {
          ...chapter.toObject(),
          progress: progress ? progress.chapterProgress : 0,
          isCompleted: progress ? progress.isCompleted : false,
          protagonistIds: progress ? progress.protagonistIds : [],
          loveInterestIds: progress ? progress.loveInterestIds : [],
          isStarted: progress ? progress.isStarted : false
        };
      });
    }

    logger.info(`Chapters with progress found for this story ${storyId} for user: ${userId}`);
    return res.status(200).json({
      success: true,
      data: chaptersWithProgress
    });
  } catch (error) {
    logger.error(`Error fetching chapters by story ID: ${storyId} for user: ${userId} with error: ${error}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Upload Story Thumbnails API
 *
 * Endpoint: POST /upload-story-thumbnails/:storyId
 * Content-Type: multipart/form-data
 *
 * Form Data (all optional, upload at least one):
 * - square: Image file for 1:1 aspect ratio
 * - portrait: Image file for 2:3 aspect ratio  
 * - vertical: Image file for 9:16 aspect ratio
 * - landscape: Image file for 16:9 aspect ratio
 *
 * Response:
 * Success (200):
 * {
 *   "success": true,
 *   "message": "Story thumbnails uploaded successfully",
 *   "data": {
 *     "storyId": "...",
 *     "thumbnails": {
 *       "square": "https://cdn.example.com/thumbnails/...",
 *       "portrait": "https://cdn.example.com/thumbnails/...",
 *       // ... other uploaded thumbnails
 *     }
 *   }
 * }
 */
const uploadStoryThumbnails = async (req, res) => {
  try {
    const { storyId } = req.params;

    // Check if story exists
    const story = await Story.findOne({ _id: storyId, isDeleted: false });
    if (!story) {
      return res.status(404).json({
        success: false,
        message: "Story not found"
      });
    }

    // Check if at least one file was uploaded
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one thumbnail image is required"
      });
    }

    const uploadedThumbnails = {};
    const aspectRatios = ['square', 'portrait', 'vertical', 'landscape'];

    // Process each uploaded thumbnail
    for (const aspectRatio of aspectRatios) {
      const file = req.files[aspectRatio] && req.files[aspectRatio][0];

      if (file) {
        try {
          // Generate unique filename
          const fileExtension = file.originalname.split(".").pop();
          const fileName = `${storyId}-${aspectRatio}-${Date.now()}.${fileExtension}`;
          const s3Key = `story-thumbnails/${fileName}`;

          // Upload to S3
          const uploadParams = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: s3Key,
            Body: file.buffer,
            ContentType: file.mimetype
          };

          const command = new PutObjectCommand(uploadParams);
          await s3Client.send(command);

          // Construct the CloudFront CDN URL
          const imageUrl = `${process.env.AWS_CDN_URL}/${s3Key}`;
          uploadedThumbnails[aspectRatio] = imageUrl;

          logger.info(`Uploaded ${aspectRatio} thumbnail for story ${storyId}: ${imageUrl}`);
        } catch (uploadError) {
          logger.error(`Failed to upload ${aspectRatio} thumbnail: ${uploadError.message}`);
          return res.status(500).json({
            success: false,
            message: `Failed to upload ${aspectRatio} thumbnail`,
            error: uploadError.message
          });
        }
      }
    }

    // Update story with new thumbnail URLs
    const updateData = {};
    Object.keys(uploadedThumbnails).forEach(aspectRatio => {
      updateData[`thumbnails.${aspectRatio}`] = uploadedThumbnails[aspectRatio];
    });

    const updatedStory = await Story.findByIdAndUpdate(
      storyId,
      { $set: updateData },
      { new: true }
    );

    logger.info(`Successfully updated thumbnails for story ${storyId}`);

    return res.status(200).json({
      success: true,
      message: "Story thumbnails uploaded successfully",
      data: {
        storyId: storyId,
        thumbnails: uploadedThumbnails,
        updatedStory: updatedStory
      }
    });

  } catch (error) {
    logger.error(`Error uploading story thumbnails: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get Total Paid Unlock Count API
 * 
 * Endpoint: POST /api/story/getTotalPaidUnlockCount/:storyId/chapter/:chapterId
 * 
 * Request Body:
 * {
 *   "sceneIds": ["sceneId1", "sceneId2", "sceneId3"]
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "totalCount": 150
 * }
 */
const getTotalPaidUnlockCount = async (req, res) => {
  try {
    const { storyId, chapterId } = req.params;
    const { sceneIds } = req.body;

    // Input validation for params
    if (!storyId || !mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: "Valid storyId is required"
      });
    }

    if (!chapterId || !mongoose.Types.ObjectId.isValid(chapterId)) {
      return res.status(400).json({
        success: false,
        message: "Valid chapterId is required"
      });
    }

    // Input validation for body
    if (!sceneIds || !Array.isArray(sceneIds) || sceneIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "sceneIds array is required and must not be empty"
      });
    }

    // Validate all scene IDs
    const invalidSceneIds = sceneIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidSceneIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid scene IDs: ${invalidSceneIds.join(', ')}`
      });
    }

    logger.info(`Getting total paid unlock count for story: ${storyId}, chapter: ${chapterId}, scenes: ${sceneIds.join(', ')}`);

    // Verify that the chapter belongs to the story
    const chapter = await Chapter.findOne({
      _id: new mongoose.Types.ObjectId(chapterId),
      storyId: new mongoose.Types.ObjectId(storyId),
      isDeleted: false
    });

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found or does not belong to the specified story"
      });
    }

    // Find all scenes with the provided IDs that belong to the specified chapter
    const scenes = await Scene.find({
      _id: { $in: sceneIds.map(id => new mongoose.Types.ObjectId(id)) },
      chapterId: new mongoose.Types.ObjectId(chapterId),
      isDeleted: false
    }).select('_id total_paid_unlocks');

    if (scenes.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No scenes found with the provided IDs in the specified chapter"
      });
    }

    // Check if all requested scenes were found
    if (scenes.length !== sceneIds.length) {
      const foundSceneIds = scenes.map(scene => scene._id.toString());
      const missingSceneIds = sceneIds.filter(id => !foundSceneIds.includes(id));
      return res.status(404).json({
        success: false,
        message: `Some scenes not found or do not belong to the chapter: ${missingSceneIds.join(', ')}`
      });
    }

    // Calculate total paid unlocks
    const totalPaidUnlocks = scenes.reduce((sum, scene) => sum + (scene.total_paid_unlocks || 0), 0);

    logger.info(`Retrieved total paid unlock count: ${totalPaidUnlocks} for ${scenes.length} scenes in story: ${storyId}, chapter: ${chapterId}`);

    return res.status(200).json({
      success: true,
      totalCount: totalPaidUnlocks
    });

  } catch (error) {
    logger.error(`Error getting total paid unlock count: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Increment Paid Unlock Count API
 * 
 * Endpoint: POST /api/story/increamentPaidUnlockCount/:storyId/chapter/:chapterId
 * 
 * Request Body:
 * {
 *   "sceneIds": ["sceneId1", "sceneId2", "sceneId3"]
 * }
 * 
 * Response:
 * {
 *   "success": true
 * }
 */
const incrementPaidUnlockCount = async (req, res) => {
  try {
    const { storyId, chapterId } = req.params;
    const { sceneIds } = req.body;

    // Input validation
    if (!storyId || !mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid story ID provided"
      });
    }

    if (!chapterId || !mongoose.Types.ObjectId.isValid(chapterId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid chapter ID provided"
      });
    }

    if (!sceneIds || !Array.isArray(sceneIds) || sceneIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "sceneIds array is required and must not be empty"
      });
    }

    // Validate all scene IDs
    const invalidSceneIds = sceneIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidSceneIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid scene IDs: ${invalidSceneIds.join(', ')}`
      });
    }

    logger.info(`Incrementing paid unlock count for story: ${storyId}, chapter: ${chapterId}, scenes: ${sceneIds.join(', ')}`);

    // Verify that the chapter belongs to the story
    const chapter = await Chapter.findOne({
      _id: new mongoose.Types.ObjectId(chapterId),
      storyId: new mongoose.Types.ObjectId(storyId),
      isDeleted: false
    });

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: "Chapter not found or does not belong to the specified story"
      });
    }

    // Verify that all scenes belong to the chapter
    const scenes = await Scene.find({
      _id: { $in: sceneIds.map(id => new mongoose.Types.ObjectId(id)) },
      chapterId: new mongoose.Types.ObjectId(chapterId),
      isDeleted: false
    });

    if (scenes.length !== sceneIds.length) {
      const foundSceneIds = scenes.map(scene => scene._id.toString());
      const missingSceneIds = sceneIds.filter(id => !foundSceneIds.includes(id));
      return res.status(404).json({
        success: false,
        message: `Some scenes not found or do not belong to the chapter: ${missingSceneIds.join(', ')}`
      });
    }

    // Update total_paid_unlocks for each scene (increment by 1)
    const updatePromises = sceneIds.map(sceneId => 
      Scene.findByIdAndUpdate(
        new mongoose.Types.ObjectId(sceneId),
        { $inc: { total_paid_unlocks: 1 } },
        { new: true, select: '_id total_paid_unlocks' }
      )
    );

    await Promise.all(updatePromises);

    logger.info(`Successfully updated paid unlock counts for ${sceneIds.length} scenes`);

    return res.status(200).json({
      success: true
    });

  } catch (error) {
    logger.error(`Error incrementing paid unlock count: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Cache management endpoints
const invalidateSceneCache = async (req, res) => {
  try {
    const { chapterId, storyId } = req.params;
    const CacheManager = require('../utils/cacheManager');
    
    if (chapterId) {
      await CacheManager.invalidateChapterScenes(chapterId);
      res.json({ 
        success: true, 
        message: `Cache invalidated for chapter ${chapterId}` 
      });
    } else if (storyId) {
      await CacheManager.invalidateStoryScenes(storyId);
      res.json({ 
        success: true, 
        message: `Cache invalidated for story ${storyId}` 
      });
    } else {
      await CacheManager.flush();
      res.json({ 
        success: true, 
        message: 'All scene caches cleared' 
      });
    }
  } catch (error) {
    console.error('Error invalidating cache:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error invalidating cache' 
    });
  }
};

const getCacheStats = async (req, res) => {
  try {
    const CacheManager = require('../utils/cacheManager');
    const stats = CacheManager.getStats();
    const health = await CacheManager.healthCheck();
    
    res.json({ 
      success: true, 
      stats,
      health
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting cache stats' 
    });
  }
};

const getCacheHealth = async (req, res) => {
  try {
    const CacheManager = require('../utils/cacheManager');
    const health = await CacheManager.healthCheck();
    
    res.json({ 
      success: true, 
      health
    });
  } catch (error) {
    console.error('Error getting cache health:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error getting cache health' 
    });
  }
};

// Story cache management endpoints
const invalidateStoriesCache = async (req, res) => {
  try {
    const CacheManager = require('../utils/cacheManager');
    const result = await CacheManager.invalidateStoriesCache();
    
    res.json({ 
      success: true, 
      message: 'Stories cache invalidated successfully',
      result
    });
  } catch (error) {
    console.error('Error invalidating stories cache:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error invalidating stories cache' 
    });
  }
};

const invalidateUserRoleStoriesCache = async (req, res) => {
  try {
    const { userRole } = req.params;
    const CacheManager = require('../utils/cacheManager');
    const result = await CacheManager.invalidateUserRoleStoriesCache(userRole);
    
    res.json({ 
      success: true, 
      message: `Stories cache invalidated for role: ${userRole}`,
      result
    });
  } catch (error) {
    console.error('Error invalidating user role stories cache:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error invalidating user role stories cache' 
    });
  }
};

// Share and unlock endpoint
const shareAndUnlock = async (req, res) => {
  try {
    const { userId, storyId, chapterId } = req.body;
    
    if (!userId || !storyId || !chapterId) {
      return res.status(400).json({
        success: false,
        message: "User ID, Story ID, and Chapter ID are required"
      });
    }

    // Generate unique share token
    const shareToken = crypto.randomUUID();
    
    // Create share-and-unlock record
    const result = await createShareAndUnlockRecord({
      userId,
      storyId,
      chapterId,
      shareToken
    });

    // Generate share URL
    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://app.troak.com';
    const shareUrl = new URL('/scene-preview-v2', frontendBaseUrl);
    shareUrl.searchParams.append('storyId', storyId);
    shareUrl.searchParams.append('chapterId', chapterId);
    shareUrl.searchParams.append('shareToken', shareToken);
    shareUrl.searchParams.append('utm_source', 'share_and_unlock');
    shareUrl.searchParams.append('utm_medium', 'share');
    shareUrl.searchParams.append('utm_campaign', 'friend_invite');

    logger.info(`Share-and-unlock created for user ${userId}: ${result.pendingScenes} scenes pending friend activation`);

    res.status(200).json({
      success: true,
      shareUrl: shareUrl.toString(),
      shareToken,
      pendingScenes: result.pendingScenes,
      message: "Share link generated successfully. Share with a friend to unlock scenes!"
    });

  } catch (error) {
    logger.error(`Share-and-unlock error: ${error.message}`);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};

module.exports = {
  getUserStoriesV2,
  previewScene,
  getChaptersByStoryId,
  getMomentUserStories,
  getUserNormalStories,
  previewStoryScene,
  uploadStoryThumbnails,
  upload, // Export multer middleware
  previewSceneV2,
  getStoryByStoryId,
  getTotalPaidUnlockCount,
  incrementPaidUnlockCount,
  invalidateSceneCache,
  getCacheStats,
  getCacheHealth,
  invalidateStoriesCache,
  invalidateUserRoleStoriesCache,
  shareAndUnlock
};
