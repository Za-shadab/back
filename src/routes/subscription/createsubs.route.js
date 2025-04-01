const express = require("express");
const router = express.Router();
const Razorpay = require("razorpay");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { createNotification } = require('../../utils/notifications');
const nutrtitionist = require("../../models/Nutritionist.model");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_2feKTmwDwvl0Yb",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "dLgwvt8b179TivH4foW8uQRd",
});

// Create subscription model
const subscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  subscriptionId: { type: String, required: true },
  planId: { type: String, required: true },
  paymentId: { type: String },
  status: { type: String, default: "created" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Subscription = mongoose.model("Subscription", subscriptionSchema);

// Create subscription endpoint
router.post("/", async (req, res) => {
  try {
    const { planId, userId } = req.body;
    
    if (!planId || !userId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Create subscription in Razorpay
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: 12, // 12 months subscription
      notes: {
        userId: userId
      }
    });

    // Save initial subscription details
    const newSubscription = new Subscription({
      userId,
      subscriptionId: subscription.id,
      planId,
      status: subscription.status
    });

    await newSubscription.save();

    res.json({ 
      subscription,
      key_id: razorpay.key_id // Send key_id to frontend
    });
  } catch (error) {
    console.error("Subscription creation error:", error);
    res.status(500).json({ 
      error: "Failed to create subscription",
      details: error.error?.description || error.message 
    });
  }
});

// Save subscription details after payment
router.post("/save-subscription", async (req, res) => {
  try {
    const { userId, subscriptionId, paymentId } = req.body;
    
    if (!userId || !subscriptionId || !paymentId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Verify the payment was successful
    try {
      const payment = await razorpay.payments.fetch(paymentId);

      if (payment.status === 'authorized') {
        const captureResponse = await razorpay.payments.capture(paymentId, payment.amount, payment.currency);
        console.log("Payment captured successfully:", captureResponse);
      }
      
      if (payment.status !== 'captured') {
        console.log("payment status",payment.status);
        return res.status(400).json({ 
          error: "Payment not captured", 
          status: payment.status 
        });
      }
    } catch (paymentError) {
      console.log("Payment verification error:", paymentError);
      return res.status(400).json({ 
        error: "Invalid payment", 
        details: paymentError.error?.description || "Payment could not be verified"
      });
    }

    // Find and update the subscription
    const subscription = await Subscription.findOneAndUpdate(
      { subscriptionId, userId },
      { 
        paymentId,
        status: "active",
        updatedAt: Date.now()
      },
      { new: true }
    );

    // Add notification for successful subscription
    await createNotification({
      userId,
      title: 'Subscription Activated',
      message: 'Your subscription has been activated successfully',
      type: 'subscription',
      priority: 'high',
      actionable: true,
      action: 'viewSubscription'
    });

    if (!subscription) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    res.json({ 
      success: true, 
      message: "Subscription saved successfully",
      subscription
    });
  } catch (error) {
    console.log("Save subscription error:", error);
    res.status(500).json({ error: "Failed to save subscription details" });
  }
});

// Get subscription by ID
router.get("/subscription", async (req, res) => {
  try {

    const {id} = req.query;
    console.log("id:", id);
    
    // const { subscriptionId } = req.params;
    
    // First check our database
    const localSubscription = await Subscription.findOne({ userId: id });
    console.log(localSubscription);
    
    if (!localSubscription) {
      return res.status(404).json({ error: "Subscription not found in database" });
    }
    
    // Then fetch latest status from Razorpay
    try {
      const razorpaySubscription = await razorpay.subscriptions.fetch(localSubscription.subscriptionId);
      
      // Update our record if status differs
      if (localSubscription.status !== razorpaySubscription.status) {
        localSubscription.status = razorpaySubscription.status;
        localSubscription.updatedAt = Date.now();
        await localSubscription.save();
      }
      
      res.json({
        subscription: {
          ...localSubscription.toObject(),
          razorpayStatus: razorpaySubscription.status,
          nextBillingDate: razorpaySubscription.current_end
        }
      });
    } catch (error) {
      // Still return our local data if Razorpay fetch fails
      console.error("Razorpay subscription fetch error:", error);
      res.json({ 
        subscription: localSubscription,
        warning: "Could not refresh from Razorpay" 
      });
    }
  } catch (error) {
    console.error("Fetch subscription error:", error);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// Get user subscriptions
router.get("/user-subscriptions/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }
    
    const subscriptions = await Subscription.find({ userId }).sort({ createdAt: -1 });
    
    res.json({ subscriptions });
  } catch (error) {
    console.error("Fetch user subscriptions error:", error);
    res.status(500).json({ error: "Failed to fetch user subscriptions" });
  }
});

// Cancel subscription
router.post("/cancel-subscription/:subscriptionId", async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { userId, cancelAtPeriodEnd = false } = req.body;

    if (!subscriptionId || !userId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Check if subscription exists in our database
    const subscriptionRecord = await Subscription.findOne({ subscriptionId, userId });

    if (!subscriptionRecord) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    try {
      // First check if subscription is eligible for cancellation
      const currentSubscription = await razorpay.subscriptions.fetch(subscriptionId);
      
      if (currentSubscription.status !== 'active') {
        return res.status(400).json({ 
          error: "Subscription cannot be cancelled", 
          details: `Current status is ${currentSubscription.status}`
        });
      }

      // Cancel in Razorpay
      const cancelledSubscription = await razorpay.subscriptions.cancel(subscriptionId);

      // Update our database
      subscriptionRecord.status = "cancelled";
      subscriptionRecord.updatedAt = Date.now();
      await subscriptionRecord.save();

      // Add notification for cancellation
      await createNotification({
        userId,
        title: 'Subscription Cancelled',
        message: 'Your subscription has been cancelled',
        type: 'subscription',
        priority: 'medium',
        actionable: true,
        action: 'viewSubscription'
      });

      res.json({ 
        success: true, 
        message: 'Subscription cancelled successfully',
        subscription: cancelledSubscription
      });

    } catch (error) {
      console.error("Razorpay cancellation error:", error);
      res.status(400).json({ 
        error: "Failed to cancel subscription in Razorpay", 
        details: error.error?.description || error.message
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Pause subscription with Razorpay verification
router.post("/pause-subscription/:subscriptionId", async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { userId, pauseCycles = 1 } = req.body;
    const notificationUser = await nutrtitionist.findOne({ UserId: userId });
    const notificationId = notificationUser._id;
    console.log("notificationUser:", notificationUser._id);

    if (!subscriptionId || !userId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // First verify subscription exists
    const subscriptionRecord = await Subscription.findOne({ subscriptionId, userId });
    
    if (!subscriptionRecord) {
      return res.status(404).json({ error: "Subscription not found" });
    }

    try {
      // Pause in Razorpay first
      const pausedSubscription = await razorpay.subscriptions.pause(subscriptionId, {
        pause_at: "now",
        resume_at: "after_pause_cycles",
        pause_cycles: pauseCycles
      });

      // Verify pause by fetching latest status
      const updatedRazorpaySubscription = await razorpay.subscriptions.fetch(subscriptionId);

      if (updatedRazorpaySubscription.status === 'paused') {
        // Update our database only after successful Razorpay pause
        subscriptionRecord.status = "paused";
        subscriptionRecord.updatedAt = Date.now();
        await subscriptionRecord.save();

        // Add notification for pause
        await createNotification({
          userId:notificationId,
          title: 'Subscription Paused',
          message: `Your subscription has been paused for ${pauseCycles} ${pauseCycles === 1 ? 'cycle' : 'cycles'}`,
          type: 'subscription',
          priority: 'medium',
          actionable: true,
          action: 'viewSubscription'
        });

        res.json({ 
          success: true, 
          message: `Subscription paused for ${pauseCycles} ${pauseCycles === 1 ? 'cycle' : 'cycles'}`,
          subscription: updatedRazorpaySubscription
        });
      } else {
        throw new Error('Razorpay pause failed');
      }
    } catch (error) {
      console.error("Razorpay pause error:", error);
      res.status(400).json({ 
        error: "Failed to pause subscription in Razorpay", 
        details: error.error?.description || error.message
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Resume paused subscription
router.post("/resume-subscription/:subscriptionId", async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const { userId } = req.body;
    const notificationUser = await nutrtitionist.findOne({ UserId: userId });
    const notificationId = notificationUser._id;
    
    if (!subscriptionId || !userId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Resume subscription in Razorpay
    try {
      const resumedSubscription = await razorpay.subscriptions.resume(subscriptionId);
      
      // Update our database
      const subscriptionRecord = await Subscription.findOneAndUpdate(
        { subscriptionId, userId },
        { 
          status: "active",
          updatedAt: Date.now()
        },
        { new: true }
      );

      // Add notification for resume
      await createNotification({
        userId: notificationId,
        title: 'Subscription Resumed',
        message: 'Your subscription has been resumed successfully',
        type: 'subscription',
        priority: 'medium',
        actionable: true,
        action: 'viewSubscription'
      });
      
      res.json({ 
        success: true, 
        message: "Subscription resumed successfully",
        subscription: resumedSubscription
      });
    } catch (error) {
      console.error("Subscription resume error:", error);
      res.status(400).json({ 
        error: "Failed to resume subscription", 
        details: error.error?.description || error.message
      });
    }
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Razorpay webhook handler
router.post("/webhook", (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "your_webhook_secret";
  
  try {
    const signature = req.headers["x-razorpay-signature"];
    
    // Verify webhook signature
    const shasum = crypto.createHmac("sha256", webhookSecret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest("hex");
    
    if (digest === signature) {
      // Process the webhook event
      const event = req.body;
      console.log("Webhook event received:", event.event);
      
      // Handle different webhook events
      switch(event.event) {
        case "subscription.charged":
          // Update subscription status when payment is successful
          handleSubscriptionCharged(event.payload.subscription.entity);
          break;
        
        case "subscription.payment.failed":
          // Handle failed payment
          handlePaymentFailed(event.payload.subscription.entity);
          break;
          
        case "subscription.cancelled":
          // Handle cancellation
          handleSubscriptionCancelled(event.payload.subscription.entity);
          break;
          
        case "subscription.paused":
          // Handle subscription paused
          handleSubscriptionPaused(event.payload.subscription.entity);
          break;
          
        case "subscription.resumed":
          // Handle subscription resumed
          handleSubscriptionResumed(event.payload.subscription.entity);
          break;
          
        default:
          console.log("Unhandled webhook event:", event.event);
      }
      
      res.json({ received: true });
    } else {
      res.status(400).json({ error: "Invalid signature" });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Add this route to get subscription details
router.get('/subscription-details/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'Subscription ID is required'
      });
    }

    // Fetch subscription details from Razorpay
    const subscription = await razorpay.subscriptions.fetch(subscriptionId);

    // Format the subscription details
    const formattedSubscription = {
      subscriptionId: subscription.id,
      planId: subscription.plan_id,
      status: subscription.status,
      nextBillingDate: subscription.current_end * 1000, // Convert to milliseconds
      startDate: subscription.start_at * 1000,
      endDate: subscription.end_at ? subscription.end_at * 1000 : null,
      amount: subscription.plan_amount,
      billingCycle: 'Monthly', // Or get from plan details
      razorpayStatus: subscription.status,
      planName: 'Nutrition Plan' // You might want to fetch this from your plan details
    };

    res.status(200).json({
      success: true,
      subscription: formattedSubscription
    });

  } catch (error) {
    console.error('Error fetching subscription details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching subscription details'
    });
  }
});

// Add this route to get plan details
router.get('/plan-details/:planId', async (req, res) => {
  try {
    const { planId } = req.params;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID is required'
      });
    }

    // Fetch plan details from Razorpay
    const plan = await razorpay.plans.fetch(planId);

    // Format the plan details
    const formattedPlan = {
      planId: plan.id,
      planName: plan.item.name,
      amount: plan.item.amount,
      currency: plan.item.currency,
      description: plan.item.description,
      billingCycle: plan.period === 'monthly' ? 'Monthly' : 'Annual',
      features: plan.notes?.features ? JSON.parse(plan.notes.features) : [],
      maxClients: plan.notes?.maxClients || 'Unlimited',
      status: plan.status
    };

    res.status(200).json({
      success: true,
      plan: formattedPlan
    });

  } catch (error) {
    console.error('Error fetching plan details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching plan details'
    });
  }
});

// Helper functions for webhook event handling
async function handleSubscriptionCharged(subscription) {
  try {
    const sub = await Subscription.findOne({ subscriptionId: subscription.id });
    if (sub) {
      const notificationUser = await nutrtitionist.findOne({ UserId: sub.userId });
      if (!notificationUser) {
        console.error("Nutritionist not found for userId:", sub.userId);
        return;
      }

      await Subscription.findOneAndUpdate(
        { subscriptionId: subscription.id },
        { 
          status: "active",
          updatedAt: Date.now()
        }
      );

      await createNotification({
        userId: notificationUser._id,
        title: 'Payment Successful',
        message: 'Your subscription payment was successful',
        type: 'subscription',
        priority: 'medium',
        actionable: true,
        action: 'viewSubscription'
      });
    }
  } catch (error) {
    console.error("Error in handleSubscriptionCharged:", error);
  }
}

async function handlePaymentFailed(subscription) {
  try {
    const sub = await Subscription.findOne({ subscriptionId: subscription.id });
    if (sub) {
      const notificationUser = await nutrtitionist.findOne({ UserId: sub.userId });
      if (!notificationUser) {
        console.error("Nutritionist not found for userId:", sub.userId);
        return;
      }

      await Subscription.findOneAndUpdate(
        { subscriptionId: subscription.id },
        { 
          status: "payment_failed",
          updatedAt: Date.now()
        }
      );

      await createNotification({
        userId: notificationUser._id,
        title: 'Payment Failed',
        message: 'Your subscription payment has failed. Please update your payment method.',
        type: 'subscription',
        priority: 'high',
        actionable: true,
        action: 'updatePayment'
      });
    }
  } catch (error) {
    console.error("Error in handlePaymentFailed:", error);
  }
}

async function handleSubscriptionCancelled(subscription) {
  try {
    const sub = await Subscription.findOne({ subscriptionId: subscription.id });
    if (sub) {
      const notificationUser = await nutrtitionist.findOne({ UserId: sub.userId });
      if (!notificationUser) {
        console.error("Nutritionist not found for userId:", sub.userId);
        return;
      }

      await Subscription.findOneAndUpdate(
        { subscriptionId: subscription.id },
        { 
          status: "cancelled",
          updatedAt: Date.now()
        }
      );

      await createNotification({
        userId: notificationUser._id,
        title: 'Subscription Cancelled',
        message: 'Your subscription has been cancelled successfully.',
        type: 'subscription',
        priority: 'medium',
        actionable: false
      });
    }
  } catch (error) {
    console.error("Error in handleSubscriptionCancelled:", error);
  }
}

async function handleSubscriptionPaused(subscription) {
  try {
    const sub = await Subscription.findOne({ subscriptionId: subscription.id });
    if (sub) {
      const notificationUser = await nutrtitionist.findOne({ UserId: sub.userId });
      if (!notificationUser) {
        console.error("Nutritionist not found for userId:", sub.userId);
        return;
      }

      await Subscription.findOneAndUpdate(
        { subscriptionId: subscription.id },
        { 
          status: "paused",
          updatedAt: Date.now()
        }
      );

      await createNotification({
        userId: notificationUser._id,
        title: 'Subscription Paused',
        message: 'Your subscription has been paused.',
        type: 'subscription',
        priority: 'medium',
        actionable: true,
        action: 'viewSubscription'
      });
    }
  } catch (error) {
    console.error("Error in handleSubscriptionPaused:", error);
  }
}

async function handleSubscriptionResumed(subscription) {
  try {
    const sub = await Subscription.findOne({ subscriptionId: subscription.id });
    if (sub) {
      const notificationUser = await nutrtitionist.findOne({ UserId: sub.userId });
      if (!notificationUser) {
        console.error("Nutritionist not found for userId:", sub.userId);
        return;
      }

      await Subscription.findOneAndUpdate(
        { subscriptionId: subscription.id },
        { 
          status: "active",
          updatedAt: Date.now()
        }
      );

      await createNotification({
        userId: notificationUser._id,
        title: 'Subscription Resumed',
        message: 'Your subscription has been resumed successfully.',
        type: 'subscription',
        priority: 'medium',
        actionable: true,
        action: 'viewSubscription'
      });
    }
  } catch (error) {
    console.error("Error in handleSubscriptionResumed:", error);
  }
}

// Add notification for subscription expiry (7 days before)
async function checkSubscriptionExpiry() {
  try {
    const expiringSubscriptions = await Subscription.find({
      status: 'active',
      endDate: {
        $lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        $gt: new Date()
      }
    });

    for (const sub of expiringSubscriptions) {
      await createNotification({
        userId: sub.userId,
        title: 'Subscription Expiring Soon',
        message: 'Your subscription will expire in 7 days. Please renew to continue using our services.',
        type: 'subscription',
        priority: 'high',
        actionable: true,
        action: 'renewSubscription'
      });
    }
  } catch (error) {
    console.error("Error checking subscription expiry:", error);
  }
}

module.exports = router;