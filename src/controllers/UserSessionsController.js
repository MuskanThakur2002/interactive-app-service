const UserSessions = require("../models/UserSessions");
const SessionLogs = require("../models/SessionLogs");
const Stories = require("../models/StoryV2");

const createUserSession = async (req, res) => {
  try {
    const { userId, deviceId } = req.body;
    const userSession = await UserSessions.create({ userId, deviceId });
    res.status(200).json({ userSession });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateSessionLog = async (req, res) => {
  try {
    const {
      userId,
      sessionId,
      storyId,
      chapterId,
      sceneId,
      sceneNumber,
      sessionLogId
    } = req.body;
    const userSession = await UserSessions.findById(sessionId);
    if (!userSession) {
      return res.status(404).json({ message: "Session not found" });
    }
    const story = await Stories.findById(storyId);
    if (sessionLogId) {
      const sessionLog = await SessionLogs.findById(sessionLogId);
      if (sessionLog) {
        sessionLog.updatedAt = Date.now();
        await sessionLog.save();
        res.status(200).json({ sessionLog });
      } else {
        const type = story?.story_type?.toLowerCase() === "moment" ? "Moment" : "Story";
        const newSessionLog = await SessionLogs.create({
          userId,
          sessionId,
          type,
          storyId,
          chapterId,
          sceneId,
          sceneNumber
        });
        res.status(200).json({ newSessionLog });
      }
    } else {
      const type = story?.story_type?.toLowerCase() === "moment" ? "Moment" : "Story";
      const newSessionLog = await SessionLogs.create({
        userId,
        sessionId,
        type,
        storyId,
        chapterId,
        sceneId,
        sceneNumber
      });
      res.status(200).json({ newSessionLog });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createUserSession,
  updateSessionLog
};
