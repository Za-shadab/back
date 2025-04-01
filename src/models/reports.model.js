const mongoose = require('mongoose')


const ReportsSchema = new mongoose.Schema({
    UserId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    reportType:{
        type:String,
        required:true,
    },
    reportContent:{
        type:String,
        required:true,
    },
    generatedAt:{
        type:Date,
        required:true
    },
    goals:{
        type:[String],
        required:true
    },
    acheivement:{
        type: String,
        default:null
    },
},{timestamps:true})

const Reports = mongoose.model('ClientUser', ReportsSchema)
module.exports = Reports    