const express = require("express");
const router = express.Router();
const FoodLog = require("../models/foodlogs.model");
const User = require("../models/user");
const RegularUser = require("../models/regularUser.model");
require('dotenv').config();

// POST: Add food log
router.post("/add", async (req, res) => {
  try {
    const { regularUserId, clientUserId, foodId, mealType, foodName, image, measure, quantity, calories, protein, fats, fiber, carbs, sugar, cholestrol, iron, magnesium, potassium, sodium, zinc, vitaminB12, VitaminB6, VitaminC, VitaminD, thiamin } = req.body;
    console.log(req.body)
    // Ensure at least one user ID is provided
    if (!(regularUserId || clientUserId)) {
      return res.status(400).json({ message: "Either regularUserId or clientUserId is required." });
    }
    if (!foodName || !measure || !quantity) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newFoodLog = new FoodLog({
      regularUserId: regularUserId || null,  // Store only if provided
      clientUserId: clientUserId || null,    // Store only if provided
      foodId,
      foodName,
      image,
      mealType,
      measure,
      quantity,
      calories,
      protein,
      fats,
      fiber,
      carbs, 
      sugar, 
      cholestrol, 
      iron, 
      magnesium, 
      potassium, 
      sodium, 
      zinc, 
      vitaminB12, 
      VitaminB6, 
      VitaminC, 
      VitaminD, 
      thiamin
    });

    await newFoodLog.save();
    res.status(201).json({ message: "Food log added successfully!", foodLog: newFoodLog });

  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


// GET: Retrieve food logs for a specific user on a specific date
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    let { date } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    // Default to today's date if no date is provided
    const selectedDate = date 
    ? new Date(date).toLocaleDateString("en-CA")  // "YYYY-MM-DD" in local time
    : new Date().toLocaleDateString("en-CA");
  
    // Find food logs for the user and date
    const foodLogs = await FoodLog.find({
      $or: [{ regularUserId: userId }, { clientUserId: userId }],
      createdAt: { 
        $gte: new Date(`${selectedDate}T00:00:00.000Z`), 
        $lt: new Date(`${selectedDate}T23:59:59.999Z`) 
      }
    });

    // Fix: Convert calorie string to number before summing
    const totalCalConsumed = foodLogs.reduce((sum, log) => sum + parseFloat(log.calories), 0).toFixed(2) + " Kcal";
    const totalproteinConsumed = foodLogs.reduce((sum, log) => sum + parseFloat(log.protein), 0).toFixed(2) + "g";
    const totalcarbs = foodLogs.reduce((sum, log) => {
      const carbs = parseFloat(log.carbs);
      return sum + (isNaN(carbs) ? 0 : carbs);
    }, 0).toFixed(2) + "g";
    
    const totalfat = foodLogs.reduce((sum, log) => sum + parseFloat(log.fats), 0).toFixed(2) + "g";

    // Extract food log details with image URL
    const formattedFoodLogs = foodLogs.map(log => ({
      foodId: log.foodId,
      foodName: log.foodName,
      mealType: log.mealType,
      measure: log.measure,
      quantity: log.quantity,
      calories: log.calories,
      protein: log.protein,
      fats: log.fats,
      fiber: log.fiber,
      carbs: log.carbs,
      sugar: log.sugar,
      cholestrol: log.cholestrol,
      iron: log.iron,
      magnesium: log.magnesium,
      potassium: log.potassium,
      sodium: log.sodium,
      zinc: log.zinc,
      vitaminB12: log.vitaminB12,
      VitaminB6: log.VitaminB6,
      VitaminC: log.VitaminC,
      VitaminD: log.VitaminD,
      thiamin: log.thiamin,
      image: log.image // Include the image URL
    }));

    res.json({
      totalCalConsumed,
      totalproteinConsumed,
      totalcarbs,
      totalfat,
      foodLogs: formattedFoodLogs
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching food logs", error });
  }
});

// Progress tracking and insights route
router.get("/progress/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    // First, find the user and check their type
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get regularUserId based on user type
    let regularUserId;
    if (user.role === 'regular_user') {
      const regularUser = await RegularUser.findOne({ UserId: userId });
      if (!regularUser) {
        return res.status(404).json({ message: "Regular user profile not found" });
      }
      regularUserId = regularUser._id;
    } else {
      return res.status(400).json({ message: "Progress tracking is only available for regular users" });
    }

    // Get date range (default to last 7 days if not specified)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end - 7 * 24 * 60 * 60 * 1000);

    // Update the food logs query to use regularUserId
    const foodLogs = await FoodLog.find({
      regularUserId: regularUserId,
      createdAt: { 
        $gte: start,
        $lte: end
      }
    }).sort({ createdAt: 1 });

    // Helper function to parse nutrient values
    function parseNutrientValue(value) {
      if (!value || value === 'N/A' || value.startsWith('N/A')) return 0;
      return parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
    }

    // Update the daily metrics calculation
    const dailyMetrics = foodLogs.reduce((acc, log) => {
      const date = log.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          fiber: 0,
          meals: [],
          nutrients: {
            sugar: 0,
            cholesterol: 0,
            iron: 0,
            magnesium: 0,
            potassium: 0,
            sodium: 0,
            zinc: 0,
            vitaminB12: 0,
            vitaminB6: 0,
            vitaminC: 0,
            vitaminD: 0
          }
        };
      }
      
      // Parse main macros
      acc[date].calories += parseNutrientValue(log.calories);
      acc[date].protein += parseNutrientValue(log.protein);
      acc[date].carbs += parseNutrientValue(log.carbs);
      acc[date].fats += parseNutrientValue(log.fats);
      acc[date].fiber += parseNutrientValue(log.fiber);
      
      // Parse additional nutrients
      acc[date].nutrients.sugar += parseNutrientValue(log.sugar);
      acc[date].nutrients.cholesterol += parseNutrientValue(log.cholestrol);
      acc[date].nutrients.iron += parseNutrientValue(log.iron);
      acc[date].nutrients.magnesium += parseNutrientValue(log.magnesium);
      acc[date].nutrients.potassium += parseNutrientValue(log.potassium);
      acc[date].nutrients.sodium += parseNutrientValue(log.sodium);
      acc[date].nutrients.zinc += parseNutrientValue(log.zinc);
      acc[date].nutrients.vitaminB12 += parseNutrientValue(log.vitaminB12);
      acc[date].nutrients.vitaminB6 += parseNutrientValue(log.VitaminB6);
      acc[date].nutrients.vitaminC += parseNutrientValue(log.VitaminC);
      acc[date].nutrients.vitaminD += parseNutrientValue(log.VitaminD);
      
      // Track meals
      if (log.mealType && !acc[date].meals.includes(log.mealType)) {
        acc[date].meals.push(log.mealType);
      }
      
      return acc;
    }, {});

    // Calculate averages and trends
    const dates = Object.keys(dailyMetrics);
    const trends = {
      caloriesTrend: calculateTrend(dates.map(date => dailyMetrics[date].calories)),
      proteinTrend: calculateTrend(dates.map(date => dailyMetrics[date].protein)),
      carbsTrend: calculateTrend(dates.map(date => dailyMetrics[date].carbs)),
      fatsTrend: calculateTrend(dates.map(date => dailyMetrics[date].fats)),
    };

    // Get user's goals and details from RegularUser
    const regularUser = await RegularUser.findOne({ UserId: userId });
    if (!regularUser) {
      return res.status(404).json({ message: "Regular user profile not found" });
    }

    // Calculate daily averages
    const averageMetrics = {
      calories: parseFloat(calculateAverage(dates.map(date => dailyMetrics[date].calories))),
      protein: parseFloat(calculateAverage(dates.map(date => dailyMetrics[date].protein))),
      carbs: parseFloat(calculateAverage(dates.map(date => dailyMetrics[date].carbs))),
      fats: parseFloat(calculateAverage(dates.map(date => dailyMetrics[date].fats)))
    };

    // Calculate goal percentages
    const goalProgress = calculateGoalPercentages(averageMetrics, {
      goalCalories: regularUser.goalCalories,
      macros: regularUser.macros
    });

    // Calculate BMR and TDEE achievement
    const energyMetrics = {
      bmr: {
        target: parseFloat(regularUser.bmr),
        current: averageMetrics.calories,
        percentage: ((averageMetrics.calories / parseFloat(regularUser.bmr)) * 100).toFixed(1)
      },
      tdee: {
        target: parseFloat(regularUser.tdee),
        current: averageMetrics.calories,
        percentage: ((averageMetrics.calories / parseFloat(regularUser.tdee)) * 100).toFixed(1)
      }
    };

    // Add nutritional recommendations based on goals
    const recommendations = [];
    if (goalProgress.protein.percentage < 80) {
      recommendations.push({
        type: 'protein',
        message: `You're only reaching ${goalProgress.protein.percentage}% of your protein goal`,      });
    }
    if (goalProgress.calories.percentage < 90) {
      recommendations.push({
        type: 'calories',
        message: `You're under your calorie goal by ${(regularUser.goalCalories - averageMetrics.calories).toFixed(0)} calories`,
      });
    }

    const metricInsights = generateMetricBasedInsights(goalProgress, regularUser.goals, trends);

    res.json({
      success: true,
      data: {
        dailyMetrics,
        trends,
        summary: {
          averageCalories: averageMetrics.calories,
          averageProtein: averageMetrics.protein,
          averageCarbs: averageMetrics.carbs,
          averageFats: averageMetrics.fats,
          totalDays: dates.length,
          bestDay: findBestDay(dailyMetrics)
        },
        goals: {
          current: regularUser.goals,
          progress: goalProgress,
          energy: energyMetrics,
          insights: metricInsights
        },
        userMetrics: {
          weight: regularUser.weight,
          goalWeight: regularUser.goalWeight,
          bmi: regularUser.bmi,
          activityLevel: regularUser.activityLevel
        }
      }
    });

  } catch (error) {
    console.error('Error generating progress insights:', error);
    res.status(500).json({ 
      success: false,
      message: "Error generating progress insights", 
      error: error.message 
    });
  }
});

// Helper functions
function calculateTrend(values) {
  const n = values.length;
  if (n < 2) return 0;
  
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += Math.pow(i - xMean, 2);
  }
  
  return denominator === 0 ? 0 : numerator / denominator;
}

function calculateAverage(values) {
  return values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : 0;
}

function findBestDay(metrics) {
  return Object.entries(metrics).reduce((best, [date, data]) => {
    const score = (data.protein * 4 + data.carbs * 4 + data.fats * 9) / data.calories;
    return (!best.score || score > best.score) ? { date, score } : best;
  }, { score: 0, date: null });
}

// Add this function to generate metric-based insights
function generateMetricBasedInsights(metrics, goals, trends) {
  const insights = [];
  
  // Calorie insights
  if (metrics.calories.percentage < 85) {
    insights.push({
      type: 'calories',
      message: `You're at ${metrics.calories.percentage}% of your daily calorie goal. Consider increasing your food intake.`
    });
  } else if (metrics.calories.percentage > 115) {
    insights.push({
      type: 'calories',
      message: `You're exceeding your calorie goal by ${(metrics.calories.current - metrics.calories.goal).toFixed(0)} calories.`
    });
  }

  // Protein insights
  if (metrics.protein.percentage < 80) {
    insights.push({
      type: 'protein',
      message: `Protein intake is at ${metrics.protein.percentage}% of your daily goal (${metrics.protein.goal}g).`
    });
  }

  // Carbs insights
  if (metrics.carbs.percentage < 80) {
    insights.push({
      type: 'carbs',
      message: `Carbohydrate intake is at ${metrics.carbs.percentage}% of your target (${metrics.carbs.goal}g).`
    });
  }

  // Fats insights
  if (metrics.fats.percentage < 80) {
    insights.push({
      type: 'fats',
      message: `Fat intake is at ${metrics.fats.percentage}% of your daily goal (${metrics.fats.goal}g).`
    });
  }

  // Trend-based insights
  if (trends.caloriesTrend > 0) {
    insights.push({
      type: 'trend',
      message: `Your calorie intake shows an upward trend over the selected period.`
    });
  }

  if (trends.proteinTrend < 0) {
    insights.push({
      type: 'trend',
      message: `Your protein intake has been decreasing. Focus on maintaining consistent protein intake.`
    });
  }

  return insights;
}

function calculateImprovement(metrics, trends) {
  const improvements = [];
  
  if (trends.caloriesTrend > 0) improvements.push("Calorie intake is improving");
  if (trends.proteinTrend > 0) improvements.push("Protein intake is increasing");
  if (trends.carbsTrend < 0) improvements.push("Carb management is improving");
  
  return improvements;
}

// Add helper function to calculate goal percentages
function calculateGoalPercentages(metrics, userGoals) {
  const {
    goalCalories,
    macros: { protein: proteinGoal, carbs: carbsGoal, fats: fatsGoal }
  } = userGoals;

  return {
    calories: {
      goal: parseFloat(goalCalories),
      current: metrics.calories,
      percentage: ((metrics.calories / parseFloat(goalCalories)) * 100).toFixed(1)
    },
    protein: {
      goal: parseFloat(proteinGoal),
      current: metrics.protein,
      percentage: ((metrics.protein / parseFloat(proteinGoal)) * 100).toFixed(1)
    },
    carbs: {
      goal: parseFloat(carbsGoal),
      current: metrics.carbs,
      percentage: ((metrics.carbs / parseFloat(carbsGoal)) * 100).toFixed(1)
    },
    fats: {
      goal: parseFloat(fatsGoal),
      current: metrics.fats,
      percentage: ((metrics.fats / parseFloat(fatsGoal)) * 100).toFixed(1)
    }
  };
}

// DELETE: Remove a food log
router.delete("/:id", async (req, res) => {
  try {
    await FoodLog.findByIdAndDelete(req.params.id);
    res.json({ message: "Food log deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting food log", error });
  }
});

module.exports = router;
