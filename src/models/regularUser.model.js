const mongoose = require('mongoose')


const regularUserSchema = new mongoose.Schema({
    UserId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'User',
        required: true,
    },
    age:{
        type:String,
        required:true,
        min:0
    },
    height:{
        type: String,
        required: true,
    },
    weight:{
        type: String,
        required: true,
    },
    gender:{
        type:String,
        required:true,
        enum:['Male', 'Female']
    },
    activityLevel:{
        type:String,
        required:true
    },
    goals:{
        type:[String],
        required:true
    },
    goalWeight:{
        type: String,
        default: null
    },
    weightchangeRate:{
        type: String,
        default: null
    },
    dietaryPreference:{ 
        type: mongoose.Schema.Types.ObjectId,
        ref:'DietaryPreference',
        default:null
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
        required: true
    },
    macros: {
        protein: String,
        carbs: String,
        fats: String,
        nonFiberCarbs:String,
        fiber: String,
        calories: String
    },
    goalCalories:{
        type: String,
        required: true,
        default: ""
    }
},{timestamps:true})

const RegularUser = mongoose.model('RegularUser', regularUserSchema)
module.exports = RegularUser    