
const express = require("express")
const bcrypt = require("bcryptjs")
const router = express.Router()
const mongoose = require('mongoose');
const Student = require('../models/student');
const nodemailer = require('nodemailer');
const StudentRequest = require('../models/requestModel');
const Counter = require('../models/counterModel');
const Prescription = require('../models/prescriptionModel');
const PDFDocument = require('pdfkit');
const path = require('path');
const { ObjectId } = require('mongoose').Types;
require("dotenv").config();
const cron = require('node-cron');
const moment = require('moment-timezone');
// const TimeSlot = require('../models/Timemodel');
const DoctorLeave = require('../models/doctorLeave');
const Booking = require('../models/bookingModel');




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


router.post('/download', async (req, res) => {
    try {
        const { date } = req.body;
        console.log('Date parameter received:', date); 
      let requests;
      if (date) {
        const parsedDate = new Date(date);
        if (!isValidDate(parsedDate)) {
          return res.status(400).json({ message: 'Invalid date format' });
        }
        const startOfDay = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0);
        const endOfDay = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 23, 59, 59, 999);
        requests = await StudentRequest.find({ createdAt: { $gte: startOfDay, $lte: endOfDay } });
        if (requests.length === 0) {
          return res.status(404).json({ message: 'No student requests found for the specified date' });
        }
      } else {
        requests = await StudentRequest.find();
      }
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="student_requests.pdf"');
      doc.pipe(res);
      const borderWidth = 10; // Define the border width
const imagePath = path.join(__dirname, '../assets', 'images.png'); // Replace 'fisats.jpg' with the actual filename

try {
  doc.image(imagePath, borderWidth + 10, borderWidth + 10, { width: 100 },{align:'center'}.moveDown);
} catch (error) {
  console.error('Error loading image:', error);
  doc.text('Image not found', borderWidth + 10, borderWidth + 10); // Display a placeholder text if image loading fails
}
doc.fontSize(20).text('\nFEDERAL INSTITUTE OF SCIENCE AND TECHNOLOGY',borderWidth + 120, borderWidth + 10,{align:'center'}.moveDown);

      doc.fontSize(16).text('\n\nSTUDENT REQUESTS\n\n', { align: 'center' }).moveDown();
      requests.forEach((request, index) => {
        const requestText = `${index + 1}. Name: ${request.name}\n AdmNo/EmpId: ${request.admissionNumber}\n Disease: ${request.disease}\n Status: ${request.status}\n Token: ${request.token}`;
        doc.text(requestText);
        doc.moveDown();
      });
      doc.end();
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });
  function isValidDate(date) {
    return date instanceof Date && !isNaN(date);
  }
  


  let timeSlotQueue = [];

  function initializeTimeSlotQueue() {
      return new Promise((resolve, reject) => {
          console.log("Initializing time slot queue...");
          const today = moment().tz('Asia/Kolkata'); // Get the current date in IST
          const futureDates = [];
          const endDateTime = moment(today).add(6, 'months'); // Adjust this as needed
          let currentDate = moment(today).startOf('day');
  
          // Generate future consultation dates (Tuesdays and Thursdays) within the specified period
          while (currentDate.isSameOrBefore(endDateTime)) {
              if (currentDate.day() === 2 || currentDate.day() === 4) { // Tuesday or Thursday
                  futureDates.push(currentDate.clone());
              }
              currentDate.add(1, 'day');
          }
  
          // Generate time slots for each future consultation day
          futureDates.forEach(consultationDay => {
              const consultationStartTime = moment(consultationDay).hours(14).minutes(0).seconds(0).milliseconds(0);
              const consultationEndTime = moment(consultationDay).hours(17).minutes(0).seconds(0).milliseconds(0);
              let timeSlotTime = moment(consultationStartTime);
  
              // Generate time slots with a duration of 15 minutes
              while (timeSlotTime.isBefore(consultationEndTime)) {
                  timeSlotQueue.push({ startTime: timeSlotTime.clone(), endTime: timeSlotTime.clone().add(15, 'minutes'), available: true });
                  timeSlotTime.add(15, 'minutes');
              }
          });
  
          // Log the generated time slots
          timeSlotQueue.forEach((slot, index) => {
              console.log(`Slot ${index + 1}: ${slot.startTime.format('YYYY-MM-DD HH:mm:ss')} - ${slot.endTime.format('YYYY-MM-DD HH:mm:ss')}`);
          });
  
          console.log("Time slot queue initialized with", timeSlotQueue.length, "time slots.");
          console.log("Last time slot generated:", timeSlotQueue.length > 0 ? timeSlotQueue[timeSlotQueue.length - 1] : "None");
  
          resolve();
      });
  }
  
  
  
  let doctorLeaveDates = [];
  
  function markDoctorLeave(date) {
      if (!doctorLeaveDates.includes(date)) {
          doctorLeaveDates.push(date);
          timeSlotQueue.forEach(slot => {
              const slotDate = slot.startTime.format('YYYY-MM-DD');
              if (slotDate === date) {
                  slot.available = false;
              }
          });
          console.log(`Doctor is on leave on ${date}. Time slots marked as unavailable.`);
          return true;
      } else {
          console.log(`Doctor is already on leave on ${date}.`);
          return false;
      }
  }
  
  
  initializeTimeSlotQueue();
  
  async function isTimeSlotAvailable(date, timeSlot) {
      try {
          const selectedDate = moment(date).startOf('day');
          const selectedTimeSlotStart = moment(`${date} ${timeSlot}`, 'YYYY-MM-DD HH:mm');
          const existingRequest = await StudentRequest.findOne({
              date: selectedDate,
              'timeSlot.startTime': selectedTimeSlotStart.toDate()
          });
          return !existingRequest;
      } catch (error) {
          console.error("Error checking time slot availability:", error);
          throw error;
      }
  }
  
  
  async function assignTimeSlotToUser(userId, date, timeSlot) {
      console.log("Assigning time slot to user:", userId);
      try {
          const updatedRequest = await StudentRequest.findOneAndUpdate(
              { userId, status: 'Approve', date },
              { $set: { timeSlot } }, // Update with the provided time slot string
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
// router.post('/student-request', async (req, res) => {
//     try {
//         const { userId, name, admissionNumber, disease } = req.body;
//         if (!userId) {
//             return res.status(400).send("Error: userId is required");
//         }
//         const maxSequenceNumberRequest = await StudentRequest.findOne().sort('-sequenceNumber');
//         const sequenceNumber = maxSequenceNumberRequest ? maxSequenceNumberRequest.sequenceNumber + 1 : 1;
//         const newRequest = new StudentRequest({
//             userId,
//             name,
//             admissionNumber,
//             disease,
//             status: 'Approve',
//             timeSlot: null,
//             sequenceNumber
//         });
//         await newRequest.save();
//         res.status(201).send("Request submitted successfully, Please check for the Email for the confirmation");
//     } catch (err) {
//         console.error("Error processing student form request:", err);
//         res.status(500).send("Internal Server Error");
//     }
// });


router.post('/student-request', async (req, res) => {
    try {
        const { userId, name, admissionNumber, disease, date, timeSlot } = req.body;
        if (!userId || !name || !admissionNumber || !disease || !date || !timeSlot) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        console.log("received time slot : ",timeSlot);
        const [startTime, endTime] = timeSlot.split(' - ').map(time => time.trim());
        console.log("[startTime, endTime] : ",[startTime, endTime]);
        const timeSlotStartTime = moment(`${date} ${startTime}`, 'YYYY-MM-DD HH:mm');
        console.log("timeSlotStartTime : ",timeSlotStartTime);
        const timeSlotEndTime = moment(`${date} ${endTime}`, 'YYYY-MM-DD HH:mm');
        console.log("timeSlotEndTime : ",timeSlotEndTime);
        const formattedTimeSlot = `${timeSlotStartTime.format('hh:mm A')} - ${timeSlotEndTime.format('hh:mm A')}`;
        console.log("formattedTimeSlot : ",formattedTimeSlot);
        const maxSequenceNumberRequest = await StudentRequest.findOne().sort('-sequenceNumber');
        const sequenceNumber = maxSequenceNumberRequest ? maxSequenceNumberRequest.sequenceNumber + 1 : 1;
        const newRequest = new StudentRequest({
            userId,
            name,
            admissionNumber,
            disease,
            date: date, // Parse date as UTC
            timeSlot: formattedTimeSlot,
            status: 'Approve',
            sequenceNumber
        });
        await newRequest.save();
        res.status(201).json({ message: 'Booking request submitted successfully.' });
    } catch (err) {
        console.error("Error processing booking request:", err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Schedule the task to run every 5 minutes, 24/7

cron.schedule('*/2 * * * *', async () => {
    try {
        const pendingRequests = await StudentRequest.find({
            status: 'Approve',
        }).sort({ createdAt: 1 });
        
        for (const request of pendingRequests) {
            await assignTimeSlotToUser(request.userId, request.date, request.timeSlot);
            request.status = 'Approved';

            // Save the token in the StudentRequest document
            request.token = `MC${request.sequenceNumber}`;

            await request.save();

            const student = await Student.findById(request.userId);
            if (student) {
                student.status = request.status;
                student.token = request.token; // Save token in the Student document
                await student.save();
            }

            const timeSlotStartTime = moment(request.timeSlot.startTime).tz('Asia/Kolkata');
            const timeSlotEndTime = moment(request.timeSlot.endTime).tz('Asia/Kolkata');
            const timeSlot = timeSlotStartTime.format('YYYY-MM-DD HH:mm') + ' - ' + timeSlotEndTime.format('HH:mm');
            const date = timeSlotStartTime.format('YYYY-MM-DD');
            const email = student.email;

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.USER,
                    pass: process.env.APP_PASSWORD,
                },
            });

            await transporter.sendMail({
                from: process.env.USER,
                to: email,
                subject: 'Booking Confirmation',
                text: `Your booking has been confirmed for ${request.date}.\nTime Slot (IST): ${request.timeSlot}\nToken: ${request.token}`,
            });

            console.log(`Confirmation email sent to ${email}`);

            const newBooking = new Booking({
                userId: request.userId,
                name: request.name,
                admissionNumber: request.admissionNumber,
                disease: request.disease,
                date: request.date,
                timeSlot: request.timeSlot,
                token: request.token, // Save token in the Booking document
            });

            await newBooking.save();
        }

        console.log('Scheduled task: Approved pending requests and sent confirmation emails successfully.');
    } catch (err) {
        console.error('Scheduled task error:', err);
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




router.post('/apply-for-leave', async (req, res) => {
    try {
        const { date, reason } = req.body;
        const dateInUTC = moment.utc(date).startOf('day').toDate(); // Convert to UTC date
        console.log(dateInUTC);
        const existingStudentRequest = await StudentRequest.findOne({
            date: dateInUTC,
            status: { $in: ['Approve', 'Approved'] }
        });
        const existingBooking = await Booking.findOne({ date: dateInUTC });
        if (existingStudentRequest || existingBooking) {
            return res.status(400).json({ message: 'Cannot apply for leave. Bookings exist for this date.' });
        }
        const newLeave = new DoctorLeave({
            date: dateInUTC,
            reason
        });
        await newLeave.save();
        res.status(200).json({ message: 'Leave applied successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


// Doctor Leave Dates API
router.get('/api/doctor-leave-dates', async (req, res) => {
    try {
        const doctorLeaveDates = await DoctorLeave.find({}, 'date'); // Fetch only the dates
        res.status(200).json(doctorLeaveDates);
    } catch (error) {
        console.error('Error fetching doctor leave dates:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Consultation Days API
router.get('/api/consultation-days', async (req, res) => {
    try {
        const consultationDays = [];
        // Generate consultation days for the next 6 months
        const startDate = moment.utc(); // Start date in UTC
        const endDate = moment.utc().add(14, 'months'); // End date in UTC
        for (let date = startDate.clone(); date.isSameOrBefore(endDate); date.add(1, 'day')) {
            if (date.day() === 2 || date.day() === 4) { // Tuesday or Thursday
                const isLeaveDate = await DoctorLeave.exists({ date: { $eq: moment(date).startOf('day').toDate() } });
                console.log(isLeaveDate);
                const isFullyBooked = await isDayFullyBooked(date);
                if (!isLeaveDate && !isFullyBooked) {
                    consultationDays.push(date.format('YYYY-MM-DD'));
                }
            }
        }
        res.status(200).json(consultationDays);
    } catch (error) {
        console.error('Error fetching consultation days:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

async function isDayFullyBooked(date) {
    try {
        const startTime = moment.utc(date).set('hour', 14).set('minute', 0); // Set start time in UTC
        const endTime = moment.utc(date).set('hour', 17).set('minute', 0); // Set end time in UTC
        const bookingsCount = await StudentRequest.countDocuments({
            date: moment(date).startOf('day').toDate(), // Convert to UTC
            'timeSlot.startTime': { $gte: startTime.toDate() },
            'timeSlot.endTime': { $lte: endTime.toDate() }
        });
        return bookingsCount >= 12; // Assuming there are 12 time slots per day
    } catch (error) {
        console.error('Error checking if day is fully booked:', error);
        throw error;
    }
}

// Available Time Slots API
router.post('/api/available-time-slots', async (req, res) => {
    try {
        const { date } = req.body;
        console.log("received date : ", date);
        if (!date) {
            return res.status(400).json({ message: 'Date parameter is required' });
        }
        //const selectedDate = moment.utc(date).tz('Asia/Kolkata').startOf('day');
        const availableTimeSlots = await getAvailableTimeSlots(date);
        res.status(200).json(availableTimeSlots);
    } catch (error) {
        console.error('Error fetching available time slots:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

async function getAvailableTimeSlots(date) {
    try {
        const startTime = moment(date).set('hour', 14).set('minute', 0);
        const endTime = moment(date).set('hour', 17).set('minute', 0);
        const timeSlots = [];
        let currentTime = startTime.clone();
        while (currentTime.isBefore(endTime)) {
            timeSlots.push({
                startTime: currentTime.format('hh:mm A'),
                endTime: currentTime.add(15, 'minutes').format('hh:mm A'),
            });
        }
        const bookedTimeSlots = await StudentRequest.distinct('timeSlot', { date });
        console.log('Booked time slots:', bookedTimeSlots);
        const availableTimeSlots = timeSlots.filter(slot => {
            // Check if the slot is not booked
            return !bookedTimeSlots.includes(slot.startTime + ' - ' + slot.endTime);
        });
        return availableTimeSlots;
    } catch (error) {
        console.error('Error fetching available time slots:', error);
        throw error;
    }
}



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


router.get('/filter', async (req, res) => {
    try {
      const { disease } = req.query;
  
      // Check if disease parameter is provided
      if (!disease) {
        return res.status(400).json({ message: 'Disease parameter is required' });
      }
  
      // Filter student requests by disease
      const studentRequests = await StudentRequest.find({ disease });
  
      res.json(studentRequests);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });


module.exports = router;
