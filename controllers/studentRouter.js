
const express = require("express")
const bcrypt = require("bcryptjs")
const router = express.Router()
const mongoose = require('mongoose');
const Student = require('../models/student');
const nodemailer = require('nodemailer');
const StudentRequest = require('../models/requestModel');
const Counter = require('../models/counterModel');
const Prescription = require('../models/prescriptionModel');

require("dotenv").config();


//Route to handle student registration request
router.post('/register-request', async (req, res) => {
    const { email, admissionNumber } = req.body;

    try {
        // Check if student already exists
        const existingStudent = await Student.findOne({ email, admissionNumber });

        if (!existingStudent) {
            return res.status(400).json({ message: 'Student not found. Please check your email and admission number.' });
        }

        if (existingStudent.password) {
            return res.status(401).json({ message: 'You have already registered. ' });
        }

        // Generate and save temporary password
        const temporaryPassword = Math.random().toString(36).slice(-8); // Generate random temporary password
        existingStudent.temporaryPassword = temporaryPassword;
        await existingStudent.save();

        // Send temporary password to student's email

        const transporter = nodemailer.createTransport({
            service: "gmail",
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // Use true for port 465, false for all other ports
            auth: {
                user: process.env.USER,
                pass: process.env.APP_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: process.env.USER,
            to: email,
            subject: 'Temporary Password for Student Registration',
            text: `Your temporary password is: ${temporaryPassword}`
        });
        console.log(temporaryPassword)

        // Send response with user ID
        res.status(200).json({ message: 'Temporary password sent successfully. Check your email.', userId: existingStudent._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Route to handle student registration with temporary password
router.post('/register', async (req, res) => {
    const { _id, temporaryPassword } = req.body;

    try {
        // Find the student by email and temporary password
        const existingStudent = await Student.findOne({ _id, temporaryPassword });

        if (!existingStudent) {
            return res.status(400).json({ message: 'Invalid temporary password. Please try again.' });
       }

        
        res.status(200).json({ message: 'Registration successful. You can now set the permenant password.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


router.post('/set-password', async (req, res) => {
    const { _id, password } = req.body;

    try {
        // Find the student by email
        const existingStudent = await Student.findOne({ _id });
        console.log(existingStudent)

        if (!existingStudent) {
            return res.status(400).json({ message: 'Student not found. Please check your email.' });
        }

        // Check if temporary password has been used
        if (!existingStudent.temporaryPassword) {
            return res.status(400).json({ message: 'Temporary password must be used before setting permanent password.' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Set the permanent password and save
        existingStudent.password = hashedPassword;
        await existingStudent.save();

        // Clear temporary password
        existingStudent.temporaryPassword = undefined;
        await existingStudent.save();


        res.status(200).json({ message: 'Permanent password set successfully. You can now login with your permanent password.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Route to handle student login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Find the student by email
        const existingStudent = await Student.findOne({ email });

        if (!existingStudent) {
            return res.status(400).json({ message: 'Student not found. Please check your email.' });
        }

        // Check if permanent password is set
        if (!existingStudent.password) {
            return res.status(400).json({ message: 'Please set your permanent password before logging in.' });
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, existingStudent.password);

        if (!passwordMatch) {
            return res.status(400).json({ message: 'Invalid password. Please try again.' });
        }

        // Passwords match, login successful
        res.status(200).json({ message: 'Login successful.', _id: existingStudent._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});














// Endpoint to handle student registration request
router.post('/student-request', async (req, res) => {
    const { userId, name, admissionNumber, disease } = req.body;

    try {
        // Create a new student request
        const studentRequest = new StudentRequest({
            userId: userId,
            name, admissionNumber, disease
        });

        // Save the student request to the database
        await studentRequest.save();

        res.status(200).json({ message: 'Student request submitted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Endpoint to fetch all student requests for the doctor's interface
router.post('/doctor-view-requests', async (req, res) => {
    try {
        // Fetch all requests from the database
        const requests = await StudentRequest.find();
        res.status(200).json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


async function generateTimeSlotAndToken(student) {
    // Find the latest token from the database
    const latestToken = await StudentRequest.findOne({}, {}, { sort: { 'token': -1 } });

    // Increment the latest token by 1 to generate a new token
    const newToken = latestToken && !isNaN(latestToken.token) ? latestToken.token + 1 : 1;

    // Generate time slot for the new appointment
    const currentTime = new Date();
    const consultationTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    let startTime;
    if (latestToken && latestToken.timeSlot && latestToken.timeSlot.endTime) {
        startTime = new Date(latestToken.timeSlot.endTime.getTime() + 1000); // Start from 1 second after the end time of the previous appointment
    } else {
        startTime = new Date(currentTime.setHours(9, 0, 0, 0)); // Start from 9 AM of the current day
    }


    const endTime = new Date(startTime.getTime() + consultationTime); // End time is 5 minutes after start time

    return { startTime, endTime, token: newToken };
}


// Define API endpoint for approving requests
router.put('/approve-request', async (req, res) => {
    const { userId } = req.body;

    try {
        // Find the request by student ID and ensure it's not already completed
        let request = await StudentRequest.findOneAndUpdate(
            {
                userId: userId,
                status: { $nin: ['add prescription', 'Done'] },
            },
            { status: 'Approved' },
            { new: true }
        );

        if (!request) {
            return res.status(400).json({ message: 'Request not found or already completed.' });
        }

        // Generate time slot and token
        const { startTime, endTime, token } = await generateTimeSlotAndToken(request);

        // Update student with generated time slot and token
        const student = await Student.findOneAndUpdate(
            { userId: userId },
            {
                token: token,
                timeSlot: { startTime: startTime, endTime: endTime }
            },
            { new: true }
        );

        if (!student) {
            return res.status(400).json({ message: 'Student not found.' });
        }

        res.status(200).json({ message: 'Request status updated successfully.', timeSlot: student.timeSlot });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});




router.post('/submit-prescription', async (req, res) => {
    const { userId, doctorNotes, medication } = req.body;

    try {
        // Update student request status to 'add prescription' if it's 'Approved'
        const request = await StudentRequest.findOneAndUpdate(
            { userId: userId, status: 'Approved' },
            { status: 'add prescription' },
            { new: true }
        );
        
        if (!request) {
            return res.status(404).json({ message: 'Student request not found or not in "Approved" status.' });
        }

        const prescription = new Prescription({
            userId: userId,
            doctorNotes,
            medication,
            // Other prescription fields as needed
        });

        // Save the prescription to the database
        await prescription.save();

        // Update the student's profile with the prescription details
        const student = await Student.findById(userId).populate('prescription');
        if (!student) {
            return res.status(400).json({ message: 'Student not found.' });
        }

        student.status=request.status;

        // Update student's profile with prescription details
        student.prescription = prescription;
        await student.save();

        res.status(200).json({ message: 'Prescription submitted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



async function resetTokenCounter() {
    try {
        const counter = await Counter.findOneAndUpdate(
            { _id: 'tokenCounter' },
            { seq: 0 }, // Set the sequence value to 1
            { new: true, upsert: true }
        );
        console.log('Token counter reset successfully.');
    } catch (error) {
        console.error('Error resetting token counter:', error);
    }
}

router.put('/restart-counter', async (req, res) => {
    // Reset the token counter
    await resetTokenCounter();

    // Your existing route handler code...
});


router.post('/view', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const student = await Student.findOne({ userId }).populate('prescription');
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


module.exports = router;
