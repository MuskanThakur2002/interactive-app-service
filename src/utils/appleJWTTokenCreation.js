const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const log = require('./logger');

// Load the .env file from /etc/secrets/
dotenv.config();

const generateAppleJWTToken = () => {
    // const privateKey = process.env.APPLE_PRIVATE_KEY; // Your Apple private key
    const teamId = process.env.APPLE_TEAM_ID; // Your Apple team ID
    const keyId = process.env.APPLE_KEY_ID; // Your Apple key ID

    const privateKey = '-----BEGIN PRIVATE KEY-----' + '\n' + 'MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgOGG5417QAsoZ8ZKWw1p93INbJ3pMSHyN9M/mvAjPGKygCgYIKoZIzj0DAQehRANCAAThnsdTz2dmBF+Ix1sw47zm4leSZdyBp2AvkUGRQkC+xz8blXz4B3q6O8g42VbNC4VjJ8FkKtAm8zHUb6kryrod' + '\n' + '-----END PRIVATE KEY-----';
    // const teamId = 'H9N987RY55';
    // const keyId = '943J6BT4DF';
    log.debug(`Private key: ${privateKey}`);
    log.debug(`Team ID: ${teamId}`);
    log.debug(`Key ID: ${keyId}`);
    const token = jwt.sign(
    {
        iss: teamId, // Issuer
        iat: Math.floor(Date.now() / 1000), // Issued at
        exp: Math.floor(Date.now() / 1000) + 60 * 5, // Expiration time (5 minutes)
        aud: process.env.APPLE_CLIENT_ID, // Audience (your app's bundle ID)
        sub: 'dodiyaronak@gmail.com', // Subject (user's email)
        name: 'Dodiya Ronak', // User's name
    },
    privateKey,
    {
        algorithm: 'ES256',
        keyid: keyId,
        }
    );

    // logger.info(`Generated token: ${token}`);

    return token;
}

// const main = () => {
//     logger.info('Generating Apple JWT token...');
//     logger.info(`Generated token: ${generateAppleJWTToken()}`);
// }

// main();

module.exports = { generateAppleJWTToken };