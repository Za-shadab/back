const axios = require('axios');
const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const mongoose = require('mongoose');
const RegularUser = require('./models/regularUser.model')


router.post('/recipe', async (req, res) => {

    const { regularUserId, clientUserId, nutrtionistId} = req.body
    console.log("reg",req.body);
    
    if (!mongoose.Types.ObjectId.isValid(regularUserId)) {
        return res.status(400).json({ message: "Invalid RegularUser ID format" });
    }
    const regularUser = await RegularUser.findById(regularUserId).populate('UserId');

    console.log(regularUser.goalCalories);


    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    async function scaleIngredients(ingredients, originalServing, desiredServing){
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
        return result.response.text();
    }

    function roundToFraction(decimal) {
        const fractions = [
            { value: 0, text: "" },
            { value: 0.25, text: "¼" },
            { value: 0.33, text: "⅓" },
            { value: 0.5, text: "½" },
            { value: 0.67, text: "⅔" },
            { value: 0.75, text: "¾" }
        ];
    
        let closest = fractions.reduce((prev, curr) =>
            Math.abs(curr.value - decimal) < Math.abs(prev.value - decimal) ? curr : prev
        );
    
        if (decimal >= 0.95) {
            closest = { value: 1, text: "1" };
        }
    
        return closest;
    }

    function calculateServingSize(desiredServingSize) {
        const whole = Math.floor(desiredServingSize);
        const decimal = desiredServingSize - whole;
        let fraction = roundToFraction(decimal);
        
        return whole === 0 ? fraction.text : whole + fraction.text;
    }

    try {
        const apiUrl = 'https://api.edamam.com/api/recipes/v2';
        const totalCaloriesNeeded = 1749;

        const mealTypes = [
            { api_key: process.env.EDAMAM_API_KEY_ONE, api_id: process.env.EDAMAM_API_ID_ONE, mealType: 'Breakfast', calories: (regularUser.goalCalories / 100) * 12.5, dishType:'Cereals'},
            { api_key: process.env.EDAMAM_API_KEY_TWO, api_id: process.env.EDAMAM_API_ID_TWO, mealType: 'Breakfast', calories: (regularUser.goalCalories / 100) * 12.5},
            { api_key: process.env.EDAMAM_API_KEY_THREE, api_id: process.env.EDAMAM_API_ID_THREE, mealType: 'Snack', calories: (regularUser.goalCalories / 100) * 12.5},
            { api_key: process.env.EDAMAM_API_KEY_FOUR, api_id: process.env.EDAMAM_API_ID_FOUR, mealType: 'Lunch', calories: (regularUser.goalCalories / 100) * 12.5, dishType:'Drinks'},
            { api_key: process.env.EDAMAM_API_KEY_FIVE, api_id: process.env.EDAMAM_API_ID_FIVE, mealType: 'Lunch', calories: (regularUser.goalCalories / 100) * 12.5},
            { api_key: process.env.EDAMAM_API_KEY_SIX, api_id: process.env.EDAMAM_API_ID_SIX, mealType: 'Teatime', calories: (regularUser.goalCalories / 100) * 12.5, dishType:'Drinks' },
            { api_key: process.env.EDAMAM_API_KEY_SEVEN, api_id: process.env.EDAMAM_API_ID_SEVEN, mealType: 'Dinner', calories: (regularUser.goalCalories / 100) * 12.5, dishType:'Main course' },
            { api_key: process.env.EDAMAM_API_KEY_EIGHT, api_id: process.env.EDAMAM_API_ID_EIGHT, mealType: 'Dinner', calories: (regularUser.goalCalories / 100) * 12.5},
        ];

        const results = [];

        for (const meal of mealTypes) {
            try {
                const response = await axios.get(apiUrl, {
                    params: {
                        type: 'public',
                        app_id: meal.api_id,
                        app_key: meal.api_key,
                        diet: 'balanced',
                        cuisineType: 'Indian',
                        dishType: meal.dishType,
                        mealType: meal.mealType,
                        calories: meal.calories
                    }
                });

                results.push({
                    mealType: meal.mealType,
                    data: response.data.hits,
                    requiredcalories: meal.calories,
                });
            } catch (error) {
                console.error(`Error fetching recipes for ${meal.mealType}:`, error);
            }
        }

        const formattedData = await Promise.all(results.map(async (meal) => {
            if (meal.data.length === 0) {
                return { mealType: meal.mealType, recipe: null };
            }

            let recipe = meal.data[0].recipe;
            let selectedRecipe = meal.data.reduce((bestMatch, r) => {
                // Extract user's total macronutrient need
                const userNeeds = regularUser.macros.fats + regularUser.macros.carbs + regularUser.macros.protein;
            
                // Calculate adjusted macronutrient values based on required calories
                let adjustedFats = r.recipe.totalNutrients.FAT.quantity * (meal.requiredcalories / r.recipe.calories);
                let adjustedCarbs = r.recipe.totalNutrients.CHOCDF.quantity * (meal.requiredcalories / r.recipe.calories);
                let adjustedProtein = r.recipe.totalNutrients.PROCNT.quantity * (meal.requiredcalories / r.recipe.calories);
            
                // Compute absolute differences
                let fatDiff = Math.abs(regularUser.macros.fats - adjustedFats);
                let carbDiff = Math.abs(regularUser.macros.carbs - adjustedCarbs);
                let proteinDiff = Math.abs(regularUser.macros.protein - adjustedProtein);
            
                // Calculate total similarity score (lower is better)
                let similarityScore = fatDiff + carbDiff + proteinDiff;
            
                // Return the best matching recipe (recipe with lowest similarity score)
                return similarityScore < bestMatch.score ? { recipe: r.recipe.label, score: similarityScore } : bestMatch;
            }, { recipe: null, score: Infinity });
            
            // Final best-matching recipe
            console.log("Best recipe:", selectedRecipe.recipe);
            
            let alterrecipe = meal;
            const altercalculatednutrients = alterrecipe.data.map((r)=>{
                return Object.entries(r.recipe.totalNutrients).map(([key, value]) => ({
                    label: value.label,
                    value: ((value.quantity || 0) * (meal.requiredcalories/r.recipe.calories)).toFixed(1)
                })).flat();
            })
            
            if (meal.mealType === 'Dinner') {
                recipe = meal.data[2]?.recipe || meal.data[0]?.recipe;
            }
        
            const nutrients = recipe.totalNutrients;
            const defaultYield = recipe.yield || 1;
            const defaultCalories = recipe.calories || 1;
            const requiredCalories = meal.requiredcalories;
            const desiredServingSize = defaultCalories > 0 ? requiredCalories / defaultCalories : 1;
        
            const adjustedSize = calculateServingSize(desiredServingSize);
        
            const calculatedNutrients = Object.entries(nutrients).map(([key, value]) => ({
                label: value.label,
                value: ((value.quantity || 0) * desiredServingSize).toFixed(1)
            }));
        
            const adjustedIngredients = recipe.ingredients.map(ingredient => ({
                text: ingredient.text,
                quantity: (ingredient.quantity || 1) * desiredServingSize, 
                measure: ingredient.measure,
                food: ingredient.food,
                image: ingredient.image,
            }));
        
            const geminiResponse = await scaleIngredients(recipe.ingredientLines, defaultYield, desiredServingSize);
            const cleanedResponse = geminiResponse.replace(/```json|```/g, ''); // Remove markdown code blocks
            const adjustedIngredientsLines = JSON.parse(cleanedResponse).scaledIngredients; // Parse into JSON

            const alternateRecipes = {
                mealType: meal.mealType,
                recipe: {
                    label: alterrecipe.data.map((r)=>{return r.recipe.label}),
                    url: alterrecipe.data.map((r)=>{return r.recipe.url}),
                    calories: alterrecipe.data.map((r)=>{return ((r.recipe.calories || 1) * (meal.requiredcalories/r.recipe.calories)).toFixed(0)}),
                    nutrients: altercalculatednutrients,
                    serving: alterrecipe.data.map((r)=>{return (calculateServingSize(meal.requiredcalories/r.recipe.calories))}),
                    image: alterrecipe.data.map((r)=>{return (r.recipe.image)}),
                    ingredients: alterrecipe.data.map((r)=>{
                        return r.recipe.ingredients.map(ingredient => ({
                            text: ingredient.text,
                            quantity: (ingredient.quantity || 1) * (meal.requiredcalories/r.recipe.calories).toFixed(1), 
                            measure: ingredient.measure,
                            food: ingredient.food,
                            image: ingredient.image,
                        }));
                    
                    }),
                    ingredientsLines: alterrecipe.data.map((r)=>{return adjustedIngredientsLines}),
                    // ingredients: alterrecipe.data.map((r)=>{return adjustedIngredientsLines}),
                    cautions: alterrecipe.data.map((r)=>{return r.recipe.cautions})
                }
            };


            return {
                mealType: meal.mealType,
                recipe: {
                    label: recipe.label,
                    url: recipe.url,
                    calories: ((recipe.calories || 1) * desiredServingSize).toFixed(0),
                    nutrients: calculatedNutrients,
                    image: recipe.image,
                    serving: adjustedSize,
                    ingredients: adjustedIngredients,
                    ingredientsLines: adjustedIngredientsLines,
                    cautions: recipe.cautions,
                },
                alternateRecipes
            };
        }));
        
        res.json({ meals: formattedData });
        
    } catch (err) {
        console.error('Error processing request:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
