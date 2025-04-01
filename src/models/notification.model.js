const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['client', 'mealplan', 'feedback', 'reminder', 'system', 'subscription'],
    required: true
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  read: {
    type: Boolean,
    default: false
  },
  actionable: {
    type: Boolean,
    default: false
  },
  action: {
    type: String,
    enum: ['viewClient', 'viewMealPlan', 'viewFeedback', 'scheduleCheckIn', 'createMealPlan', 'viewSubscription', 'health'],
    required: function() { return this.actionable; }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', notificationSchema);