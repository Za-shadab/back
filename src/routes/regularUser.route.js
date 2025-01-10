const express = require('express');
const mongoose = require('mongoose');
const RegularUser = require('../models/regularUser.model'); // Adjust the path based on your file structure

const router = express.Router();

// CREATE: Add a new regular user
router.post('/regularUsers', async (req, res) => {
    try {
        const regularUser = new RegularUser(req.body);
        const savedUser = await regularUser.save();
        res.status(201).json(savedUser);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});


// Get: Info of Regular User along with User
router.get('/regular-users', async(req, res, next) => {
    try {
        console.log(req.body);
        const {userId} = req.params
        const regularUser = await RegularUser.findOne({'userId': userId}).populate('UserId');

        res.status(200).json({
            msg:"fetched Successfully",
            regularUser
        });
    } catch (error) {
        next(error)
    }
})

module.exports = router;