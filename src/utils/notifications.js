const Notification = require('../models/notification.model');

const createNotification = async ({
  userId,
  title,
  message,
  type,
  priority = 'medium',
  actionable = false,
  action = null
}) => {
  try {
    const notification = new Notification({
      userId,
      title,
      message,
      type,
      priority,
      actionable,
      action
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

module.exports = { createNotification };