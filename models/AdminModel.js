const mongoose=require("mongoose")
const adminschema=new mongoose.Schema(
    {
        
        
            email:String,
            password:String,
         
    }
)
module.exports=mongoose.model("adminlogin",adminschema)