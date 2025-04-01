const express = require('express');
const DietaryPreference = require('../models/dietary.models');
const mongoose = require('mongoose');
const RegularUser = require('../models/regularUser.model');
const ClientUser = require('../models/clientUser.model');

const router = express.Router();

// POST request to store dietary preferences
router.post('/dietary-preferences', async (req, res) => {
    try {
        const { regularUserId, clientUserId, allergens, dietType } = req.body;

        if (!regularUserId && !clientUserId) {
            return res.status(400).json({ message: 'Either regularUserId or clientUserId is required.' });
        }

        // First, save the dietary preference
        const dietaryPreference = new DietaryPreference({
            regularUserId,
            clientUserId,
            allergens,
            dietType,
        });

        await dietaryPreference.save();

        let updatedUser = null;

        // Update the corresponding user and ensure it exists
        if (regularUserId) {
            updatedUser = await RegularUser.findByIdAndUpdate(
                regularUserId, 
                { dietaryPreference: dietaryPreference._id }, 
                { new: true }
            );
        } else if (clientUserId) {
            updatedUser = await ClientUser.findByIdAndUpdate(
                clientUserId, 
                { dietaryPreference: dietaryPreference._id }, 
                { new: true }
            );
        }

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(201).json({ message: 'Dietary preference saved successfully', dietaryPreference, updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});


// GET request to fetch dietary preferences by regularUserId or clientUserId
router.get('/dietary-preferences', async (req, res) => {
    try {
        const { regularUserId, clientUserId } = req.body;

        if (!regularUserId && !clientUserId) {
            return res.status(400).json({ message: 'Either regularUserId or clientUserId is required.' });
        }

        const query = {};
        if (regularUserId) query.regularUserId = new mongoose.Types.ObjectId(regularUserId);
        if (clientUserId) query.clientUserId = new mongoose.Types.ObjectId(clientUserId);

        const dietaryPreferences = await DietaryPreference.find(query);
        res.status(200).json(dietaryPreferences);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;