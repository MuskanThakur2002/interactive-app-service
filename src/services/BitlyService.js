// DEPRECATED: BitlyService is no longer used - we now use direct links with user IDs
// Format: https://app.troak.club?referrer=USER_ID

/*
const fetch = require('node-fetch');
const logger = require('../utils/logger');

class BitlyService {
    constructor() {
        this.baseUrl = 'https://api-ssl.bitly.com/v4';
        this.accessToken = process.env.BITLY_ACCESS_TOKEN;
    }

    /**
     * Create a Bitly short link with referral code optimized for deep linking
     * @param {string} referralCode - The referral code to include in the URL
     * @returns {Promise<string>} Short link URL
     */
/*
    async createShortLink(referralCode) {
        try {
            if (!this.accessToken) {
                logger.warn('Bitly access token not configured, using fallback URL');
                const baseUrl = process.env.APP_BASE_URL || 'https://troak.app';
                return `${baseUrl}/referral/${referralCode}`;
            }

            // Use your domain with deep link path for Universal Links
            const baseUrl = process.env.APP_BASE_URL || 'https://troak.app';
            const longUrl = `${baseUrl}/referral/${referralCode}`;

            const response = await fetch(`${this.baseUrl}/shorten`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    long_url: longUrl,
                    title: `Troak Referral - ${referralCode}`,
                    tags: ['troak', 'referral', referralCode, 'deeplink'],
                    deeplinks: [
                        {
                            app_id: process.env.IOS_APP_ID, // Your iOS App Store ID
                            app_uri_path: `/referral/${referralCode}`,
                            install_url: process.env.IOS_APP_STORE_URL,
                            install_type: 'promote_install'
                        },
                        {
                            app_id: process.env.ANDROID_PACKAGE_NAME, // Your Android package name
                            app_uri_path: `/referral/${referralCode}`,
                            install_url: process.env.ANDROID_PLAY_STORE_URL,
                            install_type: 'promote_install'
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.text();
                logger.error(`Bitly API error: ${response.status} - ${errorData}`);
                // Fallback to regular URL if Bitly fails
                return longUrl;
            }

            const data = await response.json();
            logger.info(`Bitly deep link created: ${data.link} for referral ${referralCode}`);
            
            return data.link;

        } catch (error) {
            logger.error(`Error creating Bitly short link: ${error.message}`);
            // Fallback to regular URL if Bitly service fails
            const baseUrl = process.env.APP_BASE_URL || 'https://troak.app';
            return `${baseUrl}/referral/${referralCode}`;
        }
    }

    /**
     * Create a direct custom scheme deep link (alternative method)
     * @param {string} referralCode - The referral code
     * @returns {Promise<string>} Deep link URL
     */
/*
    async createCustomSchemeDeepLink(referralCode) {
        try {
            if (!this.accessToken) {
                // Return custom scheme directly if no Bitly
                return `troak://referral/${referralCode}`;
            }

            // Create Bitly link that redirects to custom scheme
            const customSchemeUrl = `troak://referral/${referralCode}`;

            const response = await fetch(`${this.baseUrl}/shorten`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    long_url: customSchemeUrl,
                    title: `Troak App Link - ${referralCode}`,
                    tags: ['troak', 'referral', referralCode, 'custom-scheme']
                })
            });

            if (!response.ok) {
                logger.error(`Bitly custom scheme API error: ${response.status}`);
                return customSchemeUrl;
            }

            const data = await response.json();
            logger.info(`Bitly custom scheme link created: ${data.link}`);
            
            return data.link;

        } catch (error) {
            logger.error(`Error creating custom scheme deep link: ${error.message}`);
            return `troak://referral/${referralCode}`;
        }
    }

    /**
     * Create a smart deep link that works for both installed and non-installed users
     * @param {string} referralCode - The referral code
     * @returns {Promise<Object>} Multiple link options
     */
/*
    async createSmartDeepLink(referralCode) {
        try {
            const universalLink = await this.createShortLink(referralCode);
            const customSchemeLink = await this.createCustomSchemeDeepLink(referralCode);
            
            return {
                universalLink,      // Opens app if installed, otherwise opens web
                customSchemeLink,   // Opens app directly (if installed)
                fallbackUrl: `${process.env.APP_BASE_URL || 'https://troak.app'}/referral/${referralCode}`
            };

        } catch (error) {
            logger.error(`Error creating smart deep link: ${error.message}`);
            const fallbackUrl = `${process.env.APP_BASE_URL || 'https://troak.app'}/referral/${referralCode}`;
            return {
                universalLink: fallbackUrl,
                customSchemeLink: `troak://referral/${referralCode}`,
                fallbackUrl
            };
        }
    }

    /**
     * Get click statistics for a Bitly link
     * @param {string} bitlyLink - The Bitly short link
     * @returns {Promise<Object>} Click statistics
     */
/*
    async getClickStats(bitlyLink) {
        try {
            if (!this.accessToken) {
                return { total_clicks: 0, message: 'Bitly not configured' };
            }

            // Extract the Bitly ID from the full URL
            const bitlyId = bitlyLink.replace('https://bit.ly/', '');
            
            const response = await fetch(`${this.baseUrl}/bitlinks/${bitlyId}/clicks/summary`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });

            if (!response.ok) {
                logger.error(`Bitly stats API error: ${response.status}`);
                return { total_clicks: 0, message: 'Stats unavailable' };
            }

            const data = await response.json();
            return data;

        } catch (error) {
            logger.error(`Error getting Bitly stats: ${error.message}`);
            return { total_clicks: 0, message: 'Error fetching stats' };
        }
    }

    /**
     * Update Bitly link title with additional info
     * @param {string} bitlyLink - The Bitly short link
     * @param {string} newTitle - New title for the link
     * @returns {Promise<boolean>} Success status
     */
/*
    async updateLinkTitle(bitlyLink, newTitle) {
        try {
            if (!this.accessToken) {
                return false;
            }

            const bitlyId = bitlyLink.replace('https://bit.ly/', '');
            
            const response = await fetch(`${this.baseUrl}/bitlinks/${bitlyId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    title: newTitle
                })
            });

            return response.ok;

        } catch (error) {
            logger.error(`Error updating Bitly link title: ${error.message}`);
            return false;
        }
    }
}

module.exports = new BitlyService(); 
*/

// Direct link service replacement
class DirectLinkService {
    /**
     * Create a direct referral link using user ID
     * @param {string} userId - The user ID to use as referrer
     * @returns {string} Direct link URL
     */
    static createDirectLink(userId) {
        const baseUrl = process.env.APP_BASE_URL || 'https://app.troak.club';
        return `${baseUrl}?referrer=${userId}`;
    }
}

module.exports = DirectLinkService; 