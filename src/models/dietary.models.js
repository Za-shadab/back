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
    allergens:{
        type:[String],
        default:[]
    },
    dietType:{
        type:[String],
        required: true
    },
})

const DietaryPreference = mongoose.model('DietaryPreference', DietaryPrefernceSchema)
module.exports = DietaryPreference