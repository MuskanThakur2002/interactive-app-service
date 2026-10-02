const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3010'; // Adjust port if needed
const TEST_USER_ID = '507f1f77bcf86cd799439011'; // Replace with actual user ID

async function testTotalDiamondsEarnedToday() {
  try {
    console.log('Testing Total Diamonds Earned Today API...');
    console.log(`URL: ${BASE_URL}/api/monetization/total-diamonds-earned-today/${TEST_USER_ID}`);
    
    const response = await axios.get(`${BASE_URL}/api/monetization/total-diamonds-earned-today/${TEST_USER_ID}`);
    
    console.log('✅ API Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      const { totalDiamondsEarnedToday, breakdown } = response.data.data;
      console.log('\n📊 Summary:');
      console.log(`Total Diamonds Earned Today: ${totalDiamondsEarnedToday}`);
      console.log('\nBreakdown:');
      console.log(`- Daily Rewards: ${breakdown.dailyRewards.earned} diamonds`);
      console.log(`- Time Tracking: ${breakdown.timeTracking.earned} diamonds`);
      console.log(`- Weekly Streak: ${breakdown.weeklyStreak.earned} diamonds`);
      console.log(`- Story Completion: ${breakdown.storyCompletion.earned} diamonds`);
    }
    
  } catch (error) {
    console.error('❌ Error testing API:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Run the test
testTotalDiamondsEarnedToday(); 