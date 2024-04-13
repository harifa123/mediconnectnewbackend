const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    doctorNotes: String,
    medicine: String,
    dosage: String,
    instructions: String,
    // Other prescription fields as needed
});

module.exports = mongoose.model('Prescription', prescriptionSchema);