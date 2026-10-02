const mongoose = require('mongoose');

// Define the schema for Background Image URLs
const backgroundImageSchema = new mongoose.Schema({
    background: { type: String, required: false }, // URL of the background image
    background_portrait: { type: String, required: false }, // URL of the portrait version of the background image
    description: { type: String, required: false }, // Optional description for the image
    isDeleted: { type: Boolean, default: false }, // Soft delete flag
    background_url_type: { type: String, required: false, default: "image" }, // Type of the background image

}, { timestamps: true }); // Enable automatic timestamps

const BackgroundImage = mongoose.model('BackgroundImage', backgroundImageSchema);
module.exports = BackgroundImage;
