const WeeklyStreak = require('./src/models/WeeklyStreak');

// Test the date calculations
const testDate = new Date('2025-01-13T10:30:00.000Z'); // Monday
console.log('Test date:', testDate.toISOString());
console.log('Test date local:', testDate.toString());

const weekStart = WeeklyStreak.getWeekStartDate(testDate);
const weekEnd = WeeklyStreak.getWeekEndDate(testDate);

console.log('Week start:', weekStart.toISOString());
console.log('Week start local:', weekStart.toString());
console.log('Week end:', weekEnd.toISOString());
console.log('Week end local:', weekEnd.toString());

// Test with current date
const now = new Date();
console.log('\nCurrent date:', now.toISOString());
console.log('Current date local:', now.toString());

const currentWeekStart = WeeklyStreak.getWeekStartDate(now);
const currentWeekEnd = WeeklyStreak.getWeekEndDate(now);

console.log('Current week start:', currentWeekStart.toISOString());
console.log('Current week start local:', currentWeekStart.toString());
console.log('Current week end:', currentWeekEnd.toISOString());
console.log('Current week end local:', currentWeekEnd.toString()); 