const mongoose = require('mongoose');

const CollectionSchema = new mongoose.Schema({
    nutritionistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nutritionist', required: true },
    name: { type: String, required: true },
    items: [{ type: mongoose.Schema.Types.ObjectId, refPath: 'type' }], // Dynamic reference
    createdAt: { type: Date, default: Date.now }
});
    
module.exports = mongoose.model('Collection', CollectionSchema);
