const mongoose = require('mongoose');

const userRecipeHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipeId: {
        type: String,
        required: true
    },
    mealType: {
        type: String,
        enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Teatime'],
        required: true
    },
    servedDate: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying by user and date range
userRecipeHistorySchema.index({ userId: 1, servedDate: 1 });

module.exports = mongoose.model('UserRecipeHistory', userRecipeHistorySchema);