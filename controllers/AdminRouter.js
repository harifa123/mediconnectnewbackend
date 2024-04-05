const express = require("express")
const adminModel = require("../models/AdminModel")
const studentModel = require("../models/student")

const bcrypt = require("bcryptjs")
const router = express.Router()
const jwt=require("jsonwebtoken")

const hashPasswordGenerator = async (pass) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(pass, salt)
}

router.post('/addadmin', async (req, res) => {
    try {
        let { data } = { "data": req.body }
        let password = data.password
        const hashedpassword = await hashPasswordGenerator(password)
        data.password = hashedpassword
        let adm = new adminModel(data)
        await adm.save()
        res.json({ status: "success" })
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

router.post("/adminlogin", async(req,res)=>{
    try {
        const { email, password } = req.body;
        const admin = await adminModel.findOne({ email: email });
        if (!admin) {
            return res.json({ status: "Incorrect mailid" });
        }
        const match = await bcrypt.compare(password, admin.password);
        if (!match) {
            return res.json({ status: "Incorrect password" });
        }
        jwt.sign({ email: email }, "docappadmin", { expiresIn: "1d" }, (error, admintoken) => {
            if (error) {
                return res.json({ "status": "error", "error": error });
            } else {
                return res.json({ status: "success", "admindata": admin, "admintoken": admintoken });
            }
        });
    } catch (error) {
        return res.status(500).json({ "status": "error", "message": "Failed to login admin" });
    }
});


router.post('/addStudent', async (req, res) => {
    const { name,email, admissionNumber } = req.body;

    try {
        // Check if student already exists
        const existingStudent = await studentModel.findOne({ name,email, admissionNumber });

        if (existingStudent) {
            return res.status(400).json({ message: 'Student already registered' });
        }

        // Create the student
        await studentModel.create({ email, admissionNumber });

        res.status(200).json({ message: 'Student added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



    
module.exports = router

