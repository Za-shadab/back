const express = require('express');
const multer = require('multer')
const {uploadOnCloudinary} = require('../utils/cloudinary')
const router = express.Router();

const app = express();
const upload = multer({dest:'../../public/temp'})

router.post('/profileUpload', upload.single('file'), async (req, res)=>{
    try {
        const localFilePath = req.file.path;
        console.log(localFilePath);
        const cloudinaryResponse = await uploadOnCloudinary(localFilePath);
    
        if (!cloudinaryResponse) {
          return res.status(500).json({ message: 'Failed to upload to Cloudinary.' });
        }
    
        res.json({ url: cloudinaryResponse.url }); // Send the URL back to the client
      } catch (error) {
        console.error('Upload failed:', error);
        res.status(500).json({ message: 'Server error.' });
      }
});

router.get('/', async(req, res)=>{
    res.send("profile")
})

module.exports = router;