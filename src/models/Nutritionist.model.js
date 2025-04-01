const mongoose = require('mongoose')


const NutritionistSchema = new mongoose.Schema({
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
    experience:{
        type:String,
        required:true
    },
    brandname:{
        type: String,
        required: true
    },
    brandlogo:{
        type: String,   
        default:''
    },
    specialization:{
        type: String,
        default:''
    },
    certifications:{
        type: String,
        default:''
    },
    clients:[{
        type: mongoose.Schema.Types.ObjectId,
        ref:'ClientUser',
        default: []
    }],
},{timestamps:true})

const Nutritionist = mongoose.model('Nutritionist', NutritionistSchema)
module.exports = Nutritionist    