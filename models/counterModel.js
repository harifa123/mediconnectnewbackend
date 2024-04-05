const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
    startTime: { type: Date }, // Start time of the time slot
    endTime: { type: Date }    // End time of the time slot
});

module.exports = mongoose.model('Counter', counterSchema);
