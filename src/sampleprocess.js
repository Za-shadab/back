const fs = require('fs').promises;  // Use fs.promises for async/await support

const readData = async () => {
    try {
        const data = await fs.readFile('src/samplejson.json', 'utf-8');  // Read file asynchronously with await
        const recipeData = JSON.parse(data);  // Parse JSON data


        const defaultServingSize = recipeData.hits[0].recipe.yield // default serving size on Api
        const desiredServingSize = 2 

        const extractedData = recipeData.hits.map(item =>{
            const nutrients = item.recipe.totalNutrients
            return Object.entries(nutrients).map(([key, value]) => ({
                label: value.label,
                value: value.quantity
              }));
        })
        
 
        const scaledValue = extractedData.map(element => {
            const values = element.map(el =>{
                return {
                    label: el.label,
                    value: el.value/ defaultServingSize
                }
            })
            return values
        });
 
        

        const desiredNutrients = scaledValue.map(element =>{
            const values = element.map(el => {
                return {
                    label: el.label,
                    value: el.value * desiredServingSize
                }
            })
            return values
        })
        

    } catch (err) {
        console.log("Error reading the file:", err);  // Error handling
    }
}

module.exports = readData;
