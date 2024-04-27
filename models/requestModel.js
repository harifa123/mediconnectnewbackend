const mongoose = require('mongoose');
const moment = require('moment-timezone');

const studentRequestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    name: String,
    admissionNumber: String,
    disease: String,
    status: { type: String, enum: ['Approve', 'Approved', 'add prescription', 'Done'], default: 'Approve' },
    date: { type: Date },
    timeSlot: String,
    sequenceNumber: { type: Number, default: 0 },
    token: String,
    createdAt: { type: Date, default: Date.now }
});

// Pre-save hook to parse date string to Date object
studentRequestSchema.pre('save', function(next) {
    if (this.date && typeof this.date === 'string') {
        this.date = moment(this.date, 'YYYY-MM-DD').startOf('day').toDate();
    }
    next();
});

module.exports = mongoose.model('StudentRequest', studentRequestSchema);