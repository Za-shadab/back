import express from "express";
import { upload } from "../middlewares/multer.middleware";
import { uploadOnCloudinary } from "../utils/cloudinary";

const app = express();

app.post("/upload", upload.single("file"), async (req, res) => {
    const localFilePath = req.file.path;

    const cloudinaryResponse = await uploadOnCloudinary(localFilePath);

    if (cloudinaryResponse) {
        res.status(200).send({ url: cloudinaryResponse.url });
    } else {
        res.status(500).send({ error: "Failed to upload file" });
    }
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
