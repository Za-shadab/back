const express = require("express");
const router = express.Router();
const MealPlan = require("../models/dietPlan.model");
const RegularUser = require("../models/regularUser.model");
const ClientUser = require("../models/clientUser.model");
const Nutritionist = require("../models/Nutritionist.model");


router.post('/swap-meal', async (req, res) => {
  try {
    const { userId, oldRecipeId, newRecipeId, mealType, newRecipe, nutritionistId } = req.body;
    
    console.log('Received swap request:', {
      userId,
      oldRecipeId,
      newRecipeId,
      mealType,
      nutritionistId
    });

    // Find the active meal plan
    const mealPlan = await MealPlan.findOne({
      userId,
      nutritionistId,
      isActive: true
    }).sort({ createdAt: -1 });

    console.log('Found meal plan:', nutritionistId);
    console.log('Meal plan details:', userId, mealType);
    

    if (!mealPlan) {
      return res.status(404).json({
        success: false,
        message: 'No active meal plan found'
      });
    }

    // Find all breakfast meals for the given mealType
    const mealsOfType = mealPlan.meals.filter(meal => meal.mealType === mealType);
    
    if (mealsOfType.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No meals found of type ${mealType}`
      });
    }

    // Find the specific meal to update
    const mealIndex = mealPlan.meals.findIndex(meal => 
      meal.mealType === mealType && 
      (meal.recipe?.id === oldRecipeId || meal.dayNumber === 1)
    );

    if (mealIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Meal not found in plan',
        details: {
          searchedFor: { mealType, oldRecipeId },
          availableMeals: mealPlan.meals.map(m => ({
            type: m.mealType,
            recipeId: m.recipe?.id,
            dayNumber: m.dayNumber
          }))
        }
      });
    }

    // Update the recipe
    mealPlan.meals[mealIndex].recipe = {
      id: newRecipeId,
      label: newRecipe.label,
      image: newRecipe.image,
      calories: newRecipe.calories,
      serving: newRecipe.serving,
      ingredientsLines: newRecipe.ingredientsLines || [],
      nutrients: newRecipe.nutrients || [],
      url: newRecipe.url,
      cautions: newRecipe.cautions || []
    };

    // Save the updated plan
    await mealPlan.save();

    res.json({
      success: true,
      message: 'Meal swapped successfully',
      updatedMeal: mealPlan.meals[mealIndex]
    });

  } catch (error) {
    console.error('Error swapping meal:', error);
    res.status(500).json({
      success: false,
      message: 'Error swapping meal',
      error: error.message
    });
  }
});

// Add new route to fetch meal plans
router.get('/fetch-mealplans', async (req, res) => {
  try {
    const { userId, nutritionistId } = req.query;
    console.log('Fetching meal plans:', { userId, nutritionistId });

    // First, fetch the user profile (same as before)
    let user = await RegularUser.findById(userId);
    if (!user) {
      user = await ClientUser.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    }

    // Find all active meal plans for the user (same as before)
    const mealPlans = await MealPlan.find({
      userId: userId,
      nutritionistId: nutritionistId,
      isActive: true
    })
    .sort({ createdAt: -1 })
    .select({
      meals: 1,
      startDate: 1,
      endDate: 1,
      createdAt: 1,
      updatedAt: 1
    });

    if (!mealPlans || mealPlans.length === 0) {
      console.log('No meal plans found:', {
        userId,
        nutritionistId,
        isActive: true
      });
      return res.status(404).json({
        success: false,
        message: 'No active meal plans found'
      });
    }

    // Format the meal plan - Use only the most recent one to match generate structure
    const latestMealPlan = mealPlans[0];
    
    // Format the meals the same way as in generate endpoint
    const formattedMeals = latestMealPlan.meals.map(meal => {
      // Skip meals with invalid data
      if (!meal?.mealType || !meal?.recipe) {
        console.warn('Invalid meal data:', meal);
        return null;
      }

      return {
        mealType: meal.mealType,
        recipe: {
          id: meal.recipe?.id || `temp-${Date.now()}`,
          label: meal.recipe?.label || 'Untitled Recipe',
          image: meal.recipe?.image || null,
          calories: meal.recipe?.calories || 0, // Keep as number instead of string
          serving: meal.recipe?.serving || 1,   // Keep as number
          ingredientsLines: Array.isArray(meal.recipe?.ingredientsLines) 
            ? meal.recipe.ingredientsLines 
            : [],
          nutrients: Array.isArray(meal.recipe?.nutrients) 
            ? meal.recipe.nutrients 
            : [],
          url: meal.recipe?.url || '',
          cautions: Array.isArray(meal.recipe?.cautions) 
            ? meal.recipe.cautions 
            : []
        },
        alternateRecipes: Array.isArray(meal.alternateRecipes) 
          ? meal.alternateRecipes.map(alt => ({
              id: alt?.id || `alt-${Date.now()}`,
              label: alt?.label || 'Alternative Recipe',
              image: alt?.image || null,
              calories: alt?.calories || 0,     // Keep as number
              serving: alt?.serving || 1,       // Keep as number
              ingredientsLines: Array.isArray(alt?.ingredientsLines) 
                ? alt.ingredientsLines 
                : [],
              nutrients: Array.isArray(alt?.nutrients) 
                ? alt.nutrients 
                : [],
              url: alt?.url || '',
              cautions: Array.isArray(alt?.cautions) 
                ? alt.cautions 
                : []
            }))
          : [],
        dayNumber: meal.dayNumber || 1,
        date: meal.date || new Date()
      };
    }).filter(Boolean); // Remove any null meals

    // Format the response to match generate meal plan
    res.json({
      success: true,
      mealPlan: {  // Change to single mealPlan object instead of mealPlans array
        _id: latestMealPlan._id,
        userId: userId,
        nutritionistId: nutritionistId,
        meals: formattedMeals,
        startDate: latestMealPlan.startDate || new Date(),
        endDate: latestMealPlan.endDate || new Date(),
        isActive: true,
        createdAt: latestMealPlan.createdAt,
        updatedAt: latestMealPlan.updatedAt
      },
      userProfile: {
        type: user.type || 'regular',
        goalCalories: user.goalCalories || 2000, // Keep as number
        macros: {
          protein: user.macros?.protein || 0,  // Keep as number
          carbs: user.macros?.carbs || 0,      // Keep as number
          fats: user.macros?.fats || 0         // Keep as number
        }
      }
    });

  } catch (error) {
    console.error('Error fetching meal plans:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching meal plans',
      error: error.message
    });
  }
});

router.get('/fetch-multiday-mealplans', async (req, res) => {
  try {
    const { userId, nutritionistId } = req.query;
    console.log('Fetching meal plans:', { userId, nutritionistId });

    // First, fetch the user profile
    let user = await RegularUser.findById(userId);
    if (!user) {
      user = await ClientUser.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
    }

    // Find all active meal plans for the user
    const mealPlans = await MealPlan.find({
      userId: userId,
      nutritionistId: nutritionistId,
      isActive: true
    })
    .sort({ createdAt: -1 })
    .select({
      meals: 1,
      startDate: 1,
      endDate: 1,
      createdAt: 1,
      updatedAt: 1
    });

    if (!mealPlans || mealPlans.length === 0) {
      console.log('No meal plans found:', {
        userId,
        nutritionistId,
        isActive: true
      });
      return res.status(404).json({
        success: false,
        message: 'No active meal plans found'
      });
    }

    // Use only the most recent meal plan
    const latestMealPlan = mealPlans[0];
    
    // Format the meals to match the generate endpoint's response
    const formattedMeals = latestMealPlan.meals.filter(meal => 
      meal?.mealType && meal?.recipe
    );

    // Calculate number of days based on unique dayNumber values
    const days = [...new Set(formattedMeals.map(meal => meal.dayNumber || 1))].length;
    
    // Return response in exactly the same format as the meal plan generator
    res.json({ 
      success: true,
      mealPlan: {
        _id: latestMealPlan._id,
        userId: userId,
        nutritionistId: nutritionistId,
        meals: formattedMeals.map(meal => ({
          mealType: meal.mealType,
          recipe: {
            id: meal.recipe?.id || `temp-${Date.now()}`,
            label: meal.recipe?.label || 'Untitled Recipe',
            image: meal.recipe?.image || null,
            calories: meal.recipe?.calories || 0,
            serving: meal.recipe?.serving || 1,
            ingredientsLines: Array.isArray(meal.recipe?.ingredientsLines) 
              ? meal.recipe.ingredientsLines 
              : [],
            nutrients: Array.isArray(meal.recipe?.nutrients) 
              ? meal.recipe.nutrients 
              : [],
            url: meal.recipe?.url || '',
            cautions: Array.isArray(meal.recipe?.cautions) 
              ? meal.recipe.cautions 
              : []
          },
          alternateRecipes: Array.isArray(meal.alternateRecipes) 
            ? meal.alternateRecipes.map(alt => ({
                id: alt?.id || `alt-${Date.now()}`,
                label: alt?.label || 'Alternative Recipe',
                image: alt?.image || null,
                calories: alt?.calories || 0,
                serving: alt?.serving || 1,
                ingredientsLines: Array.isArray(alt?.ingredientsLines) 
                  ? alt.ingredientsLines 
                  : [],
                nutrients: Array.isArray(alt?.nutrients) 
                  ? alt.nutrients 
                  : [],
                url: alt?.url || '',
                cautions: Array.isArray(alt?.cautions) 
                  ? alt.cautions 
                  : []
              }))
            : [],
          dayNumber: meal.dayNumber || 1,
          date: meal.date || new Date()
        })),
        startDate: latestMealPlan.startDate || new Date(),
        endDate: latestMealPlan.endDate || new Date(),
        isActive: true,
        createdAt: latestMealPlan.createdAt,
        updatedAt: latestMealPlan.updatedAt
      },
      numberOfDays: days,
      userProfile: {
        type: user.type || 'regular',
        goalCalories: user.goalCalories || 2000,
        macros: {
          protein: user.macros?.protein || 0,
          carbs: user.macros?.carbs || 0,
          fats: user.macros?.fats || 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching meal plans:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching meal plans',
      error: error.message
    });
  }
});

module.exports = router;