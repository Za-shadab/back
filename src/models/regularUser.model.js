const mongoose = require('mongoose')


const regularUserSchema = new mongoose.Schema({
    UserId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    age:{
        type:String,
        required:true,
        min:0
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
    dietaryPreference:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'DietaryPreference',
        default:null
    }
},{timestamps:true})

const RegularUser = mongoose.model('RegularUser', regularUserSchema)
module.exports = RegularUser    