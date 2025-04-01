const express = require('express')
const registration = require('./src/routes/auth')
const regularUser  = require('./src/routes/regularUser.route')
const profilePhoto = require('./src/routes/uploadProfile')
const recipeData = require('./src/sampleprocess')
const dietaryPreference = require('./src/routes/dietaryPreference.route.js')
const foodLog = require('./src/routes/foodLogRoute.js')
const dietPlanRoutes = require('./src/routes/dietPlan.js')
const connectDB = require('./src/db/index')
const nutritionistRegistration = require('./src/routes/Nutritionist/registration.route.js')
const createClient = require('./src/routes/client/createclient.route.js')
const generator = require('./src/routes/diet_generator/generator.js')
const multiDaygenerator = require('./src/routes/diet_generator/multidayGenerator.js')
const client = require('./src/routes/Nutritionist/sendplan.route.js')
const notification = require('./src/routes/notification.route.js')
const health = require('./src/routes/health/health.route.js')
const mealPlanRoutes = require('./src/routes/client/mealPlan.route.js')
const clientDataRoute = require('./src/routes/client/clientdata.route.js') // Assuming you have a clientDataRoute file

const subscription = require('./src/routes/subscription/createsubs.route.js')

const recipeRoutes = require('./src/routes/collections/recipe.js') 
const collectionRoutes = require('./src/routes/collections/collection.js')

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
app.use('/pfupload', profilePhoto)
app.use('/recipeapi', recipeData)
app.use('/preference', dietaryPreference)
app.use('/foodlog', foodLog)
app.use('/uploadPlan', dietPlanRoutes)
app.use('/generate', generator)
app.use('/multi-day-generator', multiDaygenerator)

app.use('/registration', nutritionistRegistration) 
app.use('/create', createClient)

app.use('/create-subscription', subscription)

app.use('/api/recipes', recipeRoutes)
app.use('/api/collections', collectionRoutes)
app.use('/api/notifications', notification)
app.use('/health', health)

app.use('/client', client)
app.use('/api/mealplan', mealPlanRoutes)
app.use('/api/clientdata', clientDataRoute) 

app.listen(process.env.PORT, ()=>{
    console.log(`Server is listening on ${PORT}`);
})
app.get('/', async(req, res)=>{
    res.send("Hello")
})