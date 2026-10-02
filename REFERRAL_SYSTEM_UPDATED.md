# Updated Referral System

## Overview
The referral system has been updated to use direct links with user IDs stored in the User table, instead of generating them repeatedly. All daily referral limits have been removed.

## Key Changes

### 1. Stored Referral Links
- **Previous**: Generated referral links on every request using Bitly
- **Current**: Direct links stored in `User.referralUrl` field
- **Format**: `https://app.troak.club?referrer=USER_ID`
- **Generation**: Created once during login/registration and stored permanently

### 2. Removed Daily Limits
- Users can now share their referral links unlimited times
- No more 3-referral-per-day limit
- All users can earn rewards from any number of successful referrals

### 3. Optimized Performance
- No more repeated link generation
- Direct database retrieval of stored links
- Automatic link generation for existing users without links

### 4. Simplified Code Structure
- Removed `BitlyService` dependency 
- Simplified `ReferralService` logic with `getUserReferralLink()` method
- Updated all controllers to use stored links

## Database Schema

### User Model Addition
```javascript
{
  referralUrl: {
    type: String,
    required: false
  }
}
```

The `referralUrl` field stores the user's permanent referral link in format: `https://app.troak.club?referrer=USER_ID`

## API Endpoints

### Get User's Referral Link
```
POST /share/init
Body: { "userId": "USER_ID" }
Response: {
  "success": true,
  "data": {
    "directLink": "https://app.troak.club?referrer=USER_ID",
    "referrerId": "USER_ID", 
    "linkType": "direct"
  }
}
```

### Open Referral Link
```
POST /share/open
Body: { "referrerId": "USER_ID" }
```

### Claim Friend Reward (10 diamonds)
```
POST /share/claim/friend
Body: { "userId": "FRIEND_USER_ID", "referralId": "REFERRAL_ID" }
```

### Claim Referrer Reward (5 diamonds)
```
POST /share/claim/referrer  
Body: { "userId": "REFERRER_USER_ID", "referralId": "REFERRAL_ID" }
```

### Get Available Rewards
```
GET /share/rewards/available?userId=USER_ID
```

## Link Generation Logic

### New Users
- Referral link automatically generated and stored during:
  - Google login (`loginWithGoogle`)
  - Apple login (`handleAppleCallback`) 
  - Anonymous user creation (`createAnonymousUser`)

### Existing Users
- Links generated on-demand when accessed via `/share/init`
- Automatic fallback generation in `ReferralService.getUserReferralLink()`

## Performance Benefits

1. **No Repeated Generation**: Links created once and reused
2. **Faster Response**: Direct database lookup instead of API calls
3. **No External Dependencies**: No Bitly API calls
4. **Consistent URLs**: Same link for user across sessions

## Migration Handling

- Existing users without `referralUrl` field get links generated automatically
- No data migration required - links created on-demand
- Backward compatibility maintained for all existing functionality

## Frontend Integration

1. **Get referral link**: Call `/share/init` with user ID (returns stored link)
2. **Handle incoming links**: Parse `referrer` parameter from URL
3. **Process referral**: Call `/share/open` with referrer ID
4. **Claim rewards**: Call appropriate claim endpoints when user wants to collect diamonds

## Code Changes Summary

- ✅ Added `generateAndStoreReferralLink()` helper function
- ✅ Updated all login functions to generate/store links
- ✅ Modified `ReferralService.getUserReferralLink()` to retrieve stored links
- ✅ Updated `/share/init` and `/share/deep-links` endpoints
- ✅ Removed all Bitly dependencies
- ✅ Eliminated daily limit logic 