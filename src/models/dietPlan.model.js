const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const DietPlanSchema = new mongoose.Schema({
    regularUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegularUser",
    },
    clientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientUser",
    },
    nutritionistId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Nutritionist",
    },
    totalcalories: String,
    meals:[{ type: mongoose.Schema.Types.ObjectId, refPath: 'type' }]
},{timestamps: true});

const recipeSchema = new mongoose.Schema({
    id: String,
    label: String,
    url: String,
    image: String,
    calories: String,
    serving: {
        type: mongoose.Schema.Types.Mixed, // Allow both Number and String
        get: v => typeof v === 'string' ? parseFloat(v.replace(/[^\d.-]/g, '')) || v : v
    },
    ingredients: [{
        text: String,
        quantity: Number,
        measure: String,
        food: String,
        image: String
    }],
    ingredientsLines: [String],
    nutrients: [{
        label: String,
        value: String,
        unit: String
    }],
    cautions: [String],
    predictedGI: Number,
    predictedGL: Number,
    score: Number
}, { _id: false });

const alternateRecipeSchema = new mongoose.Schema({
    id: String,
    score: Number,
    label: String,
    url: String,
    calories: String,
    image: String,
    cautions: [String],
    serving: {
        type: mongoose.Schema.Types.Mixed,
        get: v => typeof v === 'string' ? parseFloat(v.replace(/[^\d.-]/g, '')) || v : v
    },
    nutrients: [{
        label: String,
        value: String,
        unit: String
    }],
    ingredientsLines: [String]
}, { _id: false });

const mealSchema = new mongoose.Schema({
    recipe: recipeSchema,
    mealType: {
        type: String,
        required: true
    },
    alternateRecipes: {
        type: [alternateRecipeSchema],
        default: []
    },
    dayNumber: Number,
    date: Date
}, { _id: true });

const mealPlanSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    nutritionistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Nutritionist'
    },
    meals: [mealSchema],
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const DietPlan = mongoose.model("DietPlan", DietPlanSchema);
module.exports = mongoose.model('MealPlan', mealPlanSchema);