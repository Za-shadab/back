const express = require('express')
const User = require('../models/user')
const jwt = require('jsonwebtoken')
const { isObjectIdOrHexString } = require('mongoose')
require('dotenv').config()
const router  = express.Router()


router.post('/register', async (req, res, next)=>{
    console.log(req.body);
    
    const {name, email, password, location, role} = req.body

    if(!name || !email || !password || !location || !role){
        return res.status(400).json({msg: 'Please enter all reqired fields'})
    }
    try{
        const userExists = await User.findOne({email})
        if(userExists){
           return res.status(400).json({msg: 'User already exists'})
        }
    }catch(err){
        next(err)
    }
    const newUser = new User({
        name,
        email,
        password,
        location,
        role
    })
    const savedUser = await newUser.save()
    res.status(201).json({ msg: 'User registered successfully', user: newUser, userId: savedUser._id});
});




router.post('/login', async (req, res, next)=>{
    const {email, password} = req.body
    console.log(email);
    
    const userExist = await User.findOne({ email });
    console.log(userExist);

    if(!userExist){
        console.log("Hii");
        return res.status(404).json({msg: "Kindly register before Login"});
    }
    const isCorrectPassword = await userExist.isPasswordCorrect(password);
    
    if(isCorrectPassword){
        const token = jwt.sign({userId: userExist._id, email: userExist.email}, process.env.JWT_SECRET);

        if(res.status(201)){
            return res.status(201).json({msg:"Login Succefull", token})
        }else{
            return res.status(401).json({msg:"error in Login"})
        }
    }
})

module.exports = router;