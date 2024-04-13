const mongoose = require('mongoose');
const Prescription = require('../models/prescriptionModel');

const studentSchema = new mongoose.Schema({
    name: { type: String },
    email: {
        type: String,
        unique: true,
        required: true
    },
    admissionNumber: {
        type: String,
        unique: true,
        required: true
    },
    temporaryPassword: { type: String },
    password: { type: String },
    status: {
        type: String,
        enum: ['Approve', 'Approved', 'add prescription', 'Done'],
        default: 'Approve'
    },
    timeSlot: {
        startTime: { type: Date, unique: true },
        endTime: { type: Date }
    },
    prescription: Prescription.schema
});

module.exports = mongoose.model('Student', studentSchema);