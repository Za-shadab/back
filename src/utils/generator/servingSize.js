const roundToFraction = require('./rounding')


function calculateServingSize(desiredServingSize) {
    const whole = Math.floor(desiredServingSize);
    const decimal = desiredServingSize - whole;
    let fraction = roundToFraction(decimal);
    
    return whole === 0 ? fraction.text : whole + fraction.text;
}

module.exports = calculateServingSize