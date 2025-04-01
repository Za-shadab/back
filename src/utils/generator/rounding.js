function roundToFraction(decimal) {
    const fractions = [
        { value: 0, text: "" },
        { value: 0.25, text: "¼" },
        { value: 0.33, text: "⅓" },
        { value: 0.5, text: "½" },
        { value: 0.67, text: "⅔" },
        { value: 0.75, text: "¾" }
    ];

    let closest = fractions.reduce((prev, curr) =>
        Math.abs(curr.value - decimal) < Math.abs(prev.value - decimal) ? curr : prev
    );

    if (decimal >= 0.95) {
        closest = { value: 1, text: "1" };
    }

    return closest;
}

module.exports = roundToFraction