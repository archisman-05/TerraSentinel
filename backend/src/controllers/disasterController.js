const { analyzeSatellite } = require("../services/pythonAIService");
const { analyzeDisaster } = require("../services/geminiService");

exports.analyze = async (req, res) => {
    try {
        const { lat, lng } = req.body;

        const data = await analyzeSatellite(lat, lng);

        const ai = await analyzeDisaster(data);

        return res.json({
            success: true,
            data,
            ai
        });

    } catch (err) {
        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
