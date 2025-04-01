const express = require('express');
const router = express.Router();
const DailyHealthSummary = require('../../models/DailyHealthSummary.model');
// const User = require('../../models/user');
const regularUser = require('../../models/regularUser.model')
const { createNotification } = require('../../utils/notifications');

router.put('/summary', async (req, res) => {
  try {
    const { userId, date, summary, hourlyHeartRate, weeklyHeartRate } = req.body;

    if (!userId || !summary) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Find or create daily summary
    let dailySummary = await DailyHealthSummary.findOne({
      userId,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lt: new Date(date).setHours(23, 59, 59, 999)
      }
    });

    if (!dailySummary) {
      dailySummary = new DailyHealthSummary({
        userId,
        date: new Date(date),
        summary,
        hourlyHeartRate,
        weeklyHeartRate
      });
    } else {
      dailySummary.summary = summary;
      if (hourlyHeartRate) dailySummary.hourlyHeartRate = hourlyHeartRate;
      if (weeklyHeartRate) dailySummary.weeklyHeartRate = weeklyHeartRate;
    }

    // Update user profile if needed
    const user = await regularUser.findOne({ _id: userId });
    console.log('User found:', user);
    if (user && summary?.activityLevel) {
        const newActivityLevel = summary.activityLevel;
        console.log('New activity level:', newActivityLevel);
        console.log('Current activity level:', user.activityLevel);
      
        if (newActivityLevel !== user.activityLevel) {
          const activityMultipliers = {
            'Not Very Active': 1.2,
            'Lightly Active': 1.375,
            'Active': 1.55,
            'Very Active': 1.725
          };
      
          const bmr = parseFloat(user.bmr);
          if (isNaN(bmr) || bmr <= 0) {
            console.error("Invalid BMR:", user.bmr);
            return res.status(400).json({ success: false, message: "Invalid BMR value" });
          }
      
          // Ensure the correct multiplier is applied
          const multiplier = activityMultipliers.hasOwnProperty(newActivityLevel)
            ? activityMultipliers[newActivityLevel]
            : 1.375;
      
          const newTDEE = Math.round(bmr * multiplier);
      
          console.log("Multiplier being applied:", multiplier);
          console.log("BMR:", bmr);
          console.log("New TDEE:", newTDEE);
      
          user.activityLevel = newActivityLevel;
          user.tdee = newTDEE.toString();
          user.goalCalories = newTDEE.toString();
          
          await user.save();
          console.log('Updated user profile:', {
            activityLevel: user.activityLevel,
            tdee: user.tdee,
            goalCalories: user.goalCalories
          });
      
          await createNotification({
            userId,
            title: 'Activity Level & Calories Updated',
            message: `Your activity level has been updated to ${newActivityLevel}. Daily calorie goal adjusted to ${newTDEE} calories.`,
            type: 'health',
            priority: 'medium'
          });
        }
      }
      

    await dailySummary.save();

    res.status(200).json({
      success: true,
      message: 'Daily summary updated successfully',
      data: dailySummary
    });

  } catch (error) {
    console.error('Error updating daily summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update daily summary',
      error: error.message
    });
  }
});

module.exports = router;