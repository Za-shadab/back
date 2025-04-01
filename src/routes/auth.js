const express = require('express');
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const { isObjectIdOrHexString } = require('mongoose');
const nodemailer = require('nodemailer');
const { validate } = require('email-validator');
const dns = require('dns');
const { promisify } = require('util');
require('dotenv').config();
const router = express.Router();
const RegularUser = require('../models/regularUser.model');
const Nutritionist = require('../models/Nutritionist.model');
const ClientUser = require('../models/clientUser.model');

// Promisify the dns.resolveMx function
const resolveMx = promisify(dns.resolveMx);

/**
 * Check if an email address potentially exists by validating the format
 * and checking if the domain has MX records
 * 
 * @param {string} email - The email address to validate
 * @returns {Promise<boolean>} - True if email potentially exists
 */
async function validateEmail(email) {
  // First check email format
  if (!validate(email)) {
    console.log(`Invalid email format: ${email}`);
    return false;
  }

  // Then check if domain has MX records
  try {
    const domain = email.split('@')[1];
    const mxRecords = await resolveMx(domain);
    
    if (mxRecords && mxRecords.length > 0) {
      console.log(`Valid MX records found for domain: ${domain}`);
      return true;
    } else {
      console.log(`No MX records found for domain: ${domain}`);
      return false;
    }
  } catch (error) {
    console.error(`Error checking MX records: ${error.message}`);
    return false;
  }
}

/**
 * Send an email with credentials to a new client user
 * 
 * @param {string} email - Recipient email address
 * @param {string} password - Password to include in the email
 * @param {string} name - Name of the recipient
 * @returns {Promise<boolean>} - True if email was sent successfully
 */
async function sendEmailWithCredentials(email, password, name) {
  // Configure SMTP transporter using environment variables
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log(transporter.auth);
  
  try {
    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"Nutrition App" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Nutrition App Account Credentials',
      text: `Hello ${name},\n\nYour account has been created.\n\nUsername: ${email}\nPassword: ${password}\n\nPlease keep this information secure.\n\nBest regards,\nThe Nutrition App Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e6e6e6; border-radius: 5px;">
          <h2 style="color: #4CAF50;">Welcome to Nutrition App!</h2>
          <p>Hello ${name},</p>
          <p>Your account has been created by your nutritionist. You can now log in with the following credentials:</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Username:</strong> ${email}</p>
            <p><strong>Password:</strong> ${password}</p>
          </div>
          <p style="color: #666;">Please keep this information secure and consider changing your password after your first login.</p>
          <p>Best regards,<br/>The Nutrition App Team</p>
        </div>
      `
    });

    console.log(`Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error sending email: ${error.message}`);
    return false;
  }
}

router.post('/register', async (req, res, next) => {
  console.log(req.body);
  
  const { name, email, password, location, role, createdBy, sendEmail } = req.body;

  if (!name || !email || !password || !location || !role) {
    return res.status(400).json({ msg: 'Please enter all required fields' });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ msg: 'User already exists' });
    }



    //--------
    // Skip verification for client users created by nutritionists
    const skipVerification = role === 'client_user' && createdBy;
        
    // Generate OTP if verification is needed
    const otp = skipVerification ? null : generateOTP(6);
    const otpExpiry = skipVerification ? null : new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    if (!skipVerification) {
      const emailSent = await sendOTPEmail(email, name, otp);
      if (!emailSent) {
        console.log("Failed to send OTP email to:", email);
      }
    }
    //----------

        // Create new user
        const newUser = new User({
          name,
          email,
          password,
          location,
          role,
          createdBy,
          isEmailVerified: role === 'client_user' && createdBy ? true : false, // Set to true if created by a nutritionist
          otp: skipVerification ? null : otp,
          otpExpiry: skipVerification ? null : otpExpiry
        });
        
        const savedUser = await newUser.save();

    // Handle email sending for client users
    if (role === 'client_user' && sendEmail) {
      if(!createdBy) {
        return res.status(400).json({ msg: 'Invalid Nutritionist ID' });
      }
      if (!isObjectIdOrHexString(createdBy)) {
        return res.status(400).json({ 
          msg: 'Invalid Nutritionist ID format' 
        });
      }
    
      // Validate email before sending
      const isValidEmail = await validateEmail(email);
      
      if (isValidEmail) {
        const emailSent = await sendEmailWithCredentials(email, password, name);
        if (emailSent) {
          console.log("Email sent with credentials to:", email);
        } else {
          console.log("Failed to send email to:", email);
        }
      } else {
        console.log("Invalid email address, email not sent:", email);
      }
    } else if (role === 'client_user') {
      console.log("Email not sent");
    }

    res.status(201).json({ 
      msg: 'User registered successfully', 
      user: newUser, 
      userId: savedUser._id,
      requiresVerification: !skipVerification, 
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;
  console.log(email);
  
  try {
    const userExist = await User.findOne({ email });
    
    if (!userExist) {
      return res.status(404).json({ msg: "Kindly register before Login" });
    }
    
    console.log(userExist.role);
    
    const isCorrectPassword = await userExist.isPasswordCorrect(password);
    
    if (isCorrectPassword) {
      const token = jwt.sign(
        { userId: userExist._id, email: userExist.email }, 
        process.env.JWT_SECRET
      );
      
      if (userExist.role === 'nutri_user') {
        const nutritionistUser = await Nutritionist.findOne({ UserId: userExist._id });
        console.log(nutritionistUser);
        return res.status(201).json({
          msg: "Login Successful",
          userId: userExist._id, 
          NutritionistId: nutritionistUser._id,
          name: userExist.name,
          brandprofileUrl: nutritionistUser ? nutritionistUser.brandlogo : null,
          NutritionistId: nutritionistUser ? nutritionistUser._id : null, 
          token
        });
      }

      if(userExist.role === 'client_user') {
        const clientuser = await ClientUser.findOne({ UserId: userExist._id });
        console.log(clientuser);
        return res.status(201).json({
          msg: "Login Successful", 
          userId: userExist._id,
          name: userExist.name,
          profileUrl: clientuser ? clientuser.profileUrl : null,
          ClientId: clientuser ? clientuser._id : null, 
          nutritionistId: clientuser ? clientuser.NutritionistId : null,
          token
        });
      }
      
      const regularUser = await RegularUser.findOne({ UserId: userExist._id });
      
      return res.status(201).json({
        msg: "Login Successful", 
        userId: userExist._id,
        name: userExist.name,
        profileUrl: regularUser ? regularUser.profileUrl : null,
        regularId: regularUser ? regularUser._id : null, 
        token
      });
    } else {
      return res.status(401).json({ msg: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ msg: "Server error during login", error: error.message });
  }
});

router.post('/get-client', async (req, res) => {
  try {
    const { NutritionistId } = req.body;

    if (!NutritionistId) {
      return res.status(400).json({ msg: "Nutritionist ID is required" });
    }

    const clientList = await User.find({ createdBy: NutritionistId });

    if (clientList) {
      return res.json({
        msg: "Clients Fetched Successfully", 
        clientUsers: clientList
      });
    }
  } catch (error) {
    return res.status(500).json({ msg: "Server Error", error: error.message });
  }
});


/**
 * Generate a random numeric OTP of specified length
 * 
 * @param {number} length - Length of the OTP
 * @returns {string} - Generated OTP
 */
function generateOTP(length = 6) {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10);
  }
  return otp;
}

/**
 * Send an email with OTP to the user
 * 
 * @param {string} email - Recipient email address
 * @param {string} name - Name of the recipient
 * @param {string} otp - Verification OTP
 * @returns {Promise<boolean>} - True if email was sent successfully
 */
async function sendOTPEmail(email, name, otp) {
  // Configure SMTP transporter using environment variables
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  try {
    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"Nutrition App" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Verify Your Nutrition App Email',
      text: `Hello ${name},\n\nYour verification code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nBest regards,\nThe Nutrition App Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e6e6e6; border-radius: 5px;">
          <h2 style="color: #4CAF50;">Verify Your Email Address</h2>
          <p>Hello ${name},</p>
          <p>Thank you for registering with Nutrition App. Please use the following code to verify your email address:</p>
          <div style="text-align: center; margin: 25px 0;">
            <div style="font-size: 24px; letter-spacing: 5px; font-weight: bold; background-color: #f8f9fa; padding: 15px; border-radius: 4px; display: inline-block;">
              ${otp}
            </div>
          </div>
          <p style="color: #666;">This code will expire in 15 minutes.</p>
          <p>If you did not create an account, please ignore this email.</p>
          <p>Best regards,<br/>The Nutrition App Team</p>
        </div>
      `
    });

    console.log(`OTP email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error sending OTP email: ${error.message}`);
    return false;
  }
}

// Route to verify email using OTP
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  
  if (!email || !otp) {
    return res.status(400).json({ msg: 'Email and OTP are required' });
  }
  
  try {
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    if (user.isEmailVerified) {
      return res.status(200).json({ msg: 'Email already verified', isEmailVerified: true });
    }
    
    // Check if OTP matches and is not expired
    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }
    
    if (user.otpExpiry && new Date() > new Date(user.otpExpiry)) {
      return res.status(400).json({ msg: 'OTP has expired' });
    }
    
    // Mark email as verified and clear OTP fields
    user.isEmailVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    
    return res.status(200).json({ 
      msg: 'Email verified successfully',
      isEmailVerified: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).json({ 
      msg: "Server error during verification", 
      error: error.message 
    });
  }
});

// Route to resend OTP
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ msg: 'Email is required' });
  }
  
  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    if (user.isEmailVerified) {
      return res.status(200).json({ msg: 'Email already verified', isEmailVerified: true });
    }
    
    // Generate new OTP
    const otp = generateOTP(6);
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    // Update user with new OTP
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();
    
    // Send new OTP email
    const emailSent = await sendOTPEmail(user.email, user.name, otp);
    
    if (emailSent) {
      return res.status(200).json({ msg: 'New OTP sent successfully' });
    } else {
      return res.status(500).json({ msg: 'Failed to send OTP email' });
    }
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ 
      msg: "Server error while resending OTP", 
      error: error.message 
    });
  }
});


module.exports = router;