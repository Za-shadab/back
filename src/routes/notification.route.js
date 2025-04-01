const express = require('express');
const router = express.Router();
const Notification = require('../models/notification.model');

// Get all notifications for a user with filtering
router.get('/:userId', async (req, res) => {
  try {
    const { type, read, limit = 20 } = req.query;
    
    // Build query
    const query = { userId: req.params.userId };
    if (type) query.type = type;
    if (read !== undefined) query.read = read === 'true';

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Get unread count
    const unreadCount = await Notification.countDocuments({
      userId: req.params.userId,
      read: false
    });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Mark notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Mark all notifications as read for a user
router.patch('/mark-all-read/:userId', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.params.userId, read: false },
      { read: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Create a new notification with validation
router.post('/', async (req, res) => {
  try {
    const { userId, title, message, type, priority, actionable, action } = req.body;

    // Validate required fields
    if (!userId || !title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const notification = new Notification({
      userId,
      title,
      message,
      type,
      priority: priority || 'medium',
      actionable: actionable || false,
      action,
      createdAt: new Date()
    });

    await notification.save();

    res.status(201).json({
      success: true,
      notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete a notification
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get unread count
router.get('/unread-count/:userId', async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.params.userId,
      read: false
    });

    res.status(200).json({
      success: true,
      count
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;