# Claim-Based Rewards API Examples

## 🎯 **System Overview**

The share-to-earn system now uses a **claim-based approach** where:
- ✅ Rewards are **marked as available** when friends join
- ✅ Users must **manually claim** their diamonds via API calls  
- ✅ **WebSocket notifications** alert users when rewards are available
- ✅ **Complete control** over when diamonds are actually awarded

## 📱 **Complete User Flow Examples**

### **Scenario 1: Successful Friend Referral**

#### Step 1: User A Creates Referral Link
```bash
curl -X POST http://localhost:3010/api/share/init \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_a_123",
    "linkType": "universal"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shortUrl": "https://bit.ly/abc123",
    "referralCode": "ABCD1234",
    "linkType": "universal",
    "dailyLimit": {
      "count": 0,
      "canRefer": true,
      "remaining": 3
    }
  }
}
```

#### Step 2: Friend Clicks Link & Opens App
```bash
curl -X POST http://localhost:3010/api/share/open \
  -H "Content-Type: application/json" \
  -d '{
    "referralCode": "ABCD1234",
    "userId": "friend_456",
    "deviceId": "device789",
    "platform": "ios"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Referral link opened successfully - rewards available for claiming",
  "data": {
    "referralId": "ref_789xyz",
    "friendReward": {
      "available": true,
      "amount": 10,
      "message": "+10 💎 welcome bonus available to claim!"
    },
    "referrerReward": {
      "available": true,
      "amount": 5,
      "message": "+5 💎 available to claim from referral!"
    }
  }
}
```

**🔔 WebSocket Notifications Sent:**
```javascript
// To Friend (user: friend_456)
{
  type: 'referral_notification',
  data: {
    notificationType: 'reward_available',
    type: 'friend_reward',
    amount: 10,
    message: "+10 💎 welcome bonus available to claim!",
    referralId: "ref_789xyz",
    actionRequired: 'claim'
  }
}

// To Referrer (user: user_a_123)  
{
  type: 'referral_notification',
  data: {
    notificationType: 'reward_available',
    type: 'referrer_reward',
    amount: 5,
    message: "+5 💎 available to claim from referral!",
    referralId: "ref_789xyz",
    friendId: "friend_456",
    actionRequired: 'claim'
  }
}
```

#### Step 3: Friend Claims Their Reward
```bash
curl -X POST http://localhost:3010/api/share/claim/friend \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "friend_456",
    "referralId": "ref_789xyz"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "amount": 10,
    "newBalance": 1010,
    "message": "+10 💎 claimed successfully!"
  }
}
```

**🔔 WebSocket Notification:**
```javascript
// To Friend (user: friend_456)
{
  type: 'diamond_update',
  data: {
    newBalance: 1010,
    message: "+10 💎 claimed successfully!",
    metadata: {
      source: 'referral_friend_reward_claimed',
      referralId: "ref_789xyz",
      amount: 10
    }
  }
}
```

#### Step 4: Referrer Claims Their Reward
```bash
curl -X POST http://localhost:3010/api/share/claim/referrer \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_a_123",
    "referralId": "ref_789xyz"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "amount": 5,
    "newBalance": 145,
    "message": "+5 💎 claimed from referral!"
  }
}
```

**🔔 WebSocket Notification:**
```javascript
// To Referrer (user: user_a_123)
{
  type: 'diamond_update',
  data: {
    newBalance: 145,
    message: "+5 💎 claimed from referral!",
    metadata: {
      source: 'referral_referrer_reward_claimed',
      referralId: "ref_789xyz",
      amount: 5
    }
  }
}
```

### **Scenario 2: Check Available Rewards**

```bash
curl -X GET "http://localhost:3010/api/share/rewards/available?userId=user_a_123"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "friendRewards": [
      {
        "referralId": "ref_abc123",
        "amount": 10,
        "referrerName": "John Doe",
        "openedAt": "2024-01-15T10:30:00Z",
        "message": "+10 💎 welcome bonus"
      }
    ],
    "referrerRewards": [
      {
        "referralId": "ref_def456",
        "amount": 5,
        "friendName": "Jane Smith", 
        "openedAt": "2024-01-15T11:00:00Z",
        "message": "+5 💎 from referral"
      },
      {
        "referralId": "ref_ghi789",
        "amount": 5,
        "friendName": "Bob Wilson",
        "openedAt": "2024-01-15T12:00:00Z", 
        "message": "+5 💎 from referral"
      }
    ],
    "totals": {
      "friendRewards": 10,
      "referrerRewards": 10,
      "total": 20
    }
  }
}
```

## 🚫 **Error Scenarios**

### **Already Claimed Error**
```bash
curl -X POST http://localhost:3010/api/share/claim/friend \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "friend_456",
    "referralId": "ref_789xyz"
  }'
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Friend reward already claimed"
}
```

### **Daily Limit Reached**
```bash
curl -X POST http://localhost:3010/api/share/claim/referrer \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_a_123",
    "referralId": "ref_999"
  }'
```

**Response (429 Too Many Requests):**
```json
{
  "success": false,
  "message": "Daily referral limit reached (3/3). Cannot claim more rewards today.",
  "reason": "DAILY_LIMIT_REACHED"
}
```

### **Unauthorized Claim Attempt**
```bash
curl -X POST http://localhost:3010/api/share/claim/friend \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "wrong_user_789",
    "referralId": "ref_123abc"
  }'
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Invalid referral or unauthorized friend"
}
```

## 📊 **Batch Claiming Example**

### **Get All Available + Claim Multiple**

```javascript
// Frontend JavaScript example
async function claimAllRewards(userId) {
  try {
    // 1. Get available rewards
    const availableResponse = await fetch(`/api/share/rewards/available?userId=${userId}`);
    const available = await availableResponse.json();
    
    if (!available.success) return;
    
    const results = {
      claimed: [],
      failed: []
    };
    
    // 2. Claim all friend rewards
    for (const reward of available.data.friendRewards) {
      try {
        const claimResponse = await fetch('/api/share/claim/friend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            referralId: reward.referralId
          })
        });
        
        const claimResult = await claimResponse.json();
        
        if (claimResult.success) {
          results.claimed.push({
            type: 'friend',
            amount: claimResult.data.amount,
            referralId: reward.referralId
          });
        } else {
          results.failed.push({
            type: 'friend',
            referralId: reward.referralId,
            error: claimResult.message
          });
        }
      } catch (error) {
        results.failed.push({
          type: 'friend',
          referralId: reward.referralId,
          error: error.message
        });
      }
    }
    
    // 3. Claim all referrer rewards
    for (const reward of available.data.referrerRewards) {
      try {
        const claimResponse = await fetch('/api/share/claim/referrer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId,
            referralId: reward.referralId
          })
        });
        
        const claimResult = await claimResponse.json();
        
        if (claimResult.success) {
          results.claimed.push({
            type: 'referrer',
            amount: claimResult.data.amount,
            referralId: reward.referralId
          });
        } else {
          results.failed.push({
            type: 'referrer',
            referralId: reward.referralId,
            error: claimResult.message
          });
        }
      } catch (error) {
        results.failed.push({
          type: 'referrer',
          referralId: reward.referralId,
          error: error.message
        });
      }
    }
    
    // 4. Calculate total claimed
    const totalClaimed = results.claimed.reduce((sum, r) => sum + r.amount, 0);
    
    console.log(`Successfully claimed ${totalClaimed} diamonds from ${results.claimed.length} rewards`);
    if (results.failed.length > 0) {
      console.log(`Failed to claim ${results.failed.length} rewards:`, results.failed);
    }
    
    return results;
    
  } catch (error) {
    console.error('Error in batch claiming:', error);
    throw error;
  }
}
```

## 🎮 **React Native Integration Example**

```javascript
// RewardsScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useWebSocket } from './hooks/useWebSocket';

export const RewardsScreen = ({ userId }) => {
  const [availableRewards, setAvailableRewards] = useState(null);
  const [claiming, setClaiming] = useState({});
  const { socket } = useWebSocket();

  // Listen for reward available notifications
  useEffect(() => {
    socket?.on('referral_notification', (data) => {
      if (data.notificationType === 'reward_available') {
        // Refresh available rewards
        fetchAvailableRewards();
        
        // Show notification
        showToast(`${data.message} - Tap to claim!`);
      }
    });

    return () => socket?.off('referral_notification');
  }, [socket]);

  const fetchAvailableRewards = async () => {
    try {
      const response = await fetch(`/api/share/rewards/available?userId=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setAvailableRewards(data.data);
      }
    } catch (error) {
      console.error('Error fetching rewards:', error);
    }
  };

  const claimReward = async (referralId, type) => {
    setClaiming(prev => ({ ...prev, [referralId]: true }));
    
    try {
      const endpoint = type === 'friend' ? '/api/share/claim/friend' : '/api/share/claim/referrer';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, referralId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast(result.data.message);
        // Remove claimed reward from UI
        fetchAvailableRewards();
      } else {
        showToast(result.message, 'error');
      }
    } catch (error) {
      showToast('Failed to claim reward', 'error');
    } finally {
      setClaiming(prev => ({ ...prev, [referralId]: false }));
    }
  };

  const renderReward = ({ item, type }) => (
    <TouchableOpacity
      style={styles.rewardCard}
      onPress={() => claimReward(item.referralId, type)}
      disabled={claiming[item.referralId]}
    >
      <Text style={styles.rewardAmount}>💎 {item.amount}</Text>
      <Text style={styles.rewardMessage}>{item.message}</Text>
      <Text style={styles.claimButton}>
        {claiming[item.referralId] ? 'Claiming...' : 'TAP TO CLAIM'}
      </Text>
    </TouchableOpacity>
  );

  // Load rewards on mount
  useEffect(() => {
    fetchAvailableRewards();
  }, [userId]);

  if (!availableRewards) {
    return <Text>Loading rewards...</Text>;
  }

  const totalAvailable = availableRewards.totals.total;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Available Rewards: {totalAvailable} 💎
      </Text>
      
      {availableRewards.friendRewards.map(item => 
        renderReward({ item, type: 'friend' })
      )}
      
      {availableRewards.referrerRewards.map(item => 
        renderReward({ item, type: 'referrer' })
      )}
      
      {totalAvailable === 0 && (
        <Text style={styles.noRewards}>
          No rewards available. Share the app to earn diamonds!
        </Text>
      )}
    </View>
  );
};
```

## 🎯 **Key Benefits Demonstrated**

### ✅ **User Control**
- Users see exactly what rewards are available
- Users decide when to claim rewards
- Clear action required messaging

### ✅ **Better UX**
- Real-time notifications when rewards become available
- No surprise diamond additions
- Engagement through claiming action

### ✅ **System Benefits**
- Fraud prevention through manual claiming
- Better analytics on claim rates
- Atomic transaction handling
- Clear audit trail

### ✅ **Technical Advantages**
- Separation of "available" vs "claimed" states
- Flexible reward modification before claiming
- Better error handling and validation
- Consistent API patterns

---

**Status**: ✅ **Claim-based system ready for production**
**Integration**: Drop-in replacement for automatic reward system
**Backward Compatibility**: Legacy endpoints still exist but deprecated 