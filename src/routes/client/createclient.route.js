const express = require('express');
const router = express.Router();
const ClientUser = require('../../models/clientUser.model');
const Nutritionist = require('../../models/Nutritionist.model');
const User = require('../../models/user')
const calculateBMI = require('../../utils/bmi')
const calculateBMR = require('../../utils/bmr')
const calculateTDEE = require('../../utils/tdee')
const calculateGoalCalories = require('../../utils/goalCalories')
const getMacroDistribution = require('../../utils/macroDistribution')

router.post('/create-client-nutritional-profile', async (req, res) => {
  try {

    const {UserId, NutritionistId, age, height, weight, gender, activityLevel, goals, 
      onboardingStatus,
      healthConditions,
      diabetesMeds,
      insulinUse,
      pcosMeds,
      thyroidType,
      tshLevels, 
      goalWeight, 
      weightchangeRate, 
      permissions
    } = req.body;
    console.log(req.body);
    // Check if the client exists in the User collection
    const existingClient = await User.findById(UserId);
    
    
    if (!existingClient) {
      return res.status(404).json({
        success: false,
        message: 'Client not found (kindly add client before creating nutritional profile)',
      });
    }

    // Check if the client already has a nutritional profile (Optional)
    const existingProfile = await ClientUser.findOne({ userId: UserId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: 'Nutritional profile already exists for this client',
      });
    }
    const bmi = calculateBMI(weight, height)
    const bmr = calculateBMR(weight, height, age, gender);
    const tdee = calculateTDEE(bmr, activityLevel);
    const goalCalories = calculateGoalCalories(tdee, goals, weightchangeRate, goalWeight);
    const macros = getMacroDistribution(tdee, goals, healthConditions.length ? healthConditions : null);

    // Create the nutritional profile with a unique _id and reference userId
    const clientData = {...req.body, bmi,bmr,tdee,goalCalories,macros}
    
    const newNutritionalProfile = new ClientUser(clientData);
    await newNutritionalProfile.save();
    
    // const nutritionist = await Nutritionist.findById({NutritionistId})
    // console.log("Hiiiiiiiiiiiiiiiii", nutritionist);
    
    // if(nutritionist){
    //   const updatedNutritionist = await User.findByIdAndUpdate(
    //     nutritionist._id,
    //     { $push: { clients: savedUser._id } },
    //     { new: true }
    //   );
    //   console.log("Hiii",updatedNutritionist);
    // }
    

    res.status(201).json({
      success: true,
      message: 'Nutritional profile created successfully',
      client: newNutritionalProfile,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating nutritional profile',
      error: error.message,
    });
  }
});


router.post('/check-client-exist', async(req, res)=>{
  const {id} = req.body;

  const clientExist = await ClientUser.findOne({UserId: id})
  if(clientExist){
    res.json({clientExist: true, clientInfo: clientExist})
  }else{
    res.json({clientExist: false})
  }
})


router.post('/get-clientProfile', async (req, res) => {
  try {
    const { NutritionistId } = req.body;

    if (!NutritionistId) {
      return res.status(400).json({ msg: "Nutritionist ID is required" });
    }

    const clientList = await User.find({ createdBy: NutritionistId });

    if (clientList.length === 0) {
      return res.status(404).json({ msg: "No clients found for this nutritionist" });
    }

    const clientProfile = await Promise.all(
      clientList.map(async (client) => {
        console.log(client._id);
        return await ClientUser.find({ UserId: client._id });
      })
    );

    return res.json({
      msg: "Clients Fetched Successfully",
      clientUsers: clientList,
      clientUsersProfile: clientProfile.flat()
    });

  } catch (error) {
    console.error("Error fetching client profiles:", error);
    return res.status(500).json({ msg: "Server Error", error: error.message });
  }
});


router.put('/update-client-nutritional-profile', async (req, res) => {
  try {
    const { profileId, ...clientData } = req.body;
    console.log("Client data received:", clientData);
    
    if (!profileId) {
      return res.status(400).json({
        success: false,
        message: 'Profile ID is required',
      });
    }
    
    // Find the existing profile
    const existingProfile = await ClientUser.findOne({UserId: profileId});
    
    if (!existingProfile) {
      return res.status(404).json({
        success: false,
        message: 'Nutritional profile not found',
      });
    }
    
    // Define updates variable from clientData
    const updates = { ...clientData };
    
    // Track changes by creating a history entry
    if (!existingProfile.changeHistory) {
      existingProfile.changeHistory = [];
    }
    
    // Store previous values that have changed
    const changes = {};
    for (const [key, value] of Object.entries(updates)) {
      // Skip tracking for some fields if needed
      if (key !== 'changeHistory' && existingProfile[key] !== value) {
        changes[key] = {
          previous: existingProfile[key],
          new: value
        };
      }
    }
    
    // Only add to history if there are actual changes
    if (Object.keys(changes).length > 0) {
      existingProfile.changeHistory.push({
        changedAt: new Date(),
        changedBy: updates.changedBy || 'system', // Add user ID who made changes if available
        changes
      });
    }
    

    
    // Recalculate BMI if weight or height changes
    if (updates.weight || updates.height) {
      // Parse values to numbers
      const weight = parseFloat(updates.weight || existingProfile.weight || 0);
      const height = parseFloat(updates.height || existingProfile.height || 0);
      
      console.log("BMI calculation inputs:", { weight, height });
      
      // Only calculate if both values are valid
      if (weight > 0 && height > 0) {
        try {
          updates.bmi = calculateBMI(weight, height);
          console.log("BMI calculated:", updates.bmi);
        } catch (calcError) {
          console.error("BMI calculation error:", calcError);
        }
      }
    }
    
    // Recalculate BMR if relevant values change
    if (updates.weight || updates.height || updates.age || updates.gender) {
      // Parse values to numbers and ensure gender is lowercase as expected by the function
      const weight = parseFloat(updates.weight || existingProfile.weight || 0);
      const height = parseFloat(updates.height || existingProfile.height || 0);
      const age = parseInt(updates.age || existingProfile.age || 0);
      const gender = (updates.gender || existingProfile.gender || '').toLowerCase();
      
      console.log("BMR calculation inputs:", { weight, height, age, gender });
      
      // Only calculate if all values are valid
      if (weight > 0 && height > 0 && age > 0 && gender) {
        try {
          updates.bmr = calculateBMR(weight, height, age, gender);
          console.log("BMR calculated:", updates.bmr);
        } catch (calcError) {
          console.error("BMR calculation error:", calcError);
        }
      }
    }
    
    // Calculate TDEE if BMR or activity level changes
    if (updates.bmr || updates.activityLevel || updates.weight || updates.height || updates.age || updates.gender) {
      const bmr = parseInt(updates.bmr || existingProfile.bmr || 0);
      const activityLevel = updates.activityLevel || existingProfile.activityLevel;
      
      console.log("TDEE calculation inputs:", { bmr, activityLevel });
      
      // Only calculate if we have valid BMR and activity level
      if (bmr > 0 && activityLevel) {
        try {
          updates.tdee = calculateTDEE(bmr, activityLevel);
          console.log("TDEE calculated:", updates.tdee);
        } catch (calcError) {
          console.error("TDEE calculation error:", calcError);
        }
      }
    }
    
    // Calculate goal calories if necessary inputs change
    if (updates.tdee || updates.goals || updates.weightchangeRate || updates.goalWeight) {
      const tdee = parseInt(updates.tdee || existingProfile.tdee || 0);
      const goals = updates.goals || existingProfile.goals;
      const weightchangeRate = parseFloat(updates.weightchangeRate || existingProfile.weightchangeRate || 0);
      const goalWeight = parseFloat(updates.goalWeight || existingProfile.goalWeight || 0);
      
      if (tdee > 0 && goals) {
        try {
          updates.goalCalories = calculateGoalCalories(tdee, goals, weightchangeRate, goalWeight);
        } catch (calcError) {
          console.error("Goal calories calculation error:", calcError);
        }
      }
    }
    
    // Calculate macros if necessary inputs change
    if (updates.tdee || updates.goals || updates.healthConditions) {
      const tdee = parseInt(updates.tdee || existingProfile.tdee || 0);
      const goals = updates.goals || existingProfile.goals;
      const healthConditions = updates.healthConditions || existingProfile.healthConditions;
      
      if (tdee > 0 && goals) {
        try {
          updates.macros = getMacroDistribution(tdee, goals, healthConditions);
        } catch (calcError) {
          console.error("Macros calculation error:", calcError);
        }
      }
    }
    
    console.log("Final updates to be applied:", updates);
    
    // Update the profile with new values
    const updatedProfile = await ClientUser.findOneAndUpdate(
      { UserId: profileId },
      { $set: { ...updates, changeHistory: existingProfile.changeHistory } },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Nutritional profile updated successfully',
      client: updatedProfile,
      changesTracked: Object.keys(changes).length > 0 ? changes : null
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating nutritional profile',
      error: error.message,
    });
  }
});

router.post('/delete-client-nutritional-profile', async (req, res) => {
  try {
    const { id } = req.body;
    console.log(req.body)
    // Check if the client profile exists
    const existingProfile = await ClientUser.findOne({ UserId: id });
    
    // if (!existingProfile) {
    //   return res.status(404).json({
    //     success: false,
    //     message: 'Nutritional profile not found',
    //   });
    // }
    
    // Delete the client profile

    if(existingProfile){
      await ClientUser.findOneAndDelete({ UserId: id });
    }
    const baseprofile = await User.findByIdAndDelete(id)
    console.log(baseprofile);
    
    
    res.status(200).json({
      success: true,
      message: 'Nutritional profile deleted successfully',
    });
    
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting nutritional profile',
      error: error.message,
    });
  }
});

module.exports = router;