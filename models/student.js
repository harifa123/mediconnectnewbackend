const mongoose = require('mongoose');
const Prescription = require('../models/prescriptionModel');

// Define the schema for Student
const studentSchema = new mongoose.Schema({
    name:{type:String},
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
    temporaryPassword: {
        type: String
    },
    password: {
        type: String
    },
    status: {
        type: String,
        enum: ['Approve', 'Approved', 'add prescription', 'Done'],
        default: 'Approve'
    },
    token: { type: Number, default: 0 },
    timeSlot: {
        startTime: { type: Date },
        endTime: { type: Date }
    },
    prescription: Prescription.schema
});

// Create and export the Student model
module.exports = mongoose.model('Student', studentSchema);
