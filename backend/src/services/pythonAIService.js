const axios = require("axios");

const analyzeSatellite = async (lat, lng) => {

    const response = await axios.post(
        "http://localhost:8000/analyze",
        {
            lat,
            lng
        }
    );

    return response.data;
};

module.exports = {
    analyzeSatellite
};