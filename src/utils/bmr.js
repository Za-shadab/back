const calculateBMR = (weight, height, age, gender) => {
    if (gender === 'male') {
        return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
    } else {
        return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
    }
};

module.exports = calculateBMR