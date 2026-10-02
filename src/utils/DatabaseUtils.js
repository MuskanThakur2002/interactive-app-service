const mongoose = require('mongoose');
const log = require('./logger');
require('dotenv').config({});


class Database {
    constructor() {
        this.connection = null;
        this.dbName = process.env.ENV === 'development' || process.env.ENV === 'local' 
            ? process.env.TEST_MONGO_DB_NAME 
            : process.env.PROD_MONGO_DB_NAME;
        this.connectionUrl = process.env.MONGO_URI + this.dbName;
        
        // Bind methods to preserve context
        this.handleExit = this.handleExit.bind(this);
    }

    async connect() {
        try {
            if (this.connection) {
                log.info('Using existing database connection');
                return this.connection;
            }

            log.info(`Connection URL: ${this.connectionUrl}`);
            
            this.connection = await mongoose.connect(this.connectionUrl);
            log.info('MongoDB connected successfully');

            // Add cleanup listeners only once
            process.once('SIGINT', this.handleExit);
            process.once('SIGTERM', this.handleExit);

            mongoose.connection.on('error', this.handleError.bind(this));
            mongoose.connection.on('disconnected', this.handleDisconnect.bind(this));

            return this.connection;
        } catch (error) {
            log.error('Error connecting to MongoDB:', error);
            throw error;
        }
    }

    handleError(error) {
        log.error('MongoDB connection error:', error);
    }

    handleDisconnect() {
        log.info('MongoDB disconnected');
    }

    async handleExit() {
        try {
            await this.disconnect();
            log.info('MongoDB connection closed through app termination');
            process.exit(0);
        } catch (error) {
            log.error('Error during database shutdown:', error);
            process.exit(1);
        }
    }

    async disconnect() {
        if (this.connection) {
            // Remove all listeners
            process.removeListener('SIGINT', this.handleExit);
            process.removeListener('SIGTERM', this.handleExit);
            
            await mongoose.disconnect();
            this.connection = null;
            log.info('MongoDB disconnected successfully');
        }
    }
}

// Export singleton instance
const database = new Database();

// Connect immediately and export the mongoose instance
database.connect().catch(err => {
    log.error('Initial database connection failed:', err);
    process.exit(1);
});

module.exports = {
    database,
    mongoose: mongoose
};
