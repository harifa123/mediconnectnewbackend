const mongoose = require('mongoose');

const doctorLeaveSchema = new mongoose.Schema({
    date: { type: Date },
    reason: String
});

module.exports = mongoose.model('DoctorLeave', doctorLeaveSchema);