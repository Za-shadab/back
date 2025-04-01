const getRandomInRange = (min, max) => (Math.random() * (max - min) + min);

const getMacroDistribution = (tdee, goal, conditions = []) => {
    const macroRanges = {
        "Lose Weight": { protein: [0.35, 0.45], carbs: [0.30, 0.40], fats: [0.20, 0.30] },
        "Maintain Weight": { protein: [0.25, 0.35], carbs: [0.40, 0.50], fats: [0.20, 0.30] },
        "Gain Weight": { protein: [0.20, 0.30], carbs: [0.50, 0.60], fats: [0.20, 0.30] },
        "Gain Muscle": { protein: [0.35, 0.45], carbs: [0.35, 0.45], fats: [0.15, 0.25] },
        "Modify My Diet": { protein: [0.25, 0.35], carbs: [0.35, 0.45], fats: [0.25, 0.35] }
    };

    const conditionSpecificMacros = {
        "Diabetes": { protein: [0.30, 0.40], carbs: [0.30, 0.40], fats: [0.25, 0.30] },
        "PCOS": { protein: [0.30, 0.40], carbs: [0.20, 0.30], fats: [0.30, 0.40] },
        "PCOD": { protein: [0.30, 0.40], carbs: [0.20, 0.30], fats: [0.30, 0.40] },
        "Thyroid": { protein: [0.25, 0.35], carbs: [0.40, 0.50], fats: [0.20, 0.30] },
        "Hypertension": { protein: [0.25, 0.35], carbs: [0.40, 0.50], fats: [0.20, 0.30] }
    };

    if (!macroRanges[goal]) {
        console.warn(`Invalid goal: "${goal}". Defaulting to "Maintain Weight".`);
        goal = "Maintain Weight";
    }

    let ranges = { ...macroRanges[goal] };

    if (conditions.length > 0) {
        let minProtein = 0, maxProtein = 0, minCarbs = 0, maxCarbs = 0, minFats = 0, maxFats = 0;
        let count = 0;

        conditions.forEach(condition => {
            if (conditionSpecificMacros[condition]) {
                const { protein, carbs, fats } = conditionSpecificMacros[condition];

                minProtein += protein[0];
                maxProtein += protein[1];
                minCarbs += carbs[0];
                maxCarbs += carbs[1];
                minFats += fats[0];
                maxFats += fats[1];
                count++;
            }
        });

        if (count > 0) {
            ranges.protein = [(minProtein / count), (maxProtein / count)];
            ranges.carbs = [(minCarbs / count), (maxCarbs / count)];
            ranges.fats = [(minFats / count), (maxFats / count)];
        }
    }

    // Select a random percentage within the updated range
    let proteinPercentage = getRandomInRange(ranges.protein[0] * 100, ranges.protein[1] * 100);
    let carbsPercentage = getRandomInRange(ranges.carbs[0] * 100, ranges.carbs[1] * 100);
    let fatsPercentage = getRandomInRange(ranges.fats[0] * 100, ranges.fats[1] * 100);

    // Normalize percentages to ensure they sum to 100%
    const total = proteinPercentage + carbsPercentage + fatsPercentage;
    proteinPercentage = (proteinPercentage / total) * 100;
    carbsPercentage = (carbsPercentage / total) * 100;
    fatsPercentage = (fatsPercentage / total) * 100;

    // Convert percentages into grams
    const protein = Math.round((tdee * (proteinPercentage / 100)) / 4);
    const carbs = Math.round((tdee * (carbsPercentage / 100)) / 4);
    const fats = Math.round((tdee * (fatsPercentage / 100)) / 9);

    return { protein, carbs, fats };
};

module.exports = getMacroDistribution;
