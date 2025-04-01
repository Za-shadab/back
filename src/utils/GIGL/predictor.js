const axios = require('axios')

async function predictGlycemicIndices(recipe, userType) {
    try {
        // Extract carbohydrate content and other relevant details for GI/GL prediction
        const proteins = recipe.totalNutrients?.PROCNT?.quantity || 0;
        const carbs = recipe.totalNutrients?.CHOCDF?.quantity || 0;
        const fats = recipe.totalNutrients?.FAT?.quantity || 0;
        const calories = recipe.totalNutrients?.ENERC_KCAL?.quantity || 0;
        
        // Ingredients list
        const ingredients = recipe.ingredients.map(ing => ing.food).join(',');
        
        // Call Python Flask API for GI/GL prediction
        const response = await axios.post('http://127.0.0.1:5000/predict', {
            calories,
            proteins,
            carbohydrates:carbs,
            fats,
        });
        console.log(response.data)
        return {
            predictedGI: response.data.glycemic_index.value,
            predictedGL: response.data.glycemic_load.value
        };
    } catch (error) {
        console.error('Error predicting GI/GL:', error);
        // Return estimated values if prediction fails
        return { 
            predictedGI: userType === 'diabetes' ? 45 : 50,
            predictedGL: userType === 'diabetes' ? 12 : 15
        };
    }
}

module.exports = predictGlycemicIndices