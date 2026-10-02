const User = require("../models/User");
const UserMobileSetting = require("../models/UserMobileSetting");
const { OAuth2Client } = require("google-auth-library"); // Google library
const jwt = require("jsonwebtoken");
const log = require("../utils/logger");
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const axios = require("axios");
const {
  APPLE_AUTH_PROVIDER,
  GOOGLE_AUTH_PROVIDER,
  ANONYMOUS_AUTH_PROVIDER,
  TEMP_NAME_ADJECTIVES
} = require("../utils/LoginConstants");
const logger = require("../utils/logger");
const Feedback = require("../models/Feedback");
const AppVersion = require("../models/appVersion");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const UserProgressV2 = require("../models/UserProgressV2");
const { unlockScenes, activateShareAndUnlock } = require("../services/SceneUnlockService");
const { sendNotificationToUser } = require("../services/FirebaseService");

// Helper function to generate and store referral link for user
const generateAndStoreReferralLink = async (user) => {
  try {
    if (!user.referralUrl) {
      // it is required for existing users
      const baseUrl = process.env.APP_BASE_URL || "https://app.troak.club";
      const referralLink = `${baseUrl}?referrer=${user._id}`;
      user.referralUrl = referralLink;
      await user.save();
      logger.info(
        `Generated referral link for user ${user._id}: ${referralLink}`
      );
    }
    return user.referralUrl;
  } catch (error) {
    logger.error(
      `Error generating referral link for user ${user._id}: ${error.message}`
    );
    return null;
  }
};

const privateKey =
  "-----BEGIN PRIVATE KEY-----" +
  "\n" +
  process.env.APPLE_PRIVATE_KEY +
  "\n" +
  "-----END PRIVATE KEY-----";

// AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Multer configuration for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  }
});

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, authProvider: user.authProvider },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h" // Token expiration time
    }
  );
};

/*
Note:
1. Replace YOUR_CSRF_TOKEN with a valid CSRF token obtained from /api/csrf-token endpoint
2. Replace YOUR_GOOGLE_ID_TOKEN with the actual Google ID token
3. The port (3000) should match your PORT environment variable
*/
const loginWithGoogle = async (req, res) => {
  log.info("Google login started");
  const token = req.body.token; // Access the token directly

  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  const { email, name } = ticket.getPayload();

  let user = await User.findOne({ email, isDeleted: false });
  if (user) {
    log.info(`User found: ${email}, updating authProvider to 'google'`); // Log user found
    user.authProvider = "google";
  } else {
    log.info(`Creating new user: ${email}`); // Log new user creation
    user = new User({ email, name, authProvider: "google" });
  }
  await user.save();

  const authToken = generateToken(user); // Generate token

  // Generate and store referral link if not exists
  await generateAndStoreReferralLink(user);

  // Set the token in a secure cookie
  res.cookie("authToken", authToken, {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.ENV === "development",
    sameSite: "Strict",
    maxAge: 3600000
  });

  log.info("User logged in with Google:", user); // Log successful login
  res.status(200).json({ message: "User logged in with Google", user });
};

const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params; // Get user ID from the request object populated by authMiddleware
    log.info(`Fetching details for user ID: ${userId}`); // Log user ID
    const user = await User.findOne({ _id: userId, isDeleted: false }).select(
      "-__v"
    );

    if (!user) {
      log.warn(`User not found or deleted. For user ID: ${userId}`); // Log user not found
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ user });
  } catch (error) {
    log.error(`Error fetching user details: ${error.message}`); // Log error
    res.status(500).json({ message: "Server error." });
  }
};

const generateTempName = () => {
  const randomAdjective =
    TEMP_NAME_ADJECTIVES[
      Math.floor(Math.random() * TEMP_NAME_ADJECTIVES.length)
    ];
  const randomNum = Math.floor(10000 + Math.random() * 90000); // 5-digit number
  return `${randomAdjective}${randomNum}`; // e.g., "HappyFriend1234"
};

// Assuming you're receiving the state parameter from Apple's callback
const parseAppleState = (stateParam) => {
  try {
    // First decode the URI component
    const decodedState = decodeURIComponent(stateParam);
    log.debug(`Decoded state: ${decodedState}`);

    // Check if the decoded state is a valid JSON string
    if (decodedState.startsWith("{") && decodedState.endsWith("}")) {
      const stateData = JSON.parse(decodedState);
      log.info(`State data parsed successfully`);
      return {
        deviceId: stateData.deviceId,
        stateName: stateData.stateName
      };
    } else {
      // If not JSON, assume it's a plain string
      log.info(`State data is a plain string`);
      return {
        deviceId: null,
        stateName: decodedState
      };
    }
  } catch (error) {
    log.error("Error parsing state parameter:", error);
    return null;
  }
};

const parseAppleStateV2 = (stateParam) => {
  try {
    if (!stateParam) return null;

    // 1) URI decode once (typical for Apple)
    const decodedState = decodeURIComponent(stateParam);
    log.debug(`Decoded state: ${decodedState}`);

    // 2) If it's JSON, parse and extract known fields
    if (decodedState.startsWith("{") && decodedState.endsWith("}")) {
      const stateData = JSON.parse(decodedState);
      log.info(`State data parsed successfully`);

      return {
        deviceId: stateData.deviceId ?? null,
        stateName: stateData.stateName ?? null,
        // New optional parameters (added by our frontend)
        sid: stateData.sid ?? stateData.storyId ?? null,
        cid: stateData.cid ?? stateData.chapterId ?? null,
        source: stateData.source ?? null
      };
    }

    // 3) Fallback: treat as plain string (legacy)
    log.info(`State data is a plain string`);
    return {
      deviceId: null,
      stateName: decodedState,
      sid: null,
      cid: null,
      source: null
    };
  } catch (error) {
    log.error("Error parsing state parameter:", error);
    return null;
  }
};

const handleAppleCallback = async (req, res) => {
  log.info("Apple Auth callback received");

  // Determine frontend URL based on environment
  const frontendBaseUrl =
    process.env.ENV === "production"
      ? process.env.PROD_FRONTEND_URL
      : process.env.ENV === "development"
      ? process.env.TEST_FRONTEND_URL
      : process.env.LOCAL_FRONTEND_URL;

  try {
    log.info("Apple callback started");
    log.debug(`Received Apple code: ${JSON.stringify(req.body)}`);
    const { code, state } = req.body; // Extract deviceId from request body
    log.debug(`Received Apple code: ${code}`);
    log.debug(`Received Apple state: ${state}`);

    const parsedState = parseAppleStateV2(state);
    if (!parsedState) {
      log.warn("Invalid state parameter received");
      return res.status(400).json({ message: "Invalid state parameter" });
    }
    const { deviceId, stateName, sid, cid, source } = parsedState;
    let isFirstTimeLogin = false;

    log.debug(
      `Parsed state data: deviceId: ${deviceId}, stateName: ${stateName}`
    );
    // Verify state parameter to prevent CSRF attacks
    if (stateName !== process.env.STATE_SECRET) {
      log.warn("Invalid state parameter received");
      return res.status(400).json({ message: "Invalid state parameter" });
    }
    const tokenResponse = await getAuthTokenFromCode(code);

    const { id_token, access_token } = tokenResponse.data;
    const decodedToken = jwt.decode(id_token);
    log.debug(`Decoded Apple token: ${decodedToken}`);

    log.debug(`Decoded token details: 
      Sub: ${decodedToken.sub}, 
      Email: ${decodedToken.email}, 
      Email Verified: ${decodedToken.email_verified}, 
      Is Private Email: ${decodedToken.is_private_email}`);

    // Find or create user
    let user = await User.findOne({
      appleId: decodedToken.sub,
      isDeleted: false
    });
    //Update deviceID to the one received from Apple
    if (user) {
      user.deviceId = deviceId;
      user.authProvider = APPLE_AUTH_PROVIDER;
      // TODO: (Muskan)
      // Revoke the token from DeviceToken collection for the anonymouse user
      // Replace or create the deviceToken of the registerer userId with the deviceToken of the anonymous user
      // Delete anonymouse user as we mapped it to existing user with appleId (optional)

    } else {
      // First try to find by deviceId and authProvider as anonymous
      user = await User.findOne({
        deviceId,
        authProvider: ANONYMOUS_AUTH_PROVIDER,
        isDeleted: false
      });

      if (!user) {
        // If no user exists at all, create new one
        user = new User({
          deviceId,
          email: decodedToken.email,
          appleId: decodedToken.sub,
          authProvider: APPLE_AUTH_PROVIDER,
          name: generateTempName(),
          diamonds: 10,
          isTemporaryName: true
        });
      } else {
        log.info(
          `Updating existing user with Apple ID: ${user._id} and add 10 diamonds as login reward`
        );
        const deletedUser = await isDeletedUserPresent(decodedToken.email);
        if (!deletedUser) {
          log.info(
            `There was no deleted user found for email: ${decodedToken.email}`
          );
          log.info("This is a first time login");
          isFirstTimeLogin = true;
        }
        user.appleId = decodedToken.sub;
        user.email = decodedToken.email;
        user.name = generateTempName();
        if (sid && cid && source === "unlock_episodes_login") {
          user.diamonds += 0; // Add 0 diamonds for Apple login (As we are unlocking multiple scenes)
        } else {
          user.diamonds += 10; // Add 10 diamonds for Apple login
        }
        user.isTemporaryName = true;
        user.authProvider = APPLE_AUTH_PROVIDER;
      }
    }

    await user.save();
    log.info(
      `User updated/created with Apple ID: ${user._id} and temporary name: ${user.name}`
    );

    // Generate application JWT token
    const authToken = generateToken(user);

    // Generate and store referral link if not exists
    await generateAndStoreReferralLink(user);

    // Set the token in a secure cookie
    res.cookie("authToken", authToken, {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production" ||
        process.env.ENV === "development",
      sameSite: "Strict",
      maxAge: 3600000
    });
    // Special flow: unlock multiple scenes on login when requested via state
    if (sid && cid && source === "unlock_episodes_login") {
      try {
        await unlockScenes({
          userId: user._id.toString(),
          storyId: sid,
          chapterId: cid,
          unlockType: "LOGIN_BASED",
          unlockMultiple: true,
          sceneId: null
        });
        log.info(
          `Performed unlock4_login for user ${user._id} story ${sid} chapter ${cid}`
        );
        const redirectUrl = new URL("/scene-preview-v2", frontendBaseUrl);
        redirectUrl.searchParams.append("userId", user._id.toString());
        redirectUrl.searchParams.append("storyId", sid);
        redirectUrl.searchParams.append("chapterId", cid);
        redirectUrl.searchParams.append("autoUnlock", "false");
        redirectUrl.searchParams.append("utm_source", "backend_api");
        redirectUrl.searchParams.append("utm_medium", "deeplink");
        redirectUrl.searchParams.append("utm_campaign", "backend_api_campaign_login_free_scenes");
        return res.redirect(redirectUrl.toString());
      } catch (unlockError) {
        log.error(
          `unlock4_login failed for user ${user._id} story ${sid} chapter ${cid}: ${unlockError.message}`
        );
        const redirectUrl = new URL("/scene-preview-v2", frontendBaseUrl);
        redirectUrl.searchParams.append("userId", user._id.toString());
        redirectUrl.searchParams.append("storyId", sid);
        redirectUrl.searchParams.append("chapterId", cid);
        redirectUrl.searchParams.append("autoUnlock", "true");
        redirectUrl.searchParams.append("utm_source", "backend_api");
        redirectUrl.searchParams.append("utm_medium", "deeplink");
        redirectUrl.searchParams.append("utm_campaign", "backend_api_campaign_login_free_scenes");
        redirectUrl.searchParams.append("error", "true");
        return res.redirect(redirectUrl.toString());
      }
      // https://app.troak.club/scene-preview-v2?storyId=689ee853d994c9fa8f047804&chapterId=689ee8fb1d2be295403ab1db&autoUnlock=true&utm_source=meta_ad&utm_medium=deeplink&utm_campaign=meta_campaign_2_free_scenes
    }else{
        // Redirect to frontend with just success indicator
        const redirectUrl = new URL("/home", frontendBaseUrl);
        log.info(
          `Redirecting to frontend with userId: ${user._id.toString()}, success: true, isFirstTimeLogin: ${isFirstTimeLogin}`
        );
        redirectUrl.searchParams.append("userId", user._id.toString());
        redirectUrl.searchParams.append("success", "true");
        redirectUrl.searchParams.append("isFirstTimeLogin", `${isFirstTimeLogin}`);
        return res.redirect(redirectUrl.toString());
    }

    
  } catch (error) {
    log.error(`Error in Apple callback: ${error}`);
    const errorRedirectUrl = new URL("/auth/error", frontendBaseUrl);
    return res.redirect(errorRedirectUrl.toString());
  }
};

const isDeletedUserPresent = async (email) => {
  const user = await User.findOne({ email, isDeleted: true });
  return user;
};

const getAuthTokenFromCode = async (code) => {
  try {
    const redirectUri =
      process.env.ENV === "production"
        ? process.env.PROD_APPLE_AUTH_REDIRECT_URI
        : process.env.ENV === "development"
        ? process.env.TEST_APPLE_AUTH_REDIRECT_URI
        : `${process.env.LOCAL_BACKEND_NGROK_URL}${process.env.LOCAL_APPLE_AUTH_REDIRECT_PATH}`;

    // Log the redirect URI for debugging
    log.debug(`Using redirect URI: ${redirectUri}`);

    log.debug(`Apple Auth Request Details:
            redirectUri: ${redirectUri},
            clientId: ${process.env.APPLE_SERVICES_CLIENT_ID}`);

    log.info(`Get Auth Token From Code`);

    const requestBody = {
      client_id: process.env.APPLE_SERVICES_CLIENT_ID,
      client_secret: generateClientSecret(),
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    };

    try {
      const tokenResponse = await axios.post(
        "https://appleid.apple.com/auth/token",
        new URLSearchParams(requestBody).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          }
        }
      );
      log.debug(`Apple Auth Response: ${tokenResponse.data}`);
      log.info(`Received Auth Token From Code`);
      return tokenResponse;
    } catch (axiosError) {
      log.error(`Apple Auth Response Error:
                status: ${axiosError.response?.status},
                data: ${JSON.stringify(axiosError.response?.data, null, 2)},
                requestBody: ${JSON.stringify(requestBody, null, 2)}`);
      throw axiosError;
    }
  } catch (error) {
    log.error(`Error in getAuthTokenFromCode:
            message: ${error.message},
            stack: ${error.stack}`);
    throw error;
  }
};

const generateClientSecret = () => {
  const header = {
    alg: "ES256",
    kid: process.env.APPLE_KEY_ID.trim()
  };
  const payload = {
    iss: process.env.APPLE_TEAM_ID.trim(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 600, // 10 minutes
    aud: "https://appleid.apple.com",
    sub: process.env.APPLE_SERVICES_CLIENT_ID.trim()
  };

  return jwt.sign(payload, privateKey, {
    algorithm: "ES256",
    header: header
  });
};

//to do send  Referral link from frontend
const createAnonymousUser = async (req, res) => {
  const { deviceId, userId, shareToken } = req.body;
  log.info(
    `Anonymous login request received with deviceId: ${deviceId} and userId: ${userId}`
  );

  try {
    // If user exists in session, return that user
    if (userId && userId !== "null" && userId !== "undefined") {
      log.info(`User already exists with userId: ${userId}`);
      try {
        // TODO: (Muskan)
        // Pass deviceId to the user to get the user details
        //  - as we will consider logged in user only if both deviceId and userId are matching
        const user = await User.findOne({ _id: userId, isDeleted: false });
        if (!user.hasLoggedInBefore) {
          user.hasLoggedInBefore = true;
          await user.save();
        }
        if (user.isNewUser) {
          user.isNewUser = false;
          await user.save();
        }
        if (user) {
          const userMobileSetting = await UserMobileSetting.findOne({ userId });
          logger.info(
            `User already exists with userId: ${userId}, returning user details`
          );

          // Generate and store referral link if not exists
          await generateAndStoreReferralLink(user);

          const authToken = generateToken(user);
          res.cookie("authToken", authToken, {
            httpOnly: true,
            secure:
              process.env.NODE_ENV === "production" ||
              process.env.ENV === "development",
            sameSite: "Strict",
            maxAge: 3600000
          });
          logger.debug(`User details: ${user}`);
          return res.status(200).json({
            user: user,
            authToken: req.cookies.authToken,
            userMobileSetting: userMobileSetting
          });
        }
      } catch (error) {
        log.error(`Error finding user with ID ${userId}: ${error}`);
        // Continue with anonymous user creation if user lookup fails
      }
    }

    // Check for deviceId
    if (!deviceId) {
      log.error("Device ID is required");
      return res.status(400).json({ error: "Device ID is required" });
    }

    // Find or create user by deviceId
    let user = await User.findOne({
      deviceId,
      isDeleted: false,
      authProvider: "anonymous"
    });
    if (!user) {
      log.info(`Creating new anonymous user with deviceId: ${deviceId}`);
      // Check any user exists with deviceId, deleted or non deleted
      const existingUser = await User.findOne({ deviceId });
      let diamonds = 0;
      if (existingUser) {
        log.info(
          `User with deviceId: ${deviceId} already exists and hence we can not give free diamonds to anonymous user`
        );
        diamonds = 0;
      }
      user = new User({
        deviceId,
        name: "Anonymous",
        authProvider: "anonymous",
        diamonds: diamonds,
        isNewUser: true
      });
      await user.save();
    }

    // Generate and store referral link for the user
    await generateAndStoreReferralLink(user);

    // Check for share token and activate share-and-unlock if present
    if (shareToken) {
      try {
        const activationResult = await activateShareAndUnlock({
          shareToken,
          friendUserId: user._id
        });

        if (activationResult.success) {
          log.info(`Share-and-unlock activated for user ${activationResult.originalUserId} by friend ${user._id}: ${activationResult.unlockedScenes} scenes unlocked`);
          
          // Send notification to original user about successful unlock
          try {
            const { storyId, chapterId } = activationResult.sceneUnlock;
            const frontendBaseUrl = process.env.FRONTEND_BASE_URL || 'https://app.troak.com';
            const deepLink = new URL('/scene-preview-v2', frontendBaseUrl);
            deepLink.searchParams.append('storyId', storyId);
            deepLink.searchParams.append('chapterId', chapterId);
            deepLink.searchParams.append('utm_source', 'share_and_unlock_success');
            deepLink.searchParams.append('utm_medium', 'notification');
            deepLink.searchParams.append('utm_campaign', 'friend_unlock');

            const notificationData = {
              title: "Your friend joined! Your scenes are now unlocked 🎉",
              body: `Your friend opened the app and unlocked ${activationResult.unlockedScenes} scenes. Continue your story now!`,
              data: {
                deepLink: deepLink.toString(),
                type: 'share_and_unlock_success'
              }
            };

            const notificationResult = await sendNotificationToUser(activationResult.originalUserId, notificationData);
            
            if (notificationResult.success) {
              log.info(`Share-and-unlock notification sent to user ${activationResult.originalUserId}: ${notificationResult.successCount} devices`);
            } else {
              log.warn(`Failed to send share-and-unlock notification to user ${activationResult.originalUserId}: ${notificationResult.reason}`);
            }
          } catch (notificationError) {
            log.error(`Error sending share-and-unlock notification: ${notificationError.message}`);
            // Don't fail the share activation if notification fails
          }
        }
      } catch (error) {
        log.error(`Failed to activate share-and-unlock: ${error.message}`);
        // Don't fail the anonymous login if share activation fails
      }
    }

    // Get mobile settings
    const userMobileSetting = await UserMobileSetting.findOne({
      userId: user._id
    });
    const authToken = generateToken(user);

    // Set cookie and return response
    res.cookie("authToken", authToken, {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production" ||
        process.env.ENV === "development",
      sameSite: "Strict",
      maxAge: 3600000
    });
    logger.info(
      `Anonymous user created successfully or retrieved existing anonymous user for deviceId: ${deviceId}`
    );
    return res.status(200).json({ user, authToken, userMobileSetting });
  } catch (error) {
    log.error(`Error creating anonymous user: ${error}`);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const logout = async (req, res) => {
  res.clearCookie("authToken");
  res.status(200).json({ message: "Logged out successfully" });
};

// Check if any user exists with given deviceId who has an email and has logged in before
const checkDeviceHasEmailLogin = async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ success: false, message: "deviceId is required" });
    }

    const user = await User.findOne({
      deviceId,
      isDeleted: false,
      hasLoggedInBefore: true,
      email: { $exists: true, $ne: null, $ne: "" }
    }).select("_id");

    return res.status(200).json({ success: !!user });
  } catch (error) {
    log.error(`Error checking device login state: ${error}`);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// const createNewAnonymousUser = async (req, res) => {
//   try {
//     const { deviceId } = req.body;
//     log.info(`Creating new anonymous user with deviceId: ${deviceId}`);
//     if (!deviceId) {
//       log.error("Device ID is required");
//       return res.status(400).json({ error: "Device ID is required" });
//     }

//     let user = await User.findOne({
//       deviceId,
//       isDeleted: false,
//       authProvider: { $eq: "anonymous" }
//     }).sort({ updatedAt: -1 });

//     if (!user) {
//       user = new User({
//         deviceId,
//         name: "Anonymous",
//         authProvider: "anonymous",
//         diamonds: 100
//       });
//       await user.save();
//     }
//     log.info(`Generated auth token for user: ${user._id}`);

//     res.status(200).json({ user });
//   } catch (error) {
//     log.error(`Error creating new anonymous user: ${error}`);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

const subtractDiamonds = async (req, res) => {
  const { userId, diamonds } = req.body;

  try {
    const user = await User.findOne({ _id: userId, isDeleted: false });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.diamonds < diamonds) {
      return res.status(400).json({ message: "Not enough diamonds" });
    }

    user.diamonds -= diamonds;
    await user.save();

    res
      .status(200)
      .json({ message: "Diamonds subtracted successfully", user: user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

const updateMobileSetting = async (req, res) => {
  const { userId, audio, notification, darkMode } = req.body;
  try {
    // First check if user exists and is not deleted
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update the mobile settings
    const updatedSetting = await UserMobileSetting.findOneAndUpdate(
      { userId },
      { audio, notification, darkMode },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      message: "Mobile settings updated successfully",
      updatedSetting
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const addDiamonds = async (req, res) => {
  const { userId, diamonds } = req.body;

  if (!userId || !diamonds) {
    return res
      .status(400)
      .json({ error: "User ID and diamonds to add are required." });
  }

  try {
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.diamonds += diamonds;
    await user.save();

    res.status(200).json({
      message: "Diamonds added successfully.",
      diamonds: user.diamonds
    });
  } catch (error) {
    res.status(500).json({ error: "An error occurred while adding diamonds." });
  }
};

const updateUserName = async (req, res) => {
  try {
    const { userId, newName } = req.body;

    if (!userId || !newName) {
      return res.status(400).json({
        success: false,
        message: "User ID and new name are required"
      });
    }

    const user = await User.findOne({ _id: userId, isDeleted: false });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    user.name = newName;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "User name updated successfully",
      data: user
    });
  } catch (error) {
    console.error("Error updating user name:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    log.error(`Error soft deleting user: ${error}`);
    res.status(500).json({ message: "Error deleting user" });
  }
};

const submitFeedback = async (req, res) => {
  try {
    const {
      userId,
      feedback,
      cancelCount,
      scene2to4,
      scene5plus,
      after5Days,
      lastPopupTime
    } = req.body;
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingFeedback = await Feedback.findOne({ userId });
    if (!existingFeedback) {
      const userFeedback = new Feedback({
        userId,
        feedback: feedback ? [feedback] : [],
        cancelCount: cancelCount || 0,
        scene2to4: scene2to4 || false,
        scene5plus: scene5plus || false,
        after5Days: after5Days || false,
        lastPopupTime: lastPopupTime || null
      });
      await userFeedback.save();
      return res
        .status(200)
        .json({ message: "Feedback submitted successfully" });
    }

    // Ensure feedback array exists
    if (!existingFeedback.feedback) {
      existingFeedback.feedback = [];
    }

    if (feedback) {
      existingFeedback.feedback.push(feedback);
    }
    if (cancelCount) {
      existingFeedback.cancelCount = cancelCount;
    }
    if (scene2to4) {
      existingFeedback.scene2to4 = scene2to4;
    }
    if (scene5plus) {
      existingFeedback.scene5plus = scene5plus;
    }
    if (after5Days) {
      existingFeedback.after5Days = after5Days;
    }
    if (lastPopupTime) {
      existingFeedback.lastPopupTime = lastPopupTime;
    }

    await existingFeedback.save();
    // Send response after updating existing feedback
    return res.status(200).json({ message: "Feedback submitted successfully" });
  } catch (error) {
    log.error(`Error submitting feedback: ${error}`);
    res.status(500).json({ message: "Error submitting feedback" });
  }
};

const getFeedback = async (req, res) => {
  try {
    const { userId } = req.params;
    logger.debug("User:", req.user);
    logger.info("Fetching feedback for User ID:", userId);
    const feedback = await Feedback.find({ userId });
    res.status(200).json({ feedback });
  } catch (error) {
    log.error(`Error getting feedback: ${error}`);
    res.status(500).json({ message: "Error getting feedback" });
  }
};

const getAppVersion = async (req, res) => {
  try {
    const data = await AppVersion.findOne();
    res.status(200).json({ data });
  } catch (error) {
    log.error(`Error getting app version: ${error}`);
    res.status(500).json({ message: "Error getting app version" });
  }
};

const updateWelcomeTextShown = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.welcomeTextShown = true;
    await user.save();

    return res.status(200).json({ message: "Welcome text shown" });
  } catch (error) {
    log.error(`Error updating welcome text shown: ${error}`);
    res.status(500).json({ message: "Error updating welcome text shown" });
  }
};

const fixedProgress = async (req, res) => {
  try {
    const stories = await UserProgressV2.find();
    let updatedCount = 0;

    for (let story of stories) {
      let needsUpdate = false;

      // Handle protagonistIds if it's an array
      if (Array.isArray(story.protagonistIds)) {
        // Take the first protagonist if array exists
        story.protagonist = story.protagonistIds[0] || null;
        needsUpdate = true;
      }

      // Handle loveInterestIds if it's an array
      if (Array.isArray(story.loveInterestIds)) {
        // Take the first love interest if array exists
        story.loveInterest = story.loveInterestIds[0]?.characterId || null;
        needsUpdate = true;
      }

      // Save only if changes were made
      if (needsUpdate) {
        await story.save();
        updatedCount++;
      }
    }

    res.status(200).json({
      message: `Successfully updated ${updatedCount} stories`,
      totalStories: stories.length,
      updatedStories: updatedCount
    });
  } catch (error) {
    log.error(`Error fixed progress: ${error}`);
    res
      .status(500)
      .json({ message: "Error fixing progress", error: error.message });
  }
};

/**
 * Upload Profile Image API
 *
 * Endpoint: POST /upload-profile-image
 * Content-Type: multipart/form-data
 *
 * Headers:
 * - Authorization: Bearer token (handled by authMiddleware)
 * - Cookie: authToken (for authentication)
 *
 * Form Data:
 * - profileImage: Image file (jpg, jpeg, png, gif)
 *
 * Restrictions:
 * - File size: Maximum 5MB
 * - File types: Only image files allowed
 *
 * Response:
 * Success (200):
 * {
 *   "success": true,
 *   "message": "Profile image uploaded successfully",
 *   "data": {
 *     "user": {...user object...},
 *
 *     "profileImageUrl": "https://cdn.example.com/profile-images/userId-timestamp.jpg"
 *   }
 * }
 *
 * Error responses:
 * - 400: No image file provided
 * - 401: Authentication required
 * - 404: User not found
 * - 500: Server error or S3 upload failure
 */
const uploadProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided"
      });
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Generate unique filename
    const fileExtension = req.file.originalname.split(".").pop();
    const fileName = `${userId}-${Date.now()}.${fileExtension}`;
    const s3Key = `profile-images/${fileName}`;

    // Upload to S3
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    };

    try {
      const command = new PutObjectCommand(uploadParams);
      await s3Client.send(command);

      // Construct the CloudFront CDN URL
      const imageUrl = `${process.env.AWS_CDN_URL}/${s3Key}`;

      // Update user's profile image
      console.log("imageUrl", imageUrl);
      user.profileImage = imageUrl;
      await user.save();

      log.info(`Profile image uploaded successfully for user: ${userId}`);

      return res.status(200).json({
        success: true,
        message: "Profile image uploaded successfully",
        data: {
          user: user,
          profileImageUrl: imageUrl
        }
      });
    } catch (s3Error) {
      log.error(`S3 upload error: ${s3Error.message}`);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image to S3",
        error: s3Error.message
      });
    }
  } catch (error) {
    log.error(`Error uploading profile image: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Export the functions
module.exports = {
  loginWithGoogle,
  getUserDetails,
  handleAppleCallback,
  createAnonymousUser,
  subtractDiamonds,
  updateMobileSetting,
  addDiamonds,
  updateUserName,
  deleteUser,
  logout,
  submitFeedback,
  getFeedback,
  getAppVersion,
  updateWelcomeTextShown,
  fixedProgress,
  uploadProfileImage,
  upload, // Export multer middleware
  generateAndStoreReferralLink, // Export helper function
  checkDeviceHasEmailLogin
};
