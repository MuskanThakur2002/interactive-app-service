const UserProgress = require("../models/UserProgressV2");
const Chapter = require("../models/ChapterV2");
const InProgressStory = require("../models/InProgressStory");
const { mongoose } = require("../utils/DatabaseUtils");
const Scene = require("../models/SceneV2");
const Character = require("../models/CharacterV2");
const Story = require("../models/StoryV2");
const OutfitV2 = require("../models/OutfitV2");

const updateUserProgress = async (req, res) => {
  try {
    const {
      userId,
      storyId,
      chapterId,
      sceneId,
      protagonistIds,
      loveInterestIds,
      isStarted
    } = req.body;

    if (!userId || !storyId || !chapterId || !sceneId) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Get total scenes in chapter from Scene table
    const totalScenes = await Scene.countDocuments({ chapterId });
    if (totalScenes === 0) {
      logger.error(`No scenes found for chapterId during updateUserProgress: ${chapterId}`);
      return res.status(404).json({
        success: false,
        message: "No scenes found for this chapter"
      });
    }
    
    const scene = await Scene.findById(sceneId);
    if (!scene) {
      logger.error(`Scene not found for sceneId during updateUserProgress: ${sceneId}`);
      return res.status(404).json({
        success: false,
        message: "Scene not found"
      });
    }

    // Find or create progress record
    let userProgress = await UserProgress.findOne({
      userId,
      storyId,
      chapterId
    });

    if (!userProgress) {
      userProgress = new UserProgress({
        userId,
        storyId,
        chapterId,
        scenesRead: 0,
        totalScenes: totalScenes,
        lastViewedSceneId: null,
        isCompleted: false,
        protagonist:
          protagonistIds && protagonistIds.characterId ? protagonistIds : null,
        loveInterest:
          loveInterestIds && !Array.isArray(loveInterestIds)
            ? loveInterestIds
            : null,
        isStarted: isStarted || false
      });
    } else {
      // Update protagonistIds and loveInterestIds if provided
      if (protagonistIds && protagonistIds.characterId) {
        if (!protagonistIds.customName) {
          //fetch the character name from the character table
          const character = await Character.findById(
            protagonistIds.characterId
          );
          protagonistIds.customName = character?.characterName || "Aya";
        }
        userProgress.protagonist = protagonistIds;
      }
      if (loveInterestIds && !Array.isArray(loveInterestIds)) {
        userProgress.loveInterest = loveInterestIds;
      }
      if (isStarted) {
        userProgress.isStarted = isStarted;
      }
    }

    // Update progress
    if (userProgress.lastViewedSceneId?.toString() !== sceneId) {
      // userProgress.scenesRead += 1;
      userProgress.scenesRead = scene.sceneNumber;
      userProgress.lastViewedSceneId = sceneId;

      // Calculate chapter progress percentage
      userProgress.chapterProgress =
        (userProgress.scenesRead / userProgress.totalScenes) * 100;

      // Check if chapter is completed
      if (userProgress.scenesRead >= userProgress.totalScenes) {
        userProgress.isCompleted = true;
      }

      await userProgress.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        progress: userProgress,
        progressPercentage: userProgress.chapterProgress
      }
    });
  } catch (error) {
    console.error("Error updating user progress:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const createOngoingStory = async (req, res) => {
  try {
    const {
      userId,
      storyId,
      protagonistId,
      name: initialName,
      defaultOutfitId: initialDefaultOutfitId,
      defaultHairId: initialDefaultHairId,
      currentOutfitId: initialCurrentOutfitId,
      currentHairId: initialCurrentHairId,
      choice_id,
      chapterId,
      sceneId,
      subSceneId,
      workflowId,
      loveInterestId,
      backgroundId
    } = req.body;
    
    let protagonistObjectId = protagonistId
      ? new mongoose.Types.ObjectId(protagonistId)
      : null;
    let loveInterestObjectId = loveInterestId
      ? new mongoose.Types.ObjectId(loveInterestId)
      : null;

    let characterName = initialName;
    let defaultOutfitId = initialDefaultOutfitId;
    let defaultHairId = initialDefaultHairId;
    let currentOutfitId = initialCurrentOutfitId;
    let currentHairId = initialCurrentHairId;

    let ongoingStory = await InProgressStory.findOne({ userId, storyId });

    if (ongoingStory) {
      if (protagonistObjectId) {
        if (!characterName && !ongoingStory?.protagonist?.customName) {
          const story = await Story.findById(storyId);
          const storyCharacter = story?.characters?.find(char => char.characterId?.toString() === protagonistObjectId?.toString());
          if (storyCharacter?.customName) {
            characterName = storyCharacter.customName;
          }
        }

        ongoingStory.protagonist = {
          characterId: protagonistObjectId,
          customName: characterName  || ongoingStory.protagonist.customName,
          defaultOutfitId:
            defaultOutfitId || ongoingStory.protagonistIds?.defaultOutfitId,
          currentOutfitId:
            currentOutfitId || ongoingStory.protagonistIds?.currentOutfitId,
          defaultHairId:
            defaultHairId || ongoingStory.protagonistIds?.defaultHairId,
          currentHairId:
            currentHairId || ongoingStory.protagonistIds?.currentHairId
        };
      }

      if(characterName && ongoingStory?.protagonist?.customName !== characterName){
        ongoingStory.protagonist.customName = characterName;
      }
      if (loveInterestObjectId) {
        ongoingStory.loveInterest = loveInterestObjectId;
      }

      ongoingStory.choice_id = choice_id || ongoingStory.choice_id;
      ongoingStory.chapterId = chapterId || ongoingStory.chapterId;
      ongoingStory.sceneId = sceneId || ongoingStory.sceneId;
      ongoingStory.workflowId = workflowId || ongoingStory.workflowId;
      ongoingStory.subSceneId = subSceneId || ongoingStory.subSceneId;
      if (backgroundId) ongoingStory.backgroundId = backgroundId;

      await ongoingStory.save();
      return res.status(200).json({
        message: "OngoingStory updated successfully",
        data: ongoingStory
      });
    } else {
      if (!characterName && !ongoingStory?.protagonist?.customName && protagonistObjectId) {
        const story = await Story.findById(storyId);
        const storyCharacter = story?.characters?.find(char => char.characterId?.toString() === protagonistObjectId?.toString());
        if (storyCharacter?.customName) {
          characterName = storyCharacter.customName;
        }
      }

      const newOngoingStory = new InProgressStory({
        userId,
        storyId,
        protagonist: protagonistObjectId
          ? {
              characterId: protagonistObjectId,
              customName: characterName,
              defaultOutfitId,
              currentOutfitId,
              defaultHairId,
              currentHairId
            }
          : null,
        loveInterest: loveInterestObjectId || null,
        choice_id,
        chapterId,
        sceneId,
        workflowId,
        backgroundId,
        subSceneId
      });


      await newOngoingStory.save();
      return res.status(201).json({
        message: "OngoingStory created successfully",
        data: newOngoingStory
      });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const getOngoingStory = async (req, res) => {
  try {
    const { userId, storyId } = req.params; // Extract userId and storyId from query parameters

    if (!userId || !storyId) {
      return res.status(400).json({
        message: "userId and storyId are required"
      });
    }

    // Find the ongoing story by userId and storyId and populate references
    const ongoingStory = await InProgressStory.findOne({ userId, storyId })
      .populate({
        path: "protagonist.defaultOutfitId protagonist.defaultHairId",
        model: "Outfit_v2"
      })
      .populate({
        path: "protagonist.currentOutfitId protagonist.currentHairId",
        model: "Outfit_v2"
      })
      .populate({
        path: "loveInterest.defaultOutfitId loveInterest.defaultHairId",
        model: "Outfit_v2"
      })
      .populate({
        path: "loveInterest.currentOutfitId loveInterest.currentHairId",
        model: "Outfit_v2"
      })
      .populate({
        path: "backgroundId",
        model: "BackgroundImage"
      });

    if (!ongoingStory) {
      const AllChapters = await Chapter.find({
        storyId: storyId,
        isDeleted: false
      });

      if (AllChapters.length === 1) {
        const story = await Story.findById(storyId);
        let mainStoryCharacter = story?.characters?.find(
          (character) => character?.protagonistOptions?.length > 0
        );

        if (!mainStoryCharacter) {
          mainStoryCharacter = story?.characters?.find(
            (char) =>
              char?.characterType?.trim()?.toLowerCase() === "main_character"
          );
        }
        if (mainStoryCharacter) {
          const outfit = await OutfitV2.findOne({
            characterId: mainStoryCharacter.characterId,
            outfitImg: { $exists: true, $ne: null },
            "hairOptions.0.emotions": { $exists: true }
          });

          let protagonistObjectId = mainStoryCharacter.characterId;
          let characterName =
            mainStoryCharacter.characterName || mainStoryCharacter.customName;
          let defaultOutfitId = outfit._id;
          let currentOutfitId = outfit._id;
          let defaultHairId = outfit.hairOptions[0]._id;
          let currentHairId = outfit.hairOptions[0]._id;

          const newOngoingStory = new InProgressStory({
            userId,
            storyId,
            chapterId: AllChapters[0]._id,
            protagonist: {
              characterId: protagonistObjectId,
              customName: characterName,
              defaultOutfitId,
              currentOutfitId,
              defaultHairId,
              currentHairId
            }
          });
          await newOngoingStory.save();

          const newongoingStory = await InProgressStory.findOne({
            userId,
            storyId
          })
            .populate({
              path: "protagonist.defaultOutfitId protagonist.defaultHairId",
              model: "Outfit_v2"
            })
            .populate({
              path: "protagonist.currentOutfitId protagonist.currentHairId",
              model: "Outfit_v2"
            })
            .populate({
              path: "loveInterest.defaultOutfitId loveInterest.defaultHairId",
              model: "Outfit_v2"
            })
            .populate({
              path: "loveInterest.currentOutfitId loveInterest.currentHairId",
              model: "Outfit_v2"
            })
            .populate({
              path: "backgroundId",
              model: "BackgroundImage"
            });

          return res.status(200).json({
            message: "Ongoing story created successfully",
            data: newongoingStory
          });
        }
      }
      // If we get here, no ongoing story was found and we couldn't create a new one
      return res.status(200).json({
        message: "No ongoing story found",
        data: null
      });
    }

    // Only try to access protagonist if ongoingStory exists
    if (ongoingStory && ongoingStory.protagonist) {
      if (!ongoingStory.protagonist.customName) {
        const character = await Character.findById(
          ongoingStory?.protagonist?.characterId
        );
        if (character) {
          ongoingStory.protagonist.customName =
            character?.characterName || "Aya";
        }
      }
    }

    return res.status(200).json({
      message: "Ongoing story retrieved successfully",
      data: ongoingStory
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to retrieve ongoing story",
      error: error.message
    });
  }
};

const resetScenes = async (req, res) => {
  const { userId, storyId } = req.params;
  try {
    //find story
    const story = await Story.findById(storyId);

    if (story?.story_type === "Moment") {
      await InProgressStory.deleteMany({ userId, storyId });
      await UserProgress.deleteMany({ userId, storyId });
      return res.status(200).json({
        message: "Ongoing story deleted successfully"
      });
    }

    // find in progress data

    const inProgressData = await InProgressStory.findOne({ userId, storyId });

    if (inProgressData) {
      await InProgressStory.updateOne(
        { userId, storyId },
        {
          $set: {
            sceneId: null,
            workflowId: null,
            subSceneId: null,
            backgroundId: null,
            choice_id: null,
            lastUpdatedAt: Date.now()
          }
        }
      );
    }
    res.status(200).json({
      message: "reset scenes successfully",
      success: true
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error processing records", error });
  }
};
const deleteOngoingStory = async (req, res) => {
  const { userId, storyId, chapterId, previouschapterId } = req.params;
  try {
    //find story
    const story = await Story.findById(storyId);

    if (story?.story_type === "Moment") {
      await InProgressStory.deleteOne({ userId, storyId, chapterId });
      await UserProgress.deleteOne({ userId, storyId, chapterId });
      return res.status(200).json({
        message: "Ongoing story deleted successfully"
      });
    }

    // Delete ongoing story record
    const storyResult = await InProgressStory.deleteOne({
      userId,
      storyId
    });
    if (storyResult.deletedCount === 0) {
      console.log("Ongoing story record not found");
    }

    // Reset user progress records based on userId, chapterId, and progress conditions
    const progressResult = await UserProgress.updateMany(
      {
        userId,
        chapterId,
        storyId
      },
      {
        $set: {
          lastViewedSceneId: null,
          chapterProgress: 0,
          scenesRead: 0,
          isCompleted: false
        }
      }
    );

    await UserProgress.updateMany(
      {
        userId,
        storyId,
        chapterProgress: { $gt: 0, $lt: 100 } // This condition matches documents where chapterProgress is greater than 0 and less than 100 (i.e. chapters that are in progress but not completed)
      },
      {
        $set: {
          lastViewedSceneId: null,
          chapterProgress: 0,
          scenesRead: 0,
          isCompleted: false
        }
      }
    );
    if (previouschapterId !== "null") {
      const previousChapterResult = await UserProgress.findOne({
        userId,
        storyId,
        chapterId: previouschapterId
      });

      if (previousChapterResult) {
        const insertProgress = new InProgressStory({
          userId,
          storyId,
          chapterId: chapterId,
          protagonist: previousChapterResult.protagonist
            ? {
                characterId: previousChapterResult.protagonist.characterId,
                customName: previousChapterResult.protagonist.customName,
                defaultOutfitId:
                  previousChapterResult.protagonist.defaultOutfitId,
                currentOutfitId:
                  previousChapterResult.protagonist.currentOutfitId,
                defaultHairId: previousChapterResult.protagonist.defaultHairId,
                currentHairId: previousChapterResult.protagonist.currentHairId
              }
            : null,
          loveInterest: previousChapterResult.loveInterest
            ? new mongoose.Types.ObjectId(previousChapterResult.loveInterest)
            : null
        });
        await insertProgress.save();
        console.log("insertProgress", insertProgress);
      }
    } else {
      const insertProgress = new InProgressStory({
        userId,
        storyId,
        chapterId: chapterId,
        protagonist: null,
        loveInterest: null
      });
      await insertProgress.save();
    }

    if (progressResult.modifiedCount === 0) {
      console.log("No user progress records found for reset");
    } else {
      console.log("User progress records reset successfully");
    }

    res.status(200).json({
      message:
        "Ongoing story deleted and related user progress records reset successfully"
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error processing records", error });
  }
};

const readTotalScenes = async (req, res) => {
  try {
    const { userId } = req.params;
    const userProgress = await UserProgress.find({ userId });
    const scenesRead = userProgress.reduce(
      (acc, curr) => acc + curr.scenesRead,
      0
    );
    res.status(200).json({ scenesRead });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error reading total scenes", error });
  }
};

const getUserProgress = async (req, res) => {
  try {
    const { userId, storyId, chapterId } = req.params;

    // Check and activate any scheduled time-based unlocks
    const activationResult =
      await UserProgress.checkAndActivateScheduledUnlocks(
        userId,
        storyId,
        chapterId
      );

    // Get updated user progress after potential activation
    const userProgress = await UserProgress.find({
      userId,
      storyId,
      chapterId
    });

    // Get scheduled unlock information
    const scheduledUnlockInfo = await UserProgress.getScheduledUnlockInfo(
      userId,
      storyId,
      chapterId
    );

    res.status(200).json({
      userProgress,
      scheduledUnlocksInfo: {
        ...scheduledUnlockInfo,
        activatedCount: activationResult.activatedCount,
        activatedScenes: activationResult.activatedScenes
      }
    });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "Error getting user progress", error });
  }
};

module.exports = {
  updateUserProgress,
  createOngoingStory,
  getOngoingStory,
  deleteOngoingStory,
  readTotalScenes,
  getUserProgress,
  resetScenes
};
