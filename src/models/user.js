const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const UserSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:[true, 'password is required']
    },
    location:{
        type:String,
        required:true,
    },
    role:{
        type:String,
        required:true,
        enum: ['nutri_user', 'client_user', 'regular_user']
    },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Nutritionist',
        default: null 
    },
    isEmailVerified:{
        type:Boolean,
        default:false
    },  
    otp: {
        type: String,
        default: null
    },
    otpExpiry: {
        type: Date,
        default: null
    }
},{timestamps: true})

UserSchema.pre("save", async function(next){
    if(!this.isModified('password')) return next()
    
    this.password = await bcrypt.hash(this.password, 10)
})

UserSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password, this.password)
}

const User = mongoose.model("User", UserSchema)
module.exports = User