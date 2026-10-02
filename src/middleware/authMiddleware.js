const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

exports.authenticate = (req, res, next) => {
  logger.info(`${req.cookies.authToken},Auth middleware called`);
  const token = req.cookies.authToken;

  logger.debug(`${token},Token:`);
  if (!token) {
    logger.error("No token provided, authorization denied.");
    return res
      .status(401)
      .json({ message: "No token provided, authorization denied." });
  }
  try {
    const DecodedJWT = jwt.decode(token, { complete: true });
    console.log("Decoded JWT:", DecodedJWT);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    logger.info("Token verified successfully");
    req.user = decoded;
    next();
  } catch (error) {
    logger.error(`Token verification failed:, ${error.message}`);
    return res.status(401).json({ message: "Token is not valid." });
  }
};
