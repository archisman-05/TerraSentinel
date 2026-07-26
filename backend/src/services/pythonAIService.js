const axios = require("axios");

const analyzeSatellite = async (lat, lng) => {

    const response = await axios.post(
        `${process.env.AI_SERVICE_URL}/analyze`,
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
