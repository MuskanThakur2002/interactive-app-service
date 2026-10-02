const winston = require('winston');
const path = require('path');
require('winston-daily-rotate-file');

// Define logs directory
const logDirectory = path.join(process.cwd(), 'logs');

// Ensure logs directory exists
const fs = require('fs');
if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

// Function to mask sensitive information
const maskSensitiveData = (message) => {
    return message?.replace(/mongodb\+srv:\/\/([^:@]+):([^@]+)@([^/]+)/g, 'mongodb+srv://***:***@$3');
};

// Custom log format with masking
const customLogFormat = winston.format.printf(({ timestamp, level, message }) => {
    return `{[${timestamp}]: "level":"${level}", "message":"${maskSensitiveData(message)}"}`;
});

// Configure rolling log transport
const dailyRotateFileTransport = new winston.transports.DailyRotateFile({
    filename: `${logDirectory}/interactive-app-service-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '10M',
    maxFiles: '7d',
});

// Create logger instance
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customLogFormat
    ),
    transports: [
        dailyRotateFileTransport,
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                customLogFormat
            ),
        }),
    ],
});

// Export the logger
module.exports = logger;