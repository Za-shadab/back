const express = require('express');
const mongoose = require('mongoose');
const Collection = require('../../models/collection.model');
const Recipe = require('../../models/recipes.model');
const Nutritionist = require('../../models/Nutritionist.model')

const router = express.Router();


// create a collection
router.post('/collections', async (req, res) => {
    try {
        const { id, name } = req.body;
        console.log(id);
        
        const nutritionist = await Nutritionist.findOne({UserId: id})
        const nutritionistId = nutritionist._id
        console.log(nutritionist);

        // Create collection
        const newCollection = new Collection({
            nutritionistId,
            name,
            items: []
        });

        await newCollection.save();
        res.status(201).json({ message: "Collection created successfully", collection: newCollection });

    } catch (error) {
        console.error("Error creating collection:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});


// Add a recipe to a collection
router.post('/collections/add-recipe', async (req, res) => {
    try {
        const { recipeData, collectionId } = req.body; // Recipe details from request body

        // Ensure collection exists
        const collection = await Collection.findById(collectionId);
        if (!collection) {
            return res.status(404).json({ message: 'Collection not found' });
        }

        // Save new recipe
        const newRecipe = new Recipe(recipeData);
        await newRecipe.save();

        // Add recipe ID to the collection
        collection.items.push(newRecipe._id);
        await collection.save();

        res.status(201).json({ message: 'Recipe added to collection', recipe: newRecipe });
    } catch (error) {
        console.error('Error adding recipe to collection:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

//Get collections by nutritionist user id
router.post('/collections/get', async (req, res) => {
    try {
        const { id } = req.body;
        console.log(id);
        
        const nutritionist = await Nutritionist.findOne({UserId: id})
        const nutritionistId = nutritionist._id
        console.log(nutritionist);
        
        if (!nutritionistId) {
            return res.status(400).json({ message: "Nutritionist ID is required" });
        }

        // Make sure to specify the correct model name for 'items'
        const collections = await Collection.find({ nutritionistId })
            .populate({
                path: 'items',
                model: 'Recipe' 
            });
        
        // Add cover image URL to each collection
        const collectionsWithCover = collections.map(collection => {
            const collectionObj = collection.toObject();
            
            // Add cover image if the collection has items
            if (collectionObj.items && collectionObj.items.length > 0) {
                // Get the first recipe that has an image
                const firstRecipeWithImage = collectionObj.items.find(item => 
                    item.image || (item.images && item.images.REGULAR));
                
                if (firstRecipeWithImage) {
                    // Use the regular image if available, otherwise use the main image
                    collectionObj.coverImage = firstRecipeWithImage.images?.REGULAR?.url || firstRecipeWithImage.image;
                }
            }
            return collectionObj;
        });
        
        res.status(200).json({ collections: collectionsWithCover });

    } catch (error) {
        console.error("Error fetching collections:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Remove a recipe from a collection
router.post('/collections/remove-recipe', async (req, res) => {
    try {
      const { collectionId, recipeId } = req.body;
      
      // Find the collection
      const collection = await Collection.findById(collectionId);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }
      
      // Check if the recipe exists in the collection
      const recipeIndex = collection.items.indexOf(recipeId);
      if (recipeIndex === -1) {
        return res.status(404).json({ message: 'Recipe not found in this collection' });
      }
      
      // Remove recipe from collection
      collection.items.splice(recipeIndex, 1);
      await collection.save();
      
      // Optionally, delete the recipe from the Recipe collection if it's not used elsewhere
      // await Recipe.findByIdAndDelete(recipeId);
      
      res.status(200).json({ message: 'Recipe removed from collection successfully' });
    } catch (error) {
      console.error('Error removing recipe from collection:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  
  // Delete a collection
  router.post('/collections/remove-collection', async (req, res) => {
    try {
      const { collectionId } = req.body;
      console.log(collectionId);
      
      // Find and delete the collection
      const deletedCollection = await Collection.findByIdAndDelete(collectionId);
      
      if (!deletedCollection) {
        return res.status(404).json({ message: 'Collection not found' });
      }
      
      // Optionally, delete all recipes in the collection if they're not used elsewhere
      // if (deletedCollection.items.length > 0) {
      //   await Recipe.deleteMany({ _id: { $in: deletedCollection.items } });
      // }
      
      res.status(200).json({ message: 'Collection deleted successfully' });
    } catch (error) {
      console.error('Error deleting collection:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

// Get recipes from a specific collection
router.post('/collections/recipes', async (req, res) => {
    try {
        const { collectionId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(collectionId)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid collection ID format'
            });
        }

        // Find collection and populate recipe details
        const collection = await Collection.findById(collectionId)
            .populate({
                path: 'items',
                model: 'Recipe',
                select: '-__v' // Exclude version key
            });

        if (!collection) {
            return res.status(404).json({
                success: false,
                message: 'Collection not found'
            });
        }

        // Transform recipes data to include all necessary fields
        const recipes = collection.items.map(recipe => ({
            id: recipe._id,
            label: recipe.label,
            image: recipe.image || (recipe.images && recipe.images.REGULAR ? recipe.images.REGULAR.url : null),
            calories: recipe.calories,
            totalTime: recipe.totalTime,
            yield: recipe.yield,
            dietLabels: recipe.dietLabels,
            healthLabels: recipe.healthLabels,
            cautions: recipe.cautions,
            ingredients: recipe.ingredients,
            nutrients: recipe.nutrients,
            url: recipe.url,
            mealType: recipe.mealType,
            dishType: recipe.dishType,
            cuisineType: recipe.cuisineType
        }));

        res.status(200).json({
            success: true,
            collectionName: collection.name,
            recipesCount: recipes.length,
            recipes: recipes
        });

    } catch (error) {
        console.error('Error fetching recipes from collection:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message
        });
    }
});

module.exports = router;
