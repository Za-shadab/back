const express = require('express')
const registration = require('./src/routes/auth')
const regularUser  = require('./src/routes/regularUser.route')
const connectDB = require('./src/db/index')
const cors = require('cors')
require('dotenv').config()
const app = express()
const readData =  require('./src/sampleprocess')



connectDB()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())
app.use('/api', registration)
app.use('/regular', regularUser)
readData()



app.listen(process.env.PORT, ()=>{
    console.log(`Server is listening on ${PORT}`);
    
})