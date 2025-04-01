const calculateTDEE = (bmr, activityLevel) => {
    const activityMultipliers = {
        "Not Very Active": 1.2,
        "Lightly Active": 1.375,
        "Active": 1.55,
        "Very Active": 1.725,
    };

    return Math.round(bmr * (activityMultipliers[activityLevel] || 1.2));
};

module.exports = calculateTDEE