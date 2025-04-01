const express = require('express');
const mongoose = require('mongoose');
const Nutritionist = require('../../models/Nutritionist.model');
const router = express.Router();

// Create Nutritionist Complete Profile
router.post('/complete-profile', async (req, res) => {
    try {
        console.log(req.body);
        const { UserId, brandname, brandlogo, experience, gender, age, specialization, certifications } = req.body;
        

        // Validate required fields
        if (!UserId || !brandname || !experience || !gender || !age) {
            return res.status(400).json({ message: "All fields are required except brand logo." });
        }

        const savedNutritionist = await new Nutritionist({
            UserId,
            gender,
            age,
            experience,
            brandname,
            brandlogo,
            specialization,
            certifications
        }).save();

        console.log("Nutritionist Profile Created:", savedNutritionist);

        res.status(201).json({ savedNutritionist, NutritionistId: savedNutritionist._id });
    } catch (error) {
        console.log("Error Saving Nutritionist:", error);
        res.status(400).json({ message: error.message });
    }
});



router.post('/get-nutri-info', async (req, res) => {
    try {
      const {id} = req.body
      
      const nutritionist = await Nutritionist.findOne({UserId: id});
      
      if (!nutritionist) {
        return res.status(404).json({ message: "Nutritionist not found" });
      }
      
      res.status(200).json(nutritionist);
    } catch (error) {
      console.log("Error fetching nutritionist:", error);
      res.status(500).json({ message: error.message });
    }
  });


module.exports = router;