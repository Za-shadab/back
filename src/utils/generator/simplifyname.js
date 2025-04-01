require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_THREE);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

async function Simplifyname(recipeName) {
    try {
        const prompt = `Return a simplified or common name for this recipe: "${recipeName}". If it's already common, return it as is.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("Error simplifying recipe name:", error);
        return recipeName; // Fallback to the original name
    }
}

module.exports = Simplifyname;
