const mongoose = require('mongoose')

const DietaryPrefernceSchema = new mongoose.Schema({
    regularUserId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'RegularUser'
    },
    clientUserId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'ClientUser'
    },
    dietType:{
        type: String,
        required: true
    },
    allergens:{
        type:[String],
        required: true
    },
    restrictedIngredients:{
        type:[String],
        required: true
    }
})

const DietaryPreference = mongoose.model('DietaryPreference', DietaryPrefernceSchema)
module.exports = DietaryPreference