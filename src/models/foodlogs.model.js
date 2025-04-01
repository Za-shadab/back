const mongoose = require("mongoose");

const FoodLogSchema = mongoose.Schema(
  {
    regularUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegularUser",
    },
    clientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientUser",
    },
    foodId: {
      type: String,
    },
    foodName: {
      type: String,
      required: true,
      default: "",
    },
    image:{
      type: String,
      default:""
    },
    mealType:{
      type: String,
      required: true
    },
    measure: {
      type: String,
      required: true,
      default: "",
    },
    quantity:{
      type: String,
      required: true,
      default: "",
    },
    calories:{
      type: String,
      required: true,
      default: "",
    },
    protein:{
      type: String,
      required: true,
      default: "",
    },
    fiber:{
      type: String,
      required: true,
      default: "",
    },
    fats:{
      type: String,
      required: true,
      default: "",
    },
    carbs:{
      type: String,
      required: true,
      default: "",
    },
    sugar:{
      type: String,
      required: true,
      default: "",
    },
    cholestrol:{
      type: String,
      required: true,
      default: "",
    },
    iron:{
      type: String,
      required: true,
      default: "",
    },
    magnesium:{
      type: String,
      required: true,
      default: "",
    },
    potassium:{
      type: String,
      required: true,
      default: "",
    },
    sodium:{
      type: String,
      required: true,
      default: "",
    },
    zinc:{
      type: String,
      required: true,
      default: "",
    },
    vitaminB12:{
      type: String,
      required: true,
      default: "",
    },
    VitaminB6:{
      type: String,
      required: true,
      default: "",
    },
    VitaminC:{
      type: String,
      required: true,
      default: "",
    },
    VitaminD:{
      type: String,
      required: true,
      default: "",
    },
    thiamin:{
      type: String,
      required: true,
      default: "",
    },
  },
  { timestamps: true }
);

const foodLogs = mongoose.model('FoodLog', FoodLogSchema);
module.exports = foodLogs