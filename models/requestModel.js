// Student Request Model
const mongoose = require('mongoose');

const studentRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    name: String,
    admissionNumber: String,
    disease: String,
    status: { type: String, enum: [ 'Approve','Approved', 'add prescription','Done'], default: 'Approve' }
});

module.exports = mongoose.model('StudentRequest', studentRequestSchema);