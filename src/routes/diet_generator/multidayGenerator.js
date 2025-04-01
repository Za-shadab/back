const axios = require('axios');
const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const mongoose = require('mongoose');
const RegularUser = require('../../models/regularUser.model');
const ClientUser = require('../../models/clientUser.model');
const UserRecipeHistory = require('../../models/recipeHistory.model');
const { calculateRecipeScore } = require('../../utils/generator/scoring');
const calculateServingSize = require('../../utils/generator/servingSize');
const extractNutrientValues = require('../../utils/generator/extractNutrient');
const predictGlycemicIndices = require('../../utils/GIGL/predictor');
const Simplifyname = require('../../utils/generator/simplifyname');
const MealPlan = require('../../models/dietPlan.model');

/**
 * Fetches previously served recipes for a user to avoid repetition
 * @param {string} userId - The user ID
 * @param {number} daysLookback - Number of days to look back in history
 * @returns {Array} Array of recipe IDs
 */
async function getPreviousRecipes(userId, daysLookback = 14) {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysLookback);
        
        const history = await UserRecipeHistory.find({
            userId: userId,
            servedDate: { $gte: cutoffDate }
        });
        
        return history.map(entry => entry.recipeId);
    } catch (error) {
        console.error('Error fetching recipe history:', error);
        return [];
    }
}

/**
 * Records a recipe as served to a user
 * @param {string} userId - The user ID
 * @param {string} recipeId - The recipe ID
 * @param {string} mealType - The meal type
 * @param {number} dayNumber - The day for which recipe is served (1-7)
 */
async function recordRecipeServed(userId, recipeId, mealType, dayNumber) {
    try {
        // Create future date for the planned recipe
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + (dayNumber - 1));
        
        await UserRecipeHistory.create({
            userId,
            recipeId,
            mealType,
            servedDate: futureDate,
            dayNumber
        });
    } catch (error) {
        console.error('Error recording recipe history:', error);
    }
}

/**
 * Scales ingredients with Gemini AI
 * @param {Array} ingredients - Original ingredient list
 * @param {number} originalServing - Original serving size
 * @param {number} desiredServing - Desired serving size
 * @returns {Array} Scaled ingredients
 */
async function scaleIngredients(ingredients, originalServing, desiredServing) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const prompt = `
            Scale the following ingredients proportionally based on the given serving size.  
            - Keep ingredient names **exactly as they are**.  
            - Convert quantities **logically and accurately** (avoid excessive fractions).  
            - Maintain the **original format** with units like "cups," "tsp," "Tbsp," etc.  
            - Return the result as a JSON array with scaled quantities and no additional sentences.  

            Ingredients:  
            ${ingredients.join("\n")}  

            Output format:  

            {
            "scaledIngredients": [
                "1 1/3 cups almond milk",
                "1/2 chai tea bag",
                "1 Tbsp cocoa powder",
                "1 Tbsp sugar",
                "1/8 tsp vanilla"
            ]
            }
        `;
        
        const result = await model.generateContent(prompt);
        const response = result.response.text();
        const cleanedResponse = response.replace(/```json|```/g, ''); // Remove markdown code blocks
        
        try {
            return JSON.parse(cleanedResponse).scaledIngredients;
        } catch (error) {
            console.error('Error parsing scaled ingredients:', error);
            return ingredients; // Return original if parsing fails
        }
    } catch (error) {
        console.error('Error scaling ingredients with Gemini:', error);
        return ingredients; // Return original on any error
    }
}

/**
 * Fetches a user by ID from either RegularUser or ClientUser collection
 * @param {string} userId - The user ID
 * @returns {Object} User object or null
 */
async function fetchUserById(userId) {
    let user = await RegularUser.findById(userId).populate('UserId');
    if (!user) {
        user = await ClientUser.findById(userId).populate('UserId');
    }
    return user;
}

/**
 * Determines meal distribution based on user type
 * @param {string} userType - Type of user (regular, diabetes, pcos)
 * @param {Object} userPreferences - User's meal distribution preferences
 * @returns {Object} Meal distribution object
 */
function getMealDistribution(userType, userPreferences = null) {
    const defaultDistribution = userType === 'regular' 
        ? {
            Breakfast: 0.25,
            Lunch: 0.30,
            Dinner: 0.30,
            Snack: 0.15
        } 
        : {
            Breakfast1: 0.125,
            Breakfast2: 0.125,
            Lunch: 0.15,
            Teatime: 0.15,
            Dinner1: 0.15,
            Dinner2: 0.15,
            Snack: 0.15
        };
        
    // Merge with user preferences if available
    return userPreferences ? { ...defaultDistribution, ...userPreferences } : defaultDistribution;
}

/**
 * Configures meal types based on user type and calorie distribution
 * @param {string} userType - Type of user
 * @param {Object} mealDistribution - Meal distribution object
 * @param {number} goalCalories - User's calorie goal
 * @returns {Array} Configured meal types
 */
function configureMealTypes(userType, mealDistribution, goalCalories) {
    // Add default values to prevent NaN
    if (userType === 'regular') {
        return [
            { api_key: process.env.EDAMAM_API_KEY_ONE, api_id: process.env.EDAMAM_API_ID_ONE, mealType: 'Breakfast', calories: Math.round(goalCalories * (mealDistribution.Breakfast || 0.25)) },
            { api_key: process.env.EDAMAM_API_KEY_SIX, api_id: process.env.EDAMAM_API_ID_SIX, mealType: 'Lunch', calories: Math.round(goalCalories * (mealDistribution.Lunch || 0.30)) },
            { api_key: process.env.EDAMAM_API_KEY_NINE, api_id: process.env.EDAMAM_API_ID_NINE, mealType: 'Dinner', calories: Math.round(goalCalories * (mealDistribution.Dinner || 0.30)) },
            { api_key: process.env.EDAMAM_API_KEY_TEN, api_id: process.env.EDAMAM_API_ID_TEN, mealType: 'Snack', calories: Math.round(goalCalories * (mealDistribution.Snack || 0.15)) }
        ];
    } else if(userType === 'Diabetes' || userType === 'PCOS') {
        return [
            { api_key: process.env.EDAMAM_API_KEY_ONE, api_id: process.env.EDAMAM_API_ID_ONE, mealType: 'Breakfast', calories: Math.round(goalCalories * (mealDistribution.Breakfast1 || 0.125)), dishType: 'Cereals' },
            { api_key: process.env.EDAMAM_API_KEY_TWO, api_id: process.env.EDAMAM_API_ID_TWO, mealType: 'Breakfast', calories: Math.round(goalCalories * (mealDistribution.Breakfast2 || 0.125)) },
            { api_key: process.env.EDAMAM_API_KEY_NINE, api_id: process.env.EDAMAM_API_ID_NINE, mealType: 'Snack', calories: Math.round(goalCalories * (mealDistribution.Snack || 0.15)) },
            { api_key: process.env.EDAMAM_API_KEY_SEVEN, api_id: process.env.EDAMAM_API_ID_SEVEN, mealType: 'Lunch', calories: Math.round(goalCalories * (mealDistribution.Lunch || 0.15))},
            { api_key: process.env.EDAMAM_API_KEY_SIX, api_id: process.env.EDAMAM_API_ID_SIX, mealType: 'Teatime', calories: Math.round(goalCalories * (mealDistribution.Teatime || 0.15)), dishType: 'Drinks' },
            { api_key: process.env.EDAMAM_API_KEY_TEN, api_id: process.env.EDAMAM_API_ID_TEN, mealType: 'Dinner', calories: Math.round(goalCalories * (mealDistribution.Dinner1 || 0.15)), dishType: 'Main course' },
            { api_key: process.env.EDAMAM_API_KEY_EIGHT, api_id: process.env.EDAMAM_API_ID_EIGHT, mealType: 'Dinner', calories: Math.round(goalCalories * (mealDistribution.Dinner2 || 0.15)) }
        ];
    }
}

/**
 * Creates a user profile for recipe scoring
 * @param {Object} user - User object
 * @param {string} userType - Type of user
 * @returns {Object} User profile for scoring
 */
function createUserProfile(user, userType) {
    return {
        type: userType,
        targetCalories: user.goalCalories,
        targetMacros: {
            protein: user.macros.protein,
            carbs: user.macros.carbs,
            fat: user.macros.fats
        },
        targetCarbDist: {
            sugar: userType === 'Diabetes' || userType === 'PCOS' ? 5 : 15
        },
        targetGI: userType === 'Diabetes' ? 40 : userType === 'PCOS' ? 45 : 55,
        targetGL: userType === 'Diabetes' ? 10 : userType === 'PCOS' ? 15 : 20
    };
}

/**
 * Fetches and scores recipes for a meal
 * @param {Object} meal - Meal configuration
 * @param {Object} userProfile - User profile for scoring
 * @param {Array} previousRecipes - Previously served recipes
 * @param {Array} dietaryPreferences - Dietary preferences
 * @param {number} dayIndex - The current day index for variety control
 * @param {number} maxPages - Maximum number of pages to fetch (default: 1)
 * @returns {Object} Meal data with scored recipes
 */
async function fetchAndScoreRecipes(meal, userProfile, previousRecipes, dietaryPreferences = [], dayIndex = 0, maxPages = 2) {
    try {
        const apiUrl = 'https://api.edamam.com/api/recipes/v2';
        
        // Prepare query parameters
        const params = {
            type: 'public',
            app_id: meal.api_id,
            app_key: meal.api_key,
            mealType: meal.mealType,
            calories: `${Math.max(meal.calories - 100, 0)}-${meal.calories + 300}`,
            random: true // Request random results for more variety across days
        };
        
        const mealCalorieRatio = meal.calories / userProfile.targetCalories;
        
        // Add dietary preferences if available
        if (dietaryPreferences.length > 0) {
            params.health = dietaryPreferences.join('&health=');
        }
        
        // Add dish type if specified
        if (meal.dishType) {
            params.dishType = meal.dishType;
        }
        
        // Array to collect all recipes
        let allRecipes = [];
        let nextPageUrl = null;
        let currentPage = 0;
        
        // Score threshold configuration
        const minScoreThreshold = 85; // Set to 85% match as threshold
        const minHighScoringRecipes = 5; // Need at least 5 good recipes
        let highScoringRecipesCount = 0;
        
        // Rate limiting settings
        const delayBetweenRequests = 1000; // 1 second delay between requests
        const maxRetries = 3;
        const retryDelay = 5000; // 5 seconds initial retry delay
        
        // Helper function to make API request with retry logic
        const makeRequestWithRetry = async (url, requestParams = null) => {
            let retries = 0;
            
            while (retries <= maxRetries) {
                try {
                    // If this isn't the first request, delay to avoid rate limiting
                    if (currentPage > 0 || retries > 0) {
                        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
                    }
                    
                    // Make the request (either with URL or params)
                    const response = requestParams 
                        ? await axios.get(url, { params: requestParams })
                        : await axios.get(url);
                        
                    return response;
                } catch (error) {
                    // If we got a 429 error (too many requests)
                    if (error.response && error.response.status === 429) {
                        retries++;
                        const backoffDelay = retryDelay * Math.pow(2, retries - 1); // Exponential backoff
                        console.log(`Rate limit hit for ${meal.mealType} on day ${dayIndex + 1}. Retry ${retries}/${maxRetries} after ${backoffDelay}ms delay`);
                        
                        if (retries <= maxRetries) {
                            // Wait longer before retrying
                            await new Promise(resolve => setTimeout(resolve, backoffDelay));
                        } else {
                            throw new Error('Max retries reached for rate limit');
                        }
                    } else {
                        // For other errors, don't retry
                        throw error;
                    }
                }
            }
        };
        
        // Initial API call
        let response = await makeRequestWithRetry(apiUrl, params);
        
        // Process recipes and collect pagination info
        while (response.data.hits && response.data.hits.length > 0 && currentPage < maxPages) {
            currentPage++;
            console.log(`Processing page ${currentPage} for ${meal.mealType} on day ${dayIndex + 1}`);
            
            // Score the recipes from this page
            const pageRecipes = response.data.hits;
            const scoredPageRecipes = await Promise.all(
                pageRecipes.map(async ({ recipe }) => {
                    // Extract basic nutrient values
                    const recipeData = extractNutrientValues(recipe);
                    
                    // For diabetes and pcos users, predict GI and GL
                    if (userProfile.type === 'diabetes' || userProfile.type === 'pcos') {
                        const { predictedGI, predictedGL } = await predictGlycemicIndices(recipe, userProfile.type);
                        recipeData.predictedGI = predictedGI;
                        recipeData.predictedGL = predictedGL;
                    }
                    
                    // Calculate score based on user profile
                    const scoredRecipe = calculateRecipeScore(recipeData, userProfile, mealCalorieRatio);
                    
                    // Add recipe ID and other metadata
                    return {
                        ...scoredRecipe,
                        id: recipe.uri.split('#recipe_')[1],
                        fullRecipe: recipe
                    };
                })
            );
            
            // Add scored recipes to our collection
            allRecipes = [...allRecipes, ...scoredPageRecipes];
            
            // Count high-scoring recipes that haven't been served before
            const newHighScoringRecipes = scoredPageRecipes.filter(recipe => {
                return recipe.score >= minScoreThreshold && !previousRecipes.includes(recipe.id);
            });
            
            highScoringRecipesCount += newHighScoringRecipes.length;
            
            console.log(`Page ${currentPage}: Found ${newHighScoringRecipes.length} high-scoring recipes for ${meal.mealType} on day ${dayIndex + 1} (total: ${highScoringRecipesCount})`);
            
            // If we've found enough high-scoring recipes, stop fetching more pages
            if (highScoringRecipesCount >= minHighScoringRecipes) {
                console.log(`Found ${highScoringRecipesCount} high-scoring recipes (score ≥ ${minScoreThreshold}) for ${meal.mealType} on day ${dayIndex + 1}, stopping pagination`);
                break;
            }
            
            // Check for next page link
            if (response.data._links && response.data._links.next && response.data._links.next.href) {
                nextPageUrl = response.data._links.next.href;
                
                // Make request to the next page with retry logic
                response = await makeRequestWithRetry(nextPageUrl);
            } else {
                // No more pages
                console.log(`No more pages available for ${meal.mealType} on day ${dayIndex + 1}`);
                break;
            }
        }
        
        console.log(`Fetched a total of ${allRecipes.length} recipes for ${meal.mealType} on day ${dayIndex + 1} across ${currentPage} pages`);
        
        if (allRecipes.length > 0) {
            // Filter out previously served recipes
            const newRecipes = allRecipes.filter(recipe => 
                !previousRecipes.includes(recipe.id)
            );
            
            console.log(`Found ${newRecipes.length} new recipes (not previously served) for ${meal.mealType} on day ${dayIndex + 1}`);
            
            // Sort by score (highest first)
            const sortedRecipes = (newRecipes.length > 0 ? newRecipes : allRecipes)
                .sort((a, b) => b.score - a.score);
            
            // Log top scores for debugging
            const topRecipes = sortedRecipes.slice(0, 3);
            console.log(`Top 3 recipes for ${meal.mealType} on day ${dayIndex + 1}:`);
            topRecipes.forEach((recipe, idx) => {
                console.log(`  ${idx+1}. ${recipe.fullRecipe.label} (Score: ${recipe.score})`);
            });
            
            return {
                mealType: meal.mealType,
                recipes: sortedRecipes,
                requiredCalories: meal.calories,
                dayIndex
            };
        } else {
            console.log(`No recipes found for ${meal.mealType} on day ${dayIndex + 1}`);
            return {
                mealType: meal.mealType,
                recipes: [],
                requiredCalories: meal.calories,
                dayIndex
            };
        }
    } catch (error) {
        console.error(`Error fetching recipes for ${meal.mealType} on day ${dayIndex + 1}:`, error);
        return {
            mealType: meal.mealType,
            recipes: [],
            requiredCalories: meal.calories,
            dayIndex,
            error: error.message
        };
    }
}

/**
 * Formats a meal with selected recipe and alternatives
 * @param {Object} mealData - Meal data with recipes
 * @param {string} userId - User ID for recording served recipes
 * @param {number} dayNumber - The day number (1-7)
 * @returns {Object} Formatted meal data
 */
async function formatMealWithRecipe(mealData, userId, dayNumber) {
    // Keep only the first definition of convertFractionToDecimal
    const convertFractionToDecimal = (fraction) => {
        if (typeof fraction === 'number') return fraction;
        if (typeof fraction !== 'string') return 1;
        
        const parts = fraction.split(/\s+/);
        let total = 0;
        
        parts.forEach(part => {
            if (part.includes('/')) {
                const [num, denom] = part.split('/');
                total += Number(num) / Number(denom);
            } else {
                total += Number(part) || 0;
            }
        });
        
        return total || 1;
    };

    if (!mealData.recipes || mealData.recipes.length === 0) {
        return { mealType: mealData.mealType, day: dayNumber, recipe: null };
    }
    
    // Get top recipe
    const recipeIndex = mealData.mealType === "Dinner" && mealData.recipes.length > 1 ? 1 : 0;
    const topRecipe = mealData.recipes[recipeIndex].fullRecipe;
    const recipeId = mealData.recipes[recipeIndex].id;
    
    // Calculate serving size adjustment
    const defaultYield = topRecipe.yield || 1;
    const defaultCalories = topRecipe.calories || 1;
    const requiredCalories = mealData.requiredCalories;
    const desiredServingSize = defaultCalories > 0 ? requiredCalories / defaultCalories : 1;
    const adjustedSizes = calculateServingSize(desiredServingSize);
    
    // Scale nutrients
    const calculatedNutrients = Object.entries(topRecipe.totalNutrients || {}).map(([key, value]) => ({
        label: value.label,
        value: ((value.quantity || 0) * desiredServingSize).toFixed(1),
        unit: value.unit
    }));
    
    // Scale ingredients
    const adjustedIngredients = topRecipe.ingredients.map(ingredient => ({
        text: ingredient.text,
        quantity: (ingredient.quantity || 1) * desiredServingSize,
        measure: ingredient.measure,
        food: ingredient.food,
        image: ingredient.image,
    }));
    
    // Set scaled ingredients
    const adjustedIngredientsLines = await scaleIngredients(
        topRecipe.ingredientLines,
        defaultYield,
        desiredServingSize
    );
    
    // Process alternate recipes (top 10 alternatives like in generator.js)
    const alternateRecipesData = mealData.recipes
        .filter((_, index) => index !== recipeIndex)
        .slice(0, 10);
    
    // Update the alternateRecipes structure to match single-day format
    const alternateRecipes = await Promise.all(alternateRecipesData.map(async (scoredRecipe) => {
        const recipe = scoredRecipe.fullRecipe;
        const altServingSize = requiredCalories / (recipe.calories || 1);
        const altAdjustedSize = calculateServingSize(altServingSize);
        
        // Scale ingredients for alternate recipe
        const altAdjustedIngredientsLines = await scaleIngredients(
            recipe.ingredientLines,
            recipe.yield || 1,
            altServingSize * (recipe.yield || 1)
        );
        
        const altScalingFactor = altServingSize;
        return {
            id: scoredRecipe.id,
            score: scoredRecipe.score,
            label: await Simplifyname(recipe.label),
            url: recipe.url,
            calories: ((recipe.calories || 1) * altScalingFactor).toFixed(0),
            nutrients: calculatedNutrients,
            serving: altAdjustedSize,
            image: recipe.image,
            ingredientsLines: altAdjustedIngredientsLines,
            cautions: recipe.cautions || [],
            predictedGI: scoredRecipe.predictedGI,
            predictedGL: scoredRecipe.predictedGL
        };
    }));

    // Record that this recipe was served to this user for this day
    await recordRecipeServed(userId, recipeId, mealData.mealType, dayNumber);
    
    // Use the existing convertFractionToDecimal function
    const adjustedSize = convertFractionToDecimal(calculateServingSize(desiredServingSize));

    // Ensure label is resolved before returning
    const simplifiedLabel = await Promise.resolve(Simplifyname(topRecipe.label));

    return {
        mealType: mealData.mealType,
        day: dayNumber,
        recipe: {
            id: recipeId,
            label: simplifiedLabel,
            url: topRecipe.url,
            score: mealData.recipes[recipeIndex].score,
            calories: ((topRecipe.calories || 1) * desiredServingSize).toFixed(0),
            nutrients: calculatedNutrients,
            image: topRecipe.image,
            serving: adjustedSize,
            ingredients: adjustedIngredients,
            ingredientsLines: adjustedIngredientsLines,
            cautions: topRecipe.cautions || [],
            predictedGI: mealData.recipes[recipeIndex].predictedGI,
            predictedGL: mealData.recipes[recipeIndex].predictedGL
        },
        alternateRecipes, // Now alternateRecipes is a direct array
        dayNumber,
        date: new Date(new Date().setDate(new Date().getDate() + (dayNumber - 1)))
    };
}

// Main route handler for multi-day meal planning
router.post('/mealplan', async (req, res) => {
    const { 
        userId,
        nutritionistId,
        dietaryPreferences = [], 
        healthLabels = [], 
        excludedIngredients = [],
        numberOfDays = 1, // Default to 1 day if not specified
        maxPagesPerMeal = 2 // Default number of pages to fetch per meal type
    } = req.body;
    
    // Validate parameters
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid User ID format" });
    }
    
    // Limit number of days to max 7
    const days = Math.min(Math.max(numberOfDays, 1), 7);
    
    try {
        // Fetch user data
        const user = await fetchUserById(userId);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Determine user type (regular, diabetes, pcos)
        const userType = user.healthConditions?.includes('Diabetes') ? 'Diabetes' : 
                         user.healthConditions?.includes('PCOS') ? 'PCOS' : 'regular';
        
        // Setup meal distribution
        const mealDistribution = getMealDistribution(userType, user.mealDistribution);
        
        // Configure meal types for a single day (will be replicated per day)
        const dailyMealTypes = configureMealTypes(userType, mealDistribution, user.goalCalories);
        
        // Get previously served recipes
        const previousRecipes = await getPreviousRecipes(userId);
        
        // Create user profile for scoring
        const userProfile = createUserProfile(user, userType);
        
        // Generate a mealplan with different meals for each day
        const mealPlan = [];
        
        for (let day = 1; day <= days; day++) {
            // Fetch recipes for each meal type in parallel for this day
            const dayMealResults = await Promise.all(
                dailyMealTypes.map(meal => fetchAndScoreRecipes(
                    meal, 
                    userProfile, 
                    previousRecipes, 
                    dietaryPreferences, 
                    day - 1, 
                    maxPagesPerMeal
                ))
            );
            
            // Format the selected recipes with portion scaling
            const dayFormattedData = await Promise.all(
                dayMealResults.map(mealData => formatMealWithRecipe(mealData, userId, day))
            );
            
            // Add day's meals to the plan
            mealPlan.push({
                day,
                date: (() => {
                    const date = new Date();
                    date.setDate(date.getDate() + (day - 1));
                    return date.toISOString().split('T')[0]; // Format as YYYY-MM-DD
                })(),
                meals: dayFormattedData
            });
            
            // Add selected recipes to previousRecipes to avoid repetition in next days
            for (const meal of dayFormattedData) {
                if (meal.recipe) {
                    previousRecipes.push(meal.recipe.id);
                }
            }
        }
        
        // After generating the meal plan, format it for saving
        const formattedMeals = mealPlan.flatMap(day => 
            day.meals.map(meal => ({
                recipe: meal.recipe,
                mealType: meal.mealType,
                alternateRecipes: meal.alternateRecipes || [], // Make sure alternateRecipes is included
                dayNumber: day.day,
                date: day.date
            }))
        );

        // Save the generated meal plan
        const savedMealPlan = new MealPlan({
            userId,
            nutritionistId,
            meals: formattedMeals.map(meal => ({
                ...meal,
                alternateRecipes: meal.alternateRecipes || [] // Ensure alternateRecipes is always an array
            })),
            startDate: mealPlan[0].date,
            endDate: mealPlan[mealPlan.length - 1].date,
            isActive: true
        });

        const checksave = await savedMealPlan.save();
        console.log('Multi-day meal plan saved successfully');
        const savedDoc = await MealPlan.findById(checksave._id);
        if (!savedDoc) {
            throw new Error('Failed to verify saved document');
        }
    
        console.log('Meal plan saved successfully with ID:', checksave._id);
        console.log('Document verification successful');
    
        // Return response with saved meal plan
        res.json({ 
            success: true,
            mealPlan: savedMealPlan,
            numberOfDays: days,
            userProfile: {
                type: userType,
                goalCalories: user.goalCalories,
                macros: user.macros
            }
        });
        
    } catch (err) {
        console.error('Error processing request:', err.message);
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});


module.exports = router;