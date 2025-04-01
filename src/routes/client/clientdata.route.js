const express = require('express');
const router = express.Router();
const Client = require('../../models/clientUser.model'); // Assuming you have a Client model
const FoodLog = require('../../models/foodlogs.model'); // Assuming you have a FoodLog model

// Route to fetch client information by clientId
router.get('/:clientId', async (req, res) => {
  const { clientId } = req.params;

  try {
    // Fetch client information from the database
    const client = await Client.findOne({ _id: clientId });
    console.log('Fetching client information for clientId:', clientId); 

    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.status(200).json({ client });
  } catch (error) {
    console.error('Error fetching client information:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Add this new route to get detailed food log report
router.get("/report/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate } = req.query;

    if (!clientId) {
      return res.status(400).json({ message: "Client ID is required." });
    }

    // Create date range filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // Find food logs for the client within date range
    const foodLogs = await FoodLog.find({
      clientUserId: clientId,
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
    }).sort({ createdAt: -1 });

    // Calculate daily totals
    const dailyTotals = foodLogs.reduce((acc, log) => {
      const date = log.createdAt.toISOString().split('T')[0];
      
      if (!acc[date]) {
        acc[date] = {
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          meals: [],
        };
      }

      // Parse numeric values from strings with units
      const calories = parseFloat(log.calories);
      const protein = parseFloat(log.protein);
      const carbs = parseFloat(log.carbs);
      const fats = parseFloat(log.fats);

      acc[date].calories += calories || 0;
      acc[date].protein += protein || 0;
      acc[date].carbs += carbs || 0;
      acc[date].fats += fats || 0;
      acc[date].meals.push({
        foodName: log.foodName,
        mealType: log.mealType,
        calories: calories || 0,
        protein: protein || 0,
        carbs: carbs || 0,
        fats: fats || 0,
      });

      return acc;
    }, {});

    // Calculate averages
    const days = Object.keys(dailyTotals).length;
    const averages = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
    };

    if (days > 0) {
      let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFats = 0;

      Object.values(dailyTotals).forEach(day => {
        totalCalories += day.calories;
        totalProtein += day.protein;
        totalCarbs += day.carbs;
        totalFats += day.fats;
      });

      averages.calories = Math.round(totalCalories / days);
      averages.protein = Math.round(totalProtein / days);
      averages.carbs = Math.round(totalCarbs / days);
      averages.fats = Math.round(totalFats / days);
    }

    res.status(200).json({
      success: true,
      dailyTotals,
      averages,
      totalDays: days,
    });

  } catch (error) {
    console.error("Error generating food log report:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error generating food log report" 
    });
  }
});


module.exports = router;