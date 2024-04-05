const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")

const studentRouter = require("./controllers/studentRouter")
const adminRouter = require("./controllers/AdminRouter")

const app = express()

app.use(express.json())
app.use(cors())

// // Allow requests from localhost:3000
// app.use(cors({
//     origin: 'http://localhost:3000',
//   }));


mongoose.connect("mongodb+srv://harifa123:harifa123@cluster0.j6vqcp5.mongodb.net/docappdemoDb?retryWrites=true&w=majority",
{
   useNewUrlParser:true
})


app.use("/api/student", studentRouter)

app.use("/api/admin", adminRouter)

app.listen(3006, () => {
    console.log("Server Running")
})