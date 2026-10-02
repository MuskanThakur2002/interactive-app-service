const dotenv = require('dotenv');
// Load environment variables from /etc/secrets/app.env first
dotenv.config();

// Load the .env file from default location (Local Development)
// dotenv.config();
require('newrelic');

const express = require('express');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
var path = require('path');
const cors = require('cors');
const logger = require('./utils/logger');
const { globalLimiter } = require('./utils/rateLimiters');
const { database } = require('./utils/DatabaseUtils'); // Import database connection
const app = express();
const diamondRoutes = require('./routes/diamondRoutes');
const diamondTransactionRoutes = require('./routes/diamondTransactionRoutes');
const paymentTransactionRoutes = require('./routes/paymentTransactionRoutes');
const userRoutes = require('./routes/userRoutes');
const appleIAPRoutes = require('./routes/appleIAPRoutes');
const productsRoutes = require('./routes/productsRoutes');
const storyRoutes = require('./routes/storyRoutes');
const userProgressRoutes = require('./routes/userProgress');
const userSessionRoutes = require('./routes/UserSessions');
const storyReactionRoutes = require('./routes/storyReactionRoutes');
const monetizationRoutes = require('./routes/monetizationRoutes');
const weeklyStreakRoutes = require('./routes/weeklyStreakRoutes');
const storyCompletionRewardRoutes = require('./routes/storyCompletionRewardRoutes');
const shareRoutes = require('./routes/shareRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');
const storyPromotionRoutes = require('./routes/storyPromotionRoutes');
const adLimitsRoutes = require('./routes/adLimitsRoutes');

// Global process-level error handlers for diagnostics
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
});
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : { reason });
});
process.on('warning', (warning) => {
    logger.warn(`Process warning: ${warning.name} - ${warning.message}`);
});

// Validate required environment variables
const requiredEnvVars = [
    'APPLE_CLIENT_ID',
    'APPLE_SERVICES_CLIENT_ID',
    'APPLE_TEAM_ID',
    'APPLE_KEY_ID',
    'JWT_SECRET',
    'MONGO_URI',
    'ENV',
    'PORT',
    'PROD_APPLE_AUTH_REDIRECT_URI',
    'TEST_APPLE_AUTH_REDIRECT_URI',
    'PROD_FRONTEND_URL',
    'TEST_FRONTEND_URL',
    'LOCAL_FRONTEND_URL',
    'STATE_SECRET',
    'TEST_MONGO_DB_NAME',
    'PROD_MONGO_DB_NAME',
    'APPLE_PRIVATE_KEY',
];

requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
    }
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Define allowed origins based on environment
const getAllowedOrigins = () => {
    const env = process.env.ENV || 'local';
    
    switch(env) {
        case 'production':
            return [
                process.env.PROD_FRONTEND_URL,
                process.env.TEST_FRONTEND_URL,
                'https://www.interactivestories.troak.club',
                'https://appleid.apple.com',
                'http://localhost:3000',
                // Add other production URLs
            ];
        case 'development':
            return [
                process.env.TEST_FRONTEND_URL,
                process.env.LOCAL_FRONTEND_URL,
                process.env.PROD_FRONTEND_URL,
                'https://appleid.apple.com',
                'http://localhost:3000',
                // Add other development URLs
            ];
        case 'local':
        default:
            return [
                process.env.LOCAL_FRONTEND_URL,
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                process.env.LOCAL_BACKEND_NGROK_URL,
                'https://appleid.apple.com',
                // Add other local URLs
            ];
    }
};

// CORS configuration - This should be before other middleware
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = getAllowedOrigins();
        logger.debug(`Request origin: ${origin}`);
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
            // Check if origin starts with http://localhost but with a different port
            const isLocalhost = origin && origin.startsWith('http://localhost:');
            if (isLocalhost) {
                logger.debug(`Allowing localhost origin: ${origin}`);
                return callback(null, true);
            }
            
            logger.warn(`Origin ${origin} is not allowed`);
            const msg = `The CORS policy for this site does not allow access from the specified Origin ${origin}.`;
            return callback(new Error(msg), false);
        }
        logger.debug(`Origin ${origin} is allowed`);
        return callback(null, true);
    },
    credentials: true, // Important for cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// CSRF protection middleware
const csrfProtection = csrf({ cookie: true });
// Apply CSRF protection to all routes except the Apple callback
// app.use((req, res, next) => {
//     if (req.path === '/api/users/auth/apple/callback') {
//         return next();
//     }
//     logger.info(`CSRF protection middleware applied to ${req.path}`);
//     if(req.path !== '/') {
//         csrfProtection(req, res, next);
//         logger.info(`CSRF validated for ${req.path}`);
//     }
//     next();
// });

// Apply global rate limiting to all API routes
app.use('/api', globalLimiter);

// Log incoming requests for debugging
app.use((req, res, next) => {
    if(req.path !== '/') {
        logger.debug(`Incoming request: 
            Path: ${req.path}
            Headers: ${JSON.stringify(req.headers)}
            Body: ${JSON.stringify(req.body)}`);
    }
    next();
});

// Route to get CSRF token
/*
To get CSRF token using curl:

curl -X GET http://localhost:3010/api/csrf-token \
-c cookies.txt \
-b cookies.txt

Note:
1. The port (3010) should match your PORT environment variable
2. cookies.txt will store the CSRF token cookie
3. The response will contain the CSRF token to use in subsequent requests
*/

app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/diamonds', diamondRoutes);
app.use('/api/diamond-transactions', diamondTransactionRoutes);
app.use('/api/payment-transactions', paymentTransactionRoutes);
app.use('/api/apple-iap', appleIAPRoutes);
app.use('/api/story', storyRoutes);
app.use('/api/user-progress', userProgressRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/user-sessions', userSessionRoutes);
app.use('/api/story-reactions', storyReactionRoutes);
app.use('/api/monetization', monetizationRoutes);
app.use('/api/weekly-streak', weeklyStreakRoutes);
app.use('/api/story-completion-rewards', storyCompletionRewardRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/story-promotion', storyPromotionRoutes);
app.use('/api/ad_limits', adLimitsRoutes);

// Centralized Express error handler (should be after routes)
app.use((err, req, res, next) => {
    const requestContext = {
        path: req.path,
        method: req.method,
        headers: req.headers,
        query: req.query,
        body: req.body,
    };
    logger.error('Express error middleware caught an error', err, requestContext);
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        error: true,
        message: err.message || 'Internal Server Error',
    });
});

// Start server
const PORT = process.env.PORT || 3010;

// Ensure database is connected before starting the server
database.connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });
