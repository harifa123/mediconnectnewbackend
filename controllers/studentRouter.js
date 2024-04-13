
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
const cron = require('node-cron');
const moment = require('moment-timezone');

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
            return res.status(401).json({ message: 'Student not found. Please check your email.' });
        }

        // Check if permanent password is set
        if (!existingStudent.password) {
            return res.status(400).json({ message: 'Please set your permanent password before logging in.' });
        }

        // Compare passwords
        const passwordMatch = await bcrypt.compare(password, existingStudent.password);

        if (!passwordMatch) {
            return res.status(402).json({ message: 'Invalid password. Please try again.' });
        }

        // Passwords match, login successful
        res.status(200).json({ message: 'Login successful.', _id: existingStudent._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// // Endpoint to handle student registration request
// router.post('/student-request', async (req, res) => {
//     const { userId, name, admissionNumber, disease } = req.body;

//     try {
//         // Create a new student request
//         const studentRequest = new StudentRequest({
//             userId: userId,
//             name, admissionNumber, disease
//         });

//         // Save the student request to the database
//         await studentRequest.save();

//         res.status(200).json({ message: 'Student request submitted successfully.' });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Internal Server Error' });
//     }
// });


// Endpoint to fetch all student requests for the doctor's interface
// router.post('/doctor-view-requests', async (req, res) => {
//     try {
//         // Fetch all requests from the database
//         const requests = await StudentRequest.find();
//         res.status(200).json(requests);
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Internal Server Error' });
//     }
// });



router.post('/doctor-view-requests', async (req, res) => {
    try {
        const { date } = req.body;
        const filter = {};
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
        }
        const requests = await StudentRequest.find(filter);
        if (requests.length === 0) {
            return res.status(404).json({ message: 'No student requests found for the specified date' });
        }
        res.status(200).json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


router.get('/doctor-requests-all', async (req, res) => {
    try {
        const requests = await StudentRequest.find();
        res.status(200).json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


let timeSlotQueue = []; // Define time slot queue globally

function initializeTimeSlotQueue() {
    return new Promise((resolve, reject) => {
        console.log("Initializing time slot queue...");
        const today = moment.tz('Asia/Kolkata'); // Get the current date and time in IST
        const nextConsultationDay = today.clone().add(1, 'days'); // Set to the next day

        const isWeekend = today.day() === 0 || today.day() === 6; // Check if it's Saturday or Sunday
        const isConsultationDay = today.hours() >= 9 && today.hours() < 17 && !isWeekend;

        let timeSlotTime;
        if (isConsultationDay) {
            timeSlotTime = today.clone().hours(9).minutes(0).seconds(0).milliseconds(0); // Start from 9 AM today
        } else {
            timeSlotTime = moment.tz(nextConsultationDay, 'Asia/Kolkata').hours(9).minutes(0).seconds(0).milliseconds(0); // Start from 9 AM next consultation day
        }

        const consultationEnd = moment.tz(nextConsultationDay, 'Asia/Kolkata').hours(17).minutes(0).seconds(0).milliseconds(0); // Set the end time for consultation in IST

        while (timeSlotTime.isBefore(consultationEnd)) {
            timeSlotQueue.push({ startTime: timeSlotTime.clone(), endTime: timeSlotTime.clone().add(5, 'minutes') });
            timeSlotTime.add(5, 'minutes');
        }

        // Print all the time slots in IST
        timeSlotQueue.forEach((slot, index) => {
            console.log(`Slot ${index + 1}: ${slot.startTime.format('YYYY-MM-DD HH:mm:ss')} - ${slot.endTime.format('YYYY-MM-DD HH:mm:ss')}`);
        });

        console.log("Time slot queue initialized with", timeSlotQueue.length, "time slots.");
        console.log("Last time slot generated:", timeSlotQueue.length > 0 ? timeSlotQueue[timeSlotQueue.length - 1] : "None");
        resolve(); // Resolve the promise once initialization is complete
    });
}


function resetTimeSlotQueue() {
    console.log("Resetting time slot queue...");
    timeSlotQueue = [];
    initializeTimeSlotQueue();
}

function scheduleTimeSlotQueueReset() {
    const now = moment.tz('Asia/Kolkata'); // Get the current date and time in IST
    const endOfDay = moment.tz('Asia/Kolkata').endOf('day'); // Get the end of the current day in IST
    const timeUntilEndOfDay = endOfDay.diff(now); // Calculate the time until the end of the day
    setTimeout(() => {
        resetTimeSlotQueue(); // Reset the time slot queue
        scheduleTimeSlotQueueReset(); // Schedule the reset for the next day
    }, timeUntilEndOfDay);
}


//Initialize the time slot queue and schedule the reset function
initializeTimeSlotQueue();
scheduleTimeSlotQueueReset();

//Function to assign a time slot to a user
//Function to assign a time slot to a user
//Function to assign a time slot to a user
async function assignTimeSlotToUser(userId) {
    console.log("Assigning time slot to user:", userId);
    if (timeSlotQueue.length === 0) {
        throw new Error("No available time slots");
    }
    let timeSlot = null;
    for (let i = 0; i < timeSlotQueue.length; i++) {
        // Get the current date and time in IST
        const currentTimeIST = moment.tz('Asia/Kolkata');

        // Use the current time to adjust the dates in the timeSlotQueue array
        const startTimeIST = timeSlotQueue[i].startTime.clone().tz('Asia/Kolkata');
        const endTimeIST = timeSlotQueue[i].endTime.clone().tz('Asia/Kolkata');

        // Check if the time slot is within the consultation hours (Monday to Friday, 9 AM to 5 PM)
        if (startTimeIST.day() >= 1 && startTimeIST.day() <= 5 &&
            startTimeIST.hours() >= 9 && startTimeIST.hours() < 17) {
            // Check if the time slot is after the current booking timestamp
            if (startTimeIST > currentTimeIST) {
                timeSlot = { startTime: startTimeIST, endTime: endTimeIST };
                timeSlotQueue.splice(i, 1); // Remove the assigned time slot from the queue
                break;
            }
        }
    }
    if (!timeSlot) {
        throw new Error("No available time slots for tomorrow");
    }
    try {
        // Assuming StudentRequest is your Mongoose model
        const updatedRequest = await StudentRequest.findOneAndUpdate(
            { userId, status: 'Approve' },
            { $set: { timeSlot: timeSlot } }, // Ensure the time slot is saved in IST format
            { new: true }
        );
        console.log("Assigned time slot:", timeSlot);
        console.log("Updated request:", updatedRequest);
    } catch (error) {
        console.error("Error assigning time slot to user:", userId, error);
        throw error;
    }
}

//Updated code for /student-form-request endpoint with error handling
router.post('/student-request', async (req, res) => {
    try {
        const { userId, name, admissionNumber, disease } = req.body;
        if (!userId) {
            return res.status(400).send("Error: userId is required");
        }
        const maxSequenceNumberRequest = await StudentRequest.findOne().sort('-sequenceNumber');
        const sequenceNumber = maxSequenceNumberRequest ? maxSequenceNumberRequest.sequenceNumber + 1 : 1;
        const newRequest = new StudentRequest({
            userId,
            name,
            admissionNumber,
            disease,
            status: 'Approve',
            timeSlot: null,
            sequenceNumber
        });
        await newRequest.save();
        res.status(201).send("Request submitted successfully, Please check for the Email for the confirmation");
    } catch (err) {
        console.error("Error processing student form request:", err);
        res.status(500).send("Internal Server Error");
    }
});

// Schedule the task to run every 5 minutes, 24/7

cron.schedule('*/1 * * * *', async () => {
    try {
        // Fetch pending requests
        const pendingRequests = await StudentRequest.find({
            status: 'Approve',
            createdAt: { $lte: new Date() } // Filter by requests created before or at the current time
        }).sort({ createdAt: 1 }); // Sort by creation time in ascending order (FIFO)

        // Approve requests and send confirmation emails
        let slotCount = 0; // Counter to track the number of allocated time slots
        for (const request of pendingRequests) {
            // Check if the maximum number of time slots for the day (96 slots) is reached
            if (slotCount >= 96) {
                console.log('Maximum time slots reached for the day.');
                break; // Exit loop if maximum slots reached
            }

            await assignTimeSlotToUser(request.userId);
            request.status = 'Approved';
            const student = await Student.findById(request.userId);
            student.status = request.status;
            await student.save();
            const token = `MC${request.sequenceNumber}`;
            request.token = token;
            await request.save();

            // Wait for a short duration to ensure the database is updated
            await new Promise(resolve => setTimeout(resolve, 1000)); // Adjust the duration as needed

            // Fetch the updated request data from the database
            const updatedRequest = await StudentRequest.findById(request._id);

            // Get the time slot and token from the updated request
            const timeSlotStartTime = moment(updatedRequest.timeSlot.startTime).tz('Asia/Kolkata');
            const timeSlotEndTime = moment(updatedRequest.timeSlot.endTime).tz('Asia/Kolkata');
            const timeSlot = timeSlotStartTime.format('YYYY-MM-DD HH:mm') + ' - ' + timeSlotEndTime.format('HH:mm');
            const date = timeSlotStartTime.format('YYYY-MM-DD');
            const email = student.email; // Assuming email is stored in student document

            // Send confirmation email
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
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
                subject: 'Booking Confirmation',
                text: `Your booking has been confirmed for ${date}.\nTime Slot (IST): ${timeSlot}\nToken: ${token}`,
            });

            console.log(`Confirmation email sent to ${email}`);
            slotCount++; // Increment slot counter
        }

        console.log('Scheduled task: Approved pending requests and sent confirmation emails successfully.');
    } catch (err) {
        console.error('Scheduled task error:', err);
        // Optionally, send an alert/notification to administrators about the error
    }
});


router.post('/submit-prescription', async (req, res) => {
    const { userId, doctorNotes, medicine,dosage,instructions } = req.body;

    try {
        // Update student request status to 'add prescription' if it's 'Approved'
        const request = await StudentRequest.findOneAndUpdate(
            { userId: userId, status: 'Approved' },
            { status: 'Done' },
            { new: true }
        );
        
        if (!request) {
            return res.status(404).json({ message: 'Student request not found or not in "Approved" status.' });
        }

        const prescription = new Prescription({
            userId: userId,
            doctorNotes,
            medicine,
            dosage,
            instructions
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



// async function resetTokenCounter() {
//     try {
//         const counter = await Counter.findOneAndUpdate(
//             { _id: 'tokenCounter' },
//             { seq: 0 }, // Set the sequence value to 1
//             { new: true, upsert: true }
//         );
//         console.log('Token counter reset successfully.');
//     } catch (error) {
//         console.error('Error resetting token counter:', error);
//     }
// }

// router.put('/restart-counter', async (req, res) => {
//     // Reset the token counter
//     await resetTokenCounter();

//     // Your existing route handler code...
// });


router.post('/viewprofile', async (req, res) => {
    try {
        const { _id } = req.body;
        if (!_id) {
            return res.status(400).json({ message: 'User ID is required' });
        }

        const student = await Student.findOne({ _id }).select('name admissionNumber email');
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// Route to get prescription details of a particular student
router.post('/viewprescription', async (req, res) => {
    try {
        const { userId } = req.body;
        const prescriptions = await Prescription.find({ userId })
        // .populate('userId');
        res.json(prescriptions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});



// router.post('/studentsviewuser', async (req, res) => {
//     try {
//         const userId = req.body.userId;
//         const student = await StudentRequest.findOne({ userId });

//         if (!student) {
//             return res.status(404).json({ message: 'Student not found' });
//         }

//         // Check if the status is "Approved"
//         if (student.status !== 'Approved') {
//             return res.status(403).json({ message: 'Access denied. Student request is not approved.' });
//         }

//         // Convert time slot to Indian Time
//         const startTime = moment(student.timeSlot.startTime).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
//         const endTime = moment(student.timeSlot.endTime).tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

//         res.json({
//             token: student.token,
//             disease: student.disease,
//             timeSlot: {
//                 startTime: startTime,
//                 endTime: endTime
//             }
//         });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Server Error' });
//     }
// });



module.exports = router;
