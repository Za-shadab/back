const express = require('express');
const router = express.Router();
const Recipe = require('../../models/recipes.model'); // Adjust path as needed

// GET all recipes
router.get('/', async (req, res) => {
  try {
    const recipes = await Recipe.find();
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single recipe by ID
router.get('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST new recipe
router.post('/', async (req, res) => {
  const {recipe} = new Recipe(req.body);
  
  try {
    const newRecipe = await recipe.save();
    res.status(201).json(newRecipe);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT (update) recipe
router.put('/:id', async (req, res) => {
  try {
    const updatedRecipe = await Recipe.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    
    res.json(updatedRecipe);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE recipe
router.delete('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findByIdAndDelete(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET recipes by cuisine type
router.get('/cuisine/:type', async (req, res) => {
  try {
    const recipes = await Recipe.find({ cuisineType: req.params.type });
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET recipes by meal type
router.get('/meal/:type', async (req, res) => {
  try {
    const recipes = await Recipe.find({ mealType: req.params.type });
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Search recipes by name/label
router.get('/search/:term', async (req, res) => {
  try {
    const recipes = await Recipe.find({ 
      label: { $regex: req.params.term, $options: 'i' }
    });
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;