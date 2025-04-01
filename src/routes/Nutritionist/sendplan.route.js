const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const axios = require('axios');
const Nutritionist = require('../../models/Nutritionist.model');
const CLUser = require('../../models/user');
const ClientUser = require('../../models/clientUser.model');
const MealPlan = require('../../models/dietPlan.model');
const router = express.Router();

// Helper function to fetch image data
const fetchImageBuffer = async (imageUrl) => {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch image from ${imageUrl}:`, error);
    return null;
  }
};

// Create PDF function
const createMealPlanPDF = async (mealPlan, nutritionist, client) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Create PDF with better page settings
      const doc = new PDFDocument({
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        size: 'A4'
      });
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Add header with styling
      doc.font('Helvetica-Bold')
         .fontSize(24)
         .fillColor('#2E5090')
         .text('Your Meal Plan', { align: 'center' });
      
      // Add logo or header image if available
      if (nutritionist.logoUrl) {
        doc.image(nutritionist.logoUrl, 50, 50, { width: 100 });
      }

      doc.moveDown();
      
      // Add info section with styling
      doc.font('Helvetica')
         .fontSize(12)
         .fillColor('#333333');

      // Create info box
      doc.rect(50, doc.y, 495, 100)
         .fillAndStroke('#F5F5F5', '#CCCCCC');
      
      doc.moveDown()
         .text(`Created by: ${nutritionist.name}`, { indent: 20 })
         .text(`Created for: ${client.name}`, { indent: 20 })
         .text(`Duration: ${new Date(mealPlan.startDate).toLocaleDateString()} - ${new Date(mealPlan.endDate).toLocaleDateString()}`, 
               { indent: 20 });

      doc.moveDown(2);

      // Add meals with enhanced styling
      for (const meal of mealPlan.meals) {
        // Check if there's enough space on the current page
        if (doc.y > doc.page.height - 300) { // 300 is approximate space needed for a meal
          doc.addPage();
        }
      
        // Meal type header
        doc.font('Helvetica-Bold')
           .fontSize(16)
           .fillColor('#2E5090')
           .text(meal.mealType.toUpperCase(), { underline: true });
      
        doc.moveDown(0.5);
      
        // Create a row for recipe image and details
        const yStart = doc.y;
        
        // Add recipe image if available
        if (meal.recipe.image) {
          try {
            const imageBuffer = await fetchImageBuffer(meal.recipe.image);
            if (imageBuffer) {
              doc.image(imageBuffer, 50, doc.y, {
                width: 150,
                height: 150,
                fit: [150, 150]
              });
            }
          } catch (error) {
            console.error('Error adding image to PDF:', error);
          }
        }
      
        // Recipe details (positioned next to image)
        doc.font('Helvetica')
           .fontSize(12)
           .fillColor('#333333')
           .text(meal.recipe.label, 220, yStart, { bold: true })
           .moveDown(0.5)
           .text(`Calories: ${meal.recipe.calories} kcal`, { indent: 20 })
           .text(`Serving Size: ${meal.recipe.serving}`, { indent: 20 });
      
        // Move cursor below the image
        doc.y = Math.max(doc.y, yStart + 160);
        doc.moveDown();
      
        // Ingredients section with styling
        doc.font('Helvetica-Bold')
           .text('Ingredients:', { underline: true });
        
        doc.font('Helvetica')
           .fontSize(10);
        
        meal.recipe.ingredientsLines.forEach(ingredient => {
          // Check if there's enough space for the ingredient
          if (doc.y > doc.page.height - 50) {
            doc.addPage();
          }
          doc.text(`• ${ingredient}`, { indent: 20 });
        });
      
        // Add nutritional information if available
        if (meal.recipe.nutrients) {
          // Check if there's enough space for nutritional info
          if (doc.y > doc.page.height - 100) {
            doc.addPage();
          }
      
          doc.moveDown()
             .font('Helvetica-Bold')
             .fontSize(12)
             .text('Nutritional Information:', { underline: true });
      
          doc.font('Helvetica')
             .fontSize(10);
      
          const nutrients = meal.recipe.nutrients;
          const columns = [
            ['Protein', `${nutrients.protein}g`],
            ['Carbs', `${nutrients.carbs}g`],
            ['Fats', `${nutrients.fats}g`]
          ];
      
          let xPos = 70;
          columns.forEach(([label, value]) => {
            doc.text(`${label}: ${value}`, xPos, doc.y);
            xPos += 150;
          });
        }
      
        doc.moveDown(2);
      }

      // Add footer
      doc.fontSize(8)
         .fillColor('#666666')
         .text('This meal plan is personalized based on your nutritional needs.', 
               50, doc.page.height - 50, 
               { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

router.post('/send-plan', async (req, res) => {
  try {
    const { NutritionistId, ClientId, plan } = req.body;

    // Validate required fields
    if (!NutritionistId || !ClientId || !plan) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }


    // Fetch nutritionist and client details for PDF
    const nutritionist = await Nutritionist.findOne({ _id: NutritionistId });
    const client = await ClientUser.findOne({ _id: ClientId }); // Fixed query
    
    if (!nutritionist || !client) {
      throw new Error('Nutritionist or client details not found');
    }

    // Fetch client details from both models
    const clientUser = await CLUser.findById(client.UserId);
    console.log("Client user found:", clientUser);

    // Generate PDF
    const pdfBuffer = await createMealPlanPDF(plan, nutritionist, {
      ...client.toObject(),
      email: clientUser.email
    });

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: clientUser.email,
      subject: 'Your New Meal Plan',
      text: 'Please find your meal plan attached.',
      attachments: [{
        filename: 'meal-plan.pdf',
        content: pdfBuffer
      }]
    });

    res.status(200).json({
      success: true,
      message: "Meal plan sent successfully to client's email"
    });

  } catch (error) {
    console.error("Error sending meal plan:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to send meal plan"
    });
  }
});

module.exports = router;