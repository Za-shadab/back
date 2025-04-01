const HealthData = require('../models/HealthData.model');
const DailyHealthSummary = require('../models/DailyHealthSummary.model');
const User = require('../models/User.model');
const { createNotification } = require('../utils/notifications');

const calculateActivityLevel = (steps) => {
  if (steps < 5000) return 'sedentary';
  if (steps < 7500) return 'lightly_active';
  if (steps < 10000) return 'moderately_active';
  return 'very_active';
};

const processHealthData = async () => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // Get all health records from yesterday
    const healthRecords = await HealthData.find({
      date: {
        $gte: yesterday,
        $lt: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    for (const record of healthRecords) {
      const user = await User.findOne({ regularId: record.userId });
      if (!user) continue;

      // Calculate daily summary
      const summary = {
        averageHeartRate: record.metrics.heartRate,
        totalSteps: record.metrics.steps,
        totalCaloriesBurned: record.metrics.caloriesBurned,
        averageGlucoseLevel: record.metrics.glucoseLevel,
        totalSleepHours: record.metrics.sleepHours,
        activityLevel: calculateActivityLevel(record.metrics.steps)
      };

      // Get previous day's summary for trend calculation
      const previousDay = new Date(yesterday);
      previousDay.setDate(previousDay.getDate() - 1);
      const previousSummary = await DailyHealthSummary.findOne({
        userId: record.userId,
        date: previousDay
      });

      // Calculate trends
      const trends = {
        heartRateChange: previousSummary ? 
          summary.averageHeartRate - previousSummary.summary.averageHeartRate : 0,
        stepsChange: previousSummary ? 
          summary.totalSteps - previousSummary.summary.totalSteps : 0,
        caloriesChange: previousSummary ? 
          summary.totalCaloriesBurned - previousSummary.summary.totalCaloriesBurned : 0,
        sleepChange: previousSummary ? 
          summary.totalSleepHours - previousSummary.summary.totalSleepHours : 0
      };

      // Generate recommendations
      const recommendations = [];
      if (summary.totalSteps < user.dailyStepsGoal) {
        recommendations.push({
          type: 'Increase daily activity to reach your step goal',
          category: 'activity',
          priority: 'high'
        });
      }

      // Update user profile if needed
      const shouldUpdateProfile = 
        Math.abs(trends.caloriesChange) > 500 || 
        Math.abs(trends.stepsChange) > 2000;

      if (shouldUpdateProfile) {
        const newActivityLevel = calculateActivityLevel(summary.totalSteps);
        if (newActivityLevel !== user.activityLevel) {
          user.activityLevel = newActivityLevel;
          // Recalculate TDEE based on new activity level
          user.goalCalories = calculateTDEE(user);
          await user.save();

          await createNotification({
            userId: user.regularId,
            title: 'Activity Level Updated',
            message: `Your activity level has been updated to ${newActivityLevel}. Your daily calorie goal has been adjusted accordingly.`,
            type: 'health',
            priority: 'high'
          });
        }
      }

      // Save daily summary
      await DailyHealthSummary.create({
        userId: record.userId,
        date: yesterday,
        summary,
        trends,
        recommendations
      });
    }
  } catch (error) {
    console.error('Error processing health data:', error);
  }
};

module.exports = { processHealthData };