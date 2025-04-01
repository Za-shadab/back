const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Sub-schemas
const ImageSchema = new Schema({
  url: String,
  width: Number,
  height: Number
});

const ImagesSchema = new Schema({
  THUMBNAIL: ImageSchema,
  SMALL: ImageSchema,
  REGULAR: ImageSchema
});

const IngredientSchema = new Schema({
  text: String,
  quantity: Number,
  measure: String,
  food: String,
  weight: Number,
  foodCategory: String,
  foodId: String,
  image: String
});

const NutrientSchema = new Schema({
  label: String,
  quantity: Number,
  unit: String
});

const SubNutrientSchema = new Schema({
  label: String,
  tag: String,
  schemaOrgTag: String,
  total: Number,
  hasRDI: Boolean,
  daily: Number,
  unit: String
});

const DigestSchema = new Schema({
  label: String,
  tag: String,
  schemaOrgTag: String,
  total: Number,
  hasRDI: Boolean,
  daily: Number,
  unit: String,
  sub: [SubNutrientSchema]
});

// Main Recipe Schema
const RecipeSchema = new Schema({
  uri: String,
  label: String,
  image: String,
  images: ImagesSchema,
  source: String,
  url: String,
  shareAs: String,
  yield: Number,
  dietLabels: [String],
  healthLabels: [String],
  cautions: [String],
  ingredientLines: [String],
  ingredients: [IngredientSchema],
  calories: Number,
  totalCO2Emissions: Number,
  co2EmissionsClass: String,
  totalWeight: Number,
  totalTime: Number,
  cuisineType: [String],
  mealType: [String],
  dishType: [String],
  
  // Using a mixed type for flexibility with nutrient data
  totalNutrients: {
    type: Object,
  },
  
  totalDaily: {
    type: Map,
    of: NutrientSchema
  },
  
  digest: [DigestSchema]
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Recipe', RecipeSchema);