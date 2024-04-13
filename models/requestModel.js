const mongoose = require('mongoose');

const studentRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    name: String,
    admissionNumber: String,
    disease: String,
    status: { type: String, enum: ['Approve', 'Approved', 'add prescription', 'Done'], default: 'Approve' },
    timeSlot: {
        startTime: { type: Date },
        endTime: { type: Date }
    },
    sequenceNumber: { type: Number, default: 0 },
    token: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StudentRequest', studentRequestSchema);