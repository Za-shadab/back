const mongoose = require('mongoose');

const dailyHealthSummarySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  summary: {
    averageHeartRate: Number,
    totalSteps: Number,
    totalCaloriesBurned: Number,
    averageGlucoseLevel: Number,
    totalSleepHours: Number,
    activityLevel: {
      type: String,
      enum: ['Lightly Active', 'Not Very Active', 'Active', 'Very Active'],
    }
  },
  trends: {
    heartRateChange: Number,
    stepsChange: Number,
    caloriesChange: Number,
    sleepChange: Number
  },
  recommendations: [{
    type: String,
    category: {
      type: String,
      enum: ['activity', 'nutrition', 'sleep', 'general']
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high']
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('DailyHealthSummary', dailyHealthSummarySchema);