const axios = require("axios");
const { analyzeDisaster } = require("../services/geminiService");

exports.analyze = async (req, res) => {

    try {

        const { lat, lng } = req.body;

        const python = await axios.post(
            "http://127.0.0.1:8000/analyze",
            {
                lat,
                lng
            }
        );

        const data = python.data;

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