const express = require('express');
const router = express.Router();
const MealPlan = require('../../models/dietPlan.model');

// Route to fetch meal plan by clientId
router.get('/:clientId', async (req, res) => {
  const { clientId } = req.params;

  try {
    console.log('Fetching meal plan for clientId:', clientId);
    
    // Add lean() to get plain JavaScript objects
    // Add sort to get the latest meal plan
    const mealPlan = await MealPlan.findOne({ 
      userId: clientId,
      isActive: true // Ensure we're getting the active meal plan
    })
    .sort({ updatedAt: -1 }) // Get the most recently updated plan
    .lean(); // Convert to plain JavaScript object

    if (!mealPlan) {
      return res.status(404).json({ message: 'Meal plan not found' });
    }

    // Log the meal plan details for debugging
    console.log('Found meal plan:', {
      id: mealPlan._id,
      updatedAt: mealPlan.updatedAt,
      meals: mealPlan.meals.map(meal => ({
        mealType: meal.mealType,
        recipeId: meal.recipe.id
      }))
    });

    res.status(200).json({ mealPlan });
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;