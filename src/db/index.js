const { response } = require('express')
const mongoose = require('mongoose')
require('dotenv').config()

const DB_NAME = 'wellmateDB'
const connectDB = async ()=>{
    await mongoose.connect(`${process.env.Mongo_URI}/${DB_NAME}`)
    .then((response)=>{
        console.log("Database Connected");
    }).catch((err)=>{
        console.log("Error connecting Database", err);
    })
}

module.exports = connectDB