const { analyzeSatellite } = require("../services/pythonAIService");

const analyze = async (req, res) => {

    try {

        const { lat, lng } = req.body;

        const result = await analyzeSatellite(
            lat,
            lng
        );

        res.json(result);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message:"Analysis Failed"
        });

    }

};

module.exports = {
    analyze
};