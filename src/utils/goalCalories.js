const calculateGoalCalories = (tdee, goals, weightChangeRate, goalWeight) => {
    if (!Array.isArray(goals) || goals.length === 0) return tdee;

    // Convert to number
    weightChangeRate = Number(weightChangeRate) || 0;

    if (!goalWeight && goals.includes("Weight Gain") && weightChangeRate === 0) {
        weightChangeRate = 0.5; // Default to 0.5 kg/week
    }

    const calorieChangePerKg = 7700;
    const dailyCaloricChange = (weightChangeRate * calorieChangePerKg) / 7;

    if (goals.includes("Lose Weight")) return Math.round(tdee - dailyCaloricChange);
    if (goals.includes("Weight Gain")) return Math.round(tdee + dailyCaloricChange);

    return tdee; 
};

module.exports = calculateGoalCalories