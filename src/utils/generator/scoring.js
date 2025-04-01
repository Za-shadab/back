function normalize(value, target, maxDeviation) {
    return Math.max(0, 1 - Math.abs(value - target) / maxDeviation);
}

function calculateRecipeScore(recipe, userProfile, mealCalorieRatio) {
    // User-specific target values
    const { targetCalories, targetMacros, targetCarbDist, targetGI, targetGL, type } = userProfile;
    
    // Calculate proportional macro targets for this specific meal
    const mealTargets = {
        calories: targetCalories * mealCalorieRatio,
        protein: targetMacros.protein * mealCalorieRatio,
        carbs: targetMacros.carbs * mealCalorieRatio,
        fat: targetMacros.fat * mealCalorieRatio
    };
    
    // Dynamic Weight Assignment Based on User Type
    const weightConfig = {
        regular: { W1: 0.4, W2: 0.6, W3: 0.0, W4: 0.0 },
        diabetes: { W1: 0.1, W2: 0.2, W3: 0.3, W4: 0.4 },
        pcos: { W1: 0.1, W2: 0.3, W3: 0.3, W4: 0.3 }
    };

    const weights = weightConfig[type] || weightConfig.regular;

    // Score against meal-specific targets
    const calorieScore = normalize(recipe.calories, mealTargets.calories, mealTargets.calories * 0.5);
    
    const proteinScore = normalize(recipe.protein, mealTargets.protein, mealTargets.protein * 0.5);
    const carbScore = normalize(recipe.carbs, mealTargets.carbs, mealTargets.carbs * 0.5);
    const fatScore = normalize(recipe.fat, mealTargets.fat, mealTargets.fat * 0.5);
    
    const macroScore = (proteinScore * 0.4) + (carbScore * 0.4) + (fatScore * 0.2);

    // Rest of the scoring remains the same
    const carbDistScore = normalize(recipe.sugar, targetCarbDist.sugar * mealCalorieRatio, 30 * mealCalorieRatio);

    const giGlScore = (
        normalize(recipe.predictedGI, targetGI, 50) +
        normalize(recipe.predictedGL, targetGL * mealCalorieRatio, 30 * mealCalorieRatio)
    ) / 2;

    // Final Weighted Score
    const finalScore = (
        weights.W1 * calorieScore +
        weights.W2 * macroScore +
        weights.W3 * carbDistScore +
        weights.W4 * giGlScore
    ).toFixed(4);

    return { ...recipe, score: finalScore };
}
// Example usage
// const sampleRecipe = {
//     calories: 600,
//     protein: 50,
//     carbs: 80,
//     fat: 20,
//     sugar: 10,
//     predictedGI: 45,
//     predictedGL: 20
// };

// const userProfile = {
//     type: "diabetes",  // Can be "regular", "diabetes", "pcos"
//     targetCalories: 500,
//     targetMacros: { protein: 50, carbs: 70, fat: 25 },
//     targetCarbDist: { sugar: 5 },
//     targetGI: 40,
//     targetGL: 15
// };

// console.log(calculateRecipeScore(sampleRecipe, userProfile));

module.exports = {
    normalize, calculateRecipeScore
}