const mongoose = require('mongoose');

const ClientUserSchema = new mongoose.Schema({
    UserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    NutritionistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Nutritionist',
        required: true,
        default: null
    },
    age: {
        type: String,
        required: true,
        min: 0
    },
    gender: {
        type: String,
        required: true,
        enum: ['Male', 'Female']
    },
    height:{
        type:String,
        required: true
    },
    weight:{
        type:String,
        required: true
    },
    activityLevel: {
        type: String,
        required: true
    },
    goals: {
        type: [String],
        required: true
    },
    goalWeight:{
        type: String,
        default: null
    },
    weightchangeRate:{
        type: String,
        default: null
    },
    bmi:{
        type: String,
        default: ""
    },
    bmr:{
        type: String,
        default: ""
    },
    tdee:{
        type: String,
        default: ""
    },
    profileUrl:{
        type:String,
        default:'',
    },
    goalCalories:{
        type: String,
        required: true,
        default: ""
    },
    macros: {
        protein: String,
        carbs: String,
        fats: String,
        calories: String
    },
    healthConditions:{
        type:[String],
        default:''
    },
    diabetesMeds:{
        type: String,
        default: ""
    },
    insulinUse:{
        type: String,
        default: ""
    },
    pcosMeds:{
        type: String,
        default: ""
    },
    thyroidType:{
        type: String,
        default: ""
    },
    tshLevels:{
        type: String,
        default: ""
    },
    dietaryPreference: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DietaryPreference',
        default: null
    },
    onboardingStatus:{
        type: String,
        enum: ['in_progress', 'completed'], // Only two values needed
        default: 'in_progress'
    },
    permissions: {
        viewPlanner: { type: Boolean, default: true },
        allowFoodLogging: { type: Boolean, default: false },
        regenerateMeals: { type: Boolean, default: true },
        saveLoadPlans: { type: Boolean, default: true },
        addDeleteFoods: { type: Boolean, default: false },
        editFoodAmounts: { type: Boolean, default: true },
        setRecurringFoods: { type: Boolean, default: true },
        editAllSettings: { type: Boolean, default: false },
        editLoginCredentials: { type: Boolean, default: false },
        sendMealPlanEmail: { type: Boolean, default: true },
        viewReports: { type: Boolean, default: true }
    }
}, { timestamps: true });

const ClientUser = mongoose.model('ClientUser', ClientUserSchema);
module.exports = ClientUser;
