const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    studentRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentRequest' },
    name: String,
    admissionNumber: String,
    disease: String,
    date: { type: Date },
    timeSlot: String,
    token: String,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);
