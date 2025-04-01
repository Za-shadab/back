const express = require('express');
const mongoose = require('mongoose');
const RegularUser = require('../models/regularUser.model'); 

const router = express.Router();

// Function to get a random value within a range
const getRandomInRange = (min, max) => Math.round(Math.random() * (max - min) + min);

// Function to determine macronutrient distribution based on goal

const getMacroDistribution = (tdee, goal) => {
    // Define macro ranges based on different goals
    const macroRanges = {
        "Lose Weight": { protein: [0.35, 0.45], carbs: [0.30, 0.40], fats: [0.20, 0.30] },
        "Maintain Weight": { protein: [0.25, 0.35], carbs: [0.40, 0.50], fats: [0.20, 0.30] },
        "Gain Weight": { protein: [0.20, 0.30], carbs: [0.50, 0.60], fats: [0.20, 0.30] },
        "Gain Muscle": { protein: [0.35, 0.45], carbs: [0.35, 0.45], fats: [0.15, 0.25] },
        "Modify My Diet": { protein: [0.25, 0.35], carbs: [0.35, 0.45], fats: [0.25, 0.35] }
    };

    // Get the appropriate ranges for the goal
    const ranges = macroRanges[goal] || macroRanges["Maintain Weight"]; // Default to Maintain Weight

    // Calculate mid-point percentages from ranges
    let proteinPercentage = (ranges.protein[0] + ranges.protein[1]) / 2;
    let carbsPercentage = (ranges.carbs[0] + ranges.carbs[1]) / 2;
    let fatsPercentage = (ranges.fats[0] + ranges.fats[1]) / 2;
    
    // Ensure percentages sum to 1.0 (100%)
    const totalPercentage = proteinPercentage + carbsPercentage + fatsPercentage;
    proteinPercentage = proteinPercentage / totalPercentage;
    carbsPercentage = carbsPercentage / totalPercentage;
    fatsPercentage = fatsPercentage / totalPercentage;
    
    // Convert percentages into calories
    const proteinCalories = tdee * proteinPercentage;
    const carbsCalories = tdee * carbsPercentage;
    const fatsCalories = tdee * fatsPercentage;
    
    // First convert calories to grams using standard conversion factors
    const protein = Math.round(proteinCalories / 4);
    const totalCarbs = Math.round(carbsCalories / 4);
    const fats = Math.round(fatsCalories / 9);
    
    // Calculate fiber recommendation (14g per 1000 calories is a common guideline)
    // Ensure it doesn't exceed a reasonable portion of total carbs (max 40%)
    const recommendedFiber = Math.round((tdee / 1000) * 14);
    const fiber = Math.min(recommendedFiber, Math.round(totalCarbs * 0.4));
    
    // Calculate non-fiber carbs by subtracting fiber from total carbs
    const nonFiberCarbs = totalCarbs - fiber;
    
    // Calculate actual calories from these grams using proper conversion factors
    const proteinActualCalories = protein * 4;
    const nonFiberCarbsActualCalories = nonFiberCarbs * 4;
    const fiberActualCalories = fiber * 2; // Fiber uses 2 cal/g instead of 4
    const fatsActualCalories = fats * 9;
    
    // Calculate total actual calories (for verification)
    const actualTotalCalories = proteinActualCalories + nonFiberCarbsActualCalories + fiberActualCalories + fatsActualCalories;
    
    return { 
        protein, 
        carbs: totalCarbs,
        nonFiberCarbs,
        fiber,
        fats,
        calories: {
            protein: Math.round(proteinActualCalories),
            carbs: Math.round(nonFiberCarbsActualCalories + fiberActualCalories),
            nonFiberCarbs: Math.round(nonFiberCarbsActualCalories),
            fiber: Math.round(fiberActualCalories),
            fats: Math.round(fatsActualCalories),
            total: Math.round(actualTotalCalories) // Using actual calculated total
        },
        percentages: {
            protein: Math.round(proteinPercentage * 100),
            carbs: Math.round(carbsPercentage * 100),
            fats: Math.round(fatsPercentage * 100)
        }
    };
};
// Function to calculate BMI
const calculateBMI = (weight, height) => {
    return (weight / ((height / 100) ** 2)).toFixed(2);
};

// Function to calculate BMR
const calculateBMR = (weight, height, age, gender) => {
    if (gender === 'Male') {
        return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
    } else {
        return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
    }
};

// Function to calculate TDEE
const calculateTDEE = (bmr, activityLevel) => {
    const activityMultipliers = {
        "Not Very Active": 1.2,
        "Lightly Active": 1.375,
        "Active": 1.55,
        "Very Active": 1.725,
    };

    return Math.round(bmr * (activityMultipliers[activityLevel] || 1.2));
};

//Function to calculate caloricGoal
const calculateGoalCalories = (tdee, goals, weightChangeRate, goalWeight) => {
    if (!Array.isArray(goals) || goals.length === 0) return tdee;

    // Convert to number
    weightChangeRate = Number(weightChangeRate) || 0;

    if (!goalWeight && goals.includes("Gain Weight") && weightChangeRate === 0) {
        weightChangeRate = 0.5; // Default to 0.5 kg/week
    }

    const calorieChangePerKg = 7700;
    const dailyCaloricChange = (weightChangeRate * calorieChangePerKg) / 7;

    if (goals.includes("Lose Weight")) return Math.round(tdee - dailyCaloricChange);
    if (goals.includes("Gain Weight")) return Math.round(tdee + dailyCaloricChange);

    return tdee; 
};



// CREATE: Add a new regular user
router.post('/regularUsers', async (req, res) => {
    try {
        const { UserId, age, height, weight, gender, activityLevel, goals, goalWeight, weightchangeRate } = req.body;
        console.log(req.body);
        
        // Calculate BMI, BMR & TDEE
        const bmi = calculateBMI(weight, height);
        const bmr = calculateBMR(weight, height, age, gender);
        const tdee = calculateTDEE(bmr, activityLevel);

        // Calculate Goal Calories
        const goalCalories = calculateGoalCalories(tdee, goals, weightchangeRate, goalWeight);

        // Get macronutrient distribution
        const macros = getMacroDistribution(tdee, goals);   
        console.log("Height=", height, "Weight=", weight, "Gender=",gender, "ActivityLevel=",activityLevel, "Goals=",goals, "GoalWeight=",goalWeight, "WeightChangeRate=",weightchangeRate);
        console.log("BMI=",bmi, "BMR=",bmr, "TDEE=",tdee, "GOALCALORIES=",goalCalories); 
        // Add calculated values to user data
        const userData = { ...req.body, bmi, bmr, tdee, macros: {...macros, calories: JSON.stringify(macros.calories)},  goalCalories };
        const regularUser = new RegularUser(userData);
        const savedUser = await regularUser.save();

        console.log("Saved Regular User:", savedUser);
        res.status(201).json(savedUser);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// GET: Fetch Regular User Info
router.get('/regular-users/:id', async (req, res, next) => {
    try {
        const { id } = req.params;  // This is the RegularUser ID

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid RegularUser ID format" });
        }

        // Find RegularUser by its own _id
        const regularUser = await RegularUser.findOne({UserId: id}).populate('UserId');

        if (!regularUser) {
            return res.status(404).json({ message: "RegularUser not found" });
        }

        res.status(200).json({
            message: "Fetched Successfully",
            regularUser
        });
    } catch (error) {
        console.error("Error fetching RegularUser:", error);
        next(error);
    }
});

// Add after other routes
router.get('/health-dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await RegularUser.findOne({ UserId: userId })
      .populate('UserId', 'name');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Parse numeric values
    const weight = parseFloat(user.weight) || 0;
    const goalWeight = parseFloat(user.goalWeight) || weight;
    const tdee = parseFloat(user.tdee) || 2000;
    const bmr = parseFloat(user.bmr) || 1500;
    const goalCalories = parseFloat(user.goalCalories) || tdee;
    const bmi = parseFloat(user.bmi) || 0;

    // Parse the calories JSON string
    let caloriesData = {};
    try {
      caloriesData = typeof user.macros.calories === 'string' 
        ? JSON.parse(user.macros.calories)
        : user.macros.calories;
    } catch (e) {
      console.error('Error parsing macros calories:', e);
      caloriesData = { protein: 0, carbs: 0, fats: 0, total: tdee };
    }

    const healthData = {
      personalInfo: {
        name: user.UserId?.name || 'User',
        age: parseInt(user.age) || 0,
        gender: user.gender || 'Not specified',
        height: parseFloat(user.height) || 0,
        weight,
        goalWeight,
        activityLevel: user.activityLevel || 'Not Very Active',
        bodyFat: user.bodyFat || null
      },
      energyBalance: {
        tdee,
        bmr,
        goalCalories,
        calorieDeficit: tdee - goalCalories,
        weeklyWeightLossPotential: ((tdee - goalCalories) * 7 / 7700).toFixed(2)
      },
      bmiData: {
        bmi: bmi.toFixed(1),
        category: getBmiCategory(bmi),
        idealWeight: calculateIdealWeight(parseFloat(user.height) || 170)
      },
      macronutrients: {
        distribution: {
            protein: Math.round((caloriesData.protein / caloriesData.total) * 100) || 30,
            carbs: Math.round((caloriesData.carbs / caloriesData.total) * 100) || 45,
            fats: Math.round((caloriesData.fats / caloriesData.total) * 100) || 25
          },
          dailyTargets: {
            protein: parseFloat(user.macros.protein) || 0,
            carbs: parseFloat(user.macros.carbs) || 0,
            nonFiberCarbs: parseFloat(user.macros.nonFiberCarbs) || 0,
            fiber: parseFloat(user.macros.fiber) || 0,
            fats: parseFloat(user.macros.fats) || 0
          }
      },
      weightProgress: {
        current: weight.toFixed(1),
        goal: goalWeight.toFixed(1),
        toGoal: {
          amount: Math.abs(weight - goalWeight).toFixed(1),
          direction: weight > goalWeight ? 'lose' : 'gain',
          recommendation: getRecommendation(bmi, user.goals, weight, goalWeight)
        },
        history: user.weightHistory || []
      },
      dailyGoals: {
        calories: goalCalories.toFixed(0),
        water: calculateWaterIntake(weight),
        sleep: 8
      }
    };

    console.log("Health Data:", healthData);
    res.json({
      success: true,
      data: healthData
    });
  } catch (error) {
    console.error('Error fetching health dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching health dashboard data',
      error: error.message
    });
  }
});

// Update user details route
router.put('/update/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            age,
            height,
            weight,
            gender,
            activityLevel,
            goals,
            goalWeight,
            weightchangeRate
        } = req.body;

        // Find the regular user
        const regularUser = await RegularUser.findOne({ UserId: userId });
        if (!regularUser) {
            return res.status(404).json({ 
                success: false, 
                message: "Regular user not found" 
            });
        }

        // Calculate new metrics
        const bmi = calculateBMI(weight, height);
        const bmr = calculateBMR(weight, height, age, gender);
        const tdee = calculateTDEE(bmr, activityLevel);
        
        // Calculate goal calories based on weight goals
        let goalCalories = tdee;
        if (goals.includes('Lose Weight')) {
            goalCalories = tdee - (500 * parseFloat(weightchangeRate || 1));
        } else if (goals.includes('Gain Weight')) {
            goalCalories = tdee + (500 * parseFloat(weightchangeRate || 1));
        }

        // Calculate new macro distribution
        const macros = getMacroDistribution(goalCalories, goals[0]);

        const formattedMacros = {
          protein: macros.protein,
          carbs: macros.carbs,
          nonFiberCarbs: macros.nonFiberCarbs,
          fiber: macros.fiber,
          fats: macros.fats,
          calories: macros.calories.toString()// Convert to string to match schema
        };

        // Update user details
        const updatedUser = await RegularUser.findOneAndUpdate(
            { UserId: userId },
            {
                $set: {
                    age,
                    height,
                    weight,
                    gender,
                    activityLevel,
                    goals,
                    goalWeight,
                    weightchangeRate,
                    bmi,
                    bmr,
                    tdee,
                    goalCalories,
                    macros: formattedMacros,
                    updatedAt: new Date()
                }
            },
            { new: true }
        );

        // Add weight to history if it changed
        if (weight !== regularUser.weight) {
            await RegularUser.findOneAndUpdate(
                { UserId: userId },
                {
                    $push: {
                        weightHistory: {
                            date: new Date(),
                            weight: parseFloat(weight)
                        }
                    }
                }
            );
        }

        res.json({
            success: true,
            message: "User details updated successfully",
            data: {
                ...updatedUser.toObject(),
                weightHistory: undefined // Exclude weight history from response
            }
        });

    } catch (error) {
        console.error('Error updating user details:', error);
        res.status(500).json({
            success: false,
            message: "Error updating user details",
            error: error.message
        });
    }
});

// Helper functions
function getBmiCategory(bmi) {
  if (bmi < 18.5) return { category: 'Underweight', color: '#3498db' };
  if (bmi < 25) return { category: 'Normal', color: '#2ecc71' };
  if (bmi < 30) return { category: 'Overweight', color: '#f39c12' };
  return { category: 'Obese', color: '#e74c3c' };
}

function calculateIdealWeight(height) {
  // Using Devine formula
  const heightInMeters = height / 100;
  return (22 * heightInMeters * heightInMeters).toFixed(1);
}

function calculateWaterIntake(weight) {
  // General recommendation: 30-35 mL per kg of body weight
  return (weight * 0.033).toFixed(1);
}

// Helper function to get recommendation based on BMI and goals
function getRecommendation(bmi, goals, currentWeight, goalWeight) {
  if (!goals || goals.length === 0) return null;

  const primaryGoal = goals[0];
  let recommendation = {
    type: primaryGoal,
    message: '',
    suggestion: ''
  };

  if (bmi < 18.5) {
    if (primaryGoal === "Maintain Weight") {
      recommendation.message = "Your BMI indicates you're underweight";
      recommendation.suggestion = "Consider focusing on healthy weight gain instead of maintenance";
    }
  } else if (bmi >= 25) {
    if (primaryGoal === "Maintain Weight") {
      recommendation.message = "Your BMI indicates you're above healthy range";
      recommendation.suggestion = "Consider focusing on gradual weight loss for better health";
    }
  } else {
    // Normal BMI range
    recommendation.message = "You're in a healthy BMI range";
    recommendation.suggestion = "Great job! Keep maintaining your current habits";
  }

  return recommendation;
}

module.exports = router;