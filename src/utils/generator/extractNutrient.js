function extractNutrientValues(recipe) {
    const nutrients = recipe.totalNutrients || {};
    
    return {
        calories: recipe.calories || 0,
        protein: nutrients.PROCNT?.quantity || 0,
        carbs: nutrients.CHOCDF?.quantity || 0,
        fat: nutrients.FAT?.quantity || 0,
        sugar: nutrients.SUGAR?.quantity || 0,
        // Default values for GI/GL if not available
        predictedGI: 50, 
        predictedGL: 15
    };
}

module.exports = extractNutrientValues