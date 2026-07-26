const express = require("express");

const router = express.Router();

const {
    analyze
} = require("../controllers/disasterController");

router.post(
    "/analyze",
    analyze
);

module.exports = router;