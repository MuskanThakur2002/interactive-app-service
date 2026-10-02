# React Native Deep Linking Setup with Bitly

## 🔗 Overview

This guide shows how to configure your React Native app to handle Bitly deep links that open your app directly instead of a browser.

## 📱 Setup Methods

### Method 1: Universal Links (iOS) + App Links (Android) - **RECOMMENDED**

This method works seamlessly - if the app is installed, it opens directly; if not, it opens in browser.

#### Step 1: Configure Your Domain

Add these files to your web server:

**iOS - `/.well-known/apple-app-site-association`** (no extension):
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.yourcompany.troak",
        "paths": [
          "/referral/*",
          "/share/*"
        ]
      }
    ]
  }
}
```

**Android - `/.well-known/assetlinks.json`**:
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.troak",
      "sha256_cert_fingerprints": ["YOUR_CERT_FINGERPRINT"]
    }
  }
]
```

#### Step 2: iOS Configuration

**`ios/troak/Info.plist`**:
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>troak</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>troak</string>
    </array>
  </dict>
</array>

<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:troak.app</string>
  <string>applinks:www.troak.app</string>
</array>
```

**`ios/troak/troak.entitlements`**:
```xml
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:troak.app</string>
  <string>applinks:www.troak.app</string>
</array>
```

#### Step 3: Android Configuration

**`android/app/src/main/AndroidManifest.xml`**:
```xml
<activity
  android:name=".MainActivity"
  android:exported="true"
  android:launchMode="singleTop"
  android:theme="@style/AppTheme">
  
  <!-- Regular launch intent -->
  <intent-filter>
    <action android:name="android.intent.action.MAIN" />
    <category android:name="android.intent.category.LAUNCHER" />
  </intent-filter>
  
  <!-- Custom scheme deep links -->
  <intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="troak" />
  </intent-filter>
  
  <!-- Universal links / App links -->
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https"
          android:host="troak.app" />
  </intent-filter>
  
</activity>
```

### Method 2: Custom Scheme Only

If you prefer simpler setup (but less robust fallback):

#### Custom Scheme Links: `troak://referral/ABC123`

**React Native Configuration**:
```javascript
// App.js
import { Linking } from 'react-native';

const App = () => {
  useEffect(() => {
    // Handle initial URL when app is closed
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Handle URL when app is in background
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => subscription?.remove();
  }, []);

  const handleDeepLink = (url) => {
    console.log('Deep link received:', url);
    
    // Parse different URL formats
    const referralCode = extractReferralCode(url);
    if (referralCode) {
      handleReferralLink(referralCode);
    }
  };

  const extractReferralCode = (url) => {
    // Handle different URL formats:
    // troak://referral/ABC123
    // https://troak.app/referral/ABC123
    // https://bit.ly/xyz123 (after redirect)
    
    const patterns = [
      /troak:\/\/referral\/([A-Z0-9]+)/,
      /https?:\/\/.*\/referral\/([A-Z0-9]+)/,
      /[?&]ref=([A-Z0-9]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  };

  const handleReferralLink = async (referralCode) => {
    try {
      // Call your API to handle referral
      const response = await fetch('https://api.troak.app/api/share/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referralCode,
          isDeepLink: true,
          platform: Platform.OS
        }),
      });

      const result = await response.json();
      
      if (result.success && result.data.friendReward) {
        // Show reward notification
        showRewardToast(result.data.friendReward.amount);
      }
      
      // Navigate to appropriate screen
      navigation.navigate('Home');
      
    } catch (error) {
      console.error('Error handling referral:', error);
    }
  };

  return (
    // Your app components
  );
};
```

## 🛠️ React Native Libraries

### Install Required Dependencies

```bash
npm install @react-native-async-storage/async-storage
npm install @react-navigation/native
npm install react-native-branch  # Optional: For advanced deep linking
```

### Using React Navigation v6

```javascript
// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: [
    'troak://',
    'https://troak.app',
    'https://www.troak.app'
  ],
  config: {
    screens: {
      Home: 'home',
      Referral: 'referral/:code',
      Story: 'story/:id'
    },
  },
};

export default function App() {
  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Referral" component={ReferralScreen} />
        <Stack.Screen name="Story" component={StoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ReferralScreen.js
const ReferralScreen = ({ route }) => {
  const { code } = route.params;
  
  useEffect(() => {
    if (code) {
      handleReferralCode(code);
    }
  }, [code]);

  const handleReferralCode = async (referralCode) => {
    // Same API call as above
  };
};
```

## 🔧 Environment Variables

Add to your app's environment:

```javascript
// config.js
export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? 'http://localhost:3010' 
    : 'https://api.troak.app',
    
  DEEP_LINK_DOMAIN: 'troak.app',
  CUSTOM_SCHEME: 'troak'
};
```

## 📲 Testing Deep Links

### Testing on iOS Simulator
```bash
xcrun simctl openurl booted "troak://referral/ABC123"
xcrun simctl openurl booted "https://troak.app/referral/ABC123"
```

### Testing on Android Emulator
```bash
adb shell am start \
  -W -a android.intent.action.VIEW \
  -d "troak://referral/ABC123" \
  com.yourcompany.troak

adb shell am start \
  -W -a android.intent.action.VIEW \
  -d "https://troak.app/referral/ABC123" \
  com.yourcompany.troak
```

### Testing Real Bitly Links
1. Create a referral link via API
2. Send the Bitly link to your phone via SMS/email
3. Tap the link - should open your app directly

## 🎯 API Integration

### Creating Deep Links

```javascript
// Create different types of links
const createReferralLink = async (userId, linkType = 'universal') => {
  const response = await fetch('/api/share/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId, 
      linkType // 'universal', 'custom-scheme', 'smart'
    })
  });
  
  return response.json();
};

// Get all link types
const getAllDeepLinks = async (userId) => {
  const response = await fetch('/api/share/deep-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  
  return response.json();
  // Returns: { universal, customScheme, fallback }
};
```

### Handling Referral Opens

```javascript
const handleReferralOpen = async (referralCode) => {
  const response = await fetch('/api/share/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      referralCode,
      isDeepLink: true,
      platform: Platform.OS,
      deviceId: await getDeviceId()
    })
  });
  
  return response.json();
};
```

## 🚀 Sharing Deep Links

```javascript
import { Share } from 'react-native';

const shareReferralLink = async (userId) => {
  try {
    // Get smart deep link with all options
    const linkData = await getAllDeepLinks(userId);
    
    const shareOptions = {
      title: 'Join me on Troak!',
      message: `Hey! Check out this amazing story app. Use my link to get 10 💎 instantly!`,
      url: linkData.data.links.universal, // Use universal link for best compatibility
    };
    
    const result = await Share.share(shareOptions);
    
    if (result.action === Share.sharedAction) {
      console.log('Link shared successfully');
    }
    
  } catch (error) {
    console.error('Error sharing:', error);
  }
};
```

## 🔍 Debugging Tips

### 1. Check URL Associations
```bash
# iOS - Check if domain is properly associated
xcrun simctl openurl booted "https://troak.app/referral/TEST123"

# Android - Check intent filters
adb shell dumpsys package com.yourcompany.troak | grep -A 5 "intent-filter"
```

### 2. Verify Certificates (Android)
```bash
# Get your app's SHA256 fingerprint
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### 3. Test Universal Links
Use Apple's validator: https://search.developer.apple.com/appsearch-validation-tool

### 4. Monitor Deep Link Events
```javascript
// Add comprehensive logging
const handleDeepLink = (url) => {
  console.log('=== DEEP LINK DEBUG ===');
  console.log('URL:', url);
  console.log('Platform:', Platform.OS);
  console.log('App State:', AppState.currentState);
  console.log('========================');
  
  // Your handling logic
};
```

## ⚠️ Common Issues

1. **Links open in browser instead of app**
   - Check Universal Links configuration
   - Verify domain association files
   - Test with different browsers

2. **App doesn't open from cold start**
   - Ensure intent filters are correct
   - Check app permissions
   - Verify custom scheme format

3. **Bitly links don't redirect properly**
   - Check your domain's redirect configuration
   - Verify Bitly deep link settings
   - Test with direct URLs first

## 🌟 Best Practices

1. **Always provide fallbacks** - Use smart links with multiple options
2. **Test on real devices** - Simulators don't always behave like real devices
3. **Handle edge cases** - App not installed, network issues, etc.
4. **Monitor analytics** - Track deep link performance
5. **Use Universal Links** - Best user experience across platforms

---

With this setup, your Bitly links will seamlessly open your React Native app! 🎉 