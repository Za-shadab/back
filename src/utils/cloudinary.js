const { v2: cloudinary } = require("cloudinary");
const fs = require("fs");
const { env } = require("process");

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async(localFilePath)=>{
try {
        if(!localFilePath) return null;
    
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type:'auto'
        })
        console.log("This File is uploaded on cloudinary: ", response.url);
        return response;
    }
 catch (error) {
    fs.unlinkSync(localFilePath) // removes the locallay saved file as the upload operation get failed
    return null;
}
}
module.exports = { uploadOnCloudinary };    