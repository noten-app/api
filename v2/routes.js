// Routes.js for /v2

const express = require('express');
const router = express.Router();

const config = require(__dirname + '/../config.json');

// Beta Check
if (config.beta.versions.includes("v2")) router.use((req, res, next) => {
    // Check auth
    if (!req.headers.beta) return res.status(401).json({ error: 'in_beta', error_description: 'This version of the API is currently in BETA' });
    if (!req.headers.beta.startsWith('Beta ')) return res.status(401).json({ error: 'invalid_beta_token', error_description: 'Invalid BETA Token' });
    let token = req.headers.authorization.replace('Beta ', '');
    if (token != config.beta.beta_token) return res.status(401).json({ error: 'invalid_beta_token', error_description: 'Invalid BETA token' });
    next();
});

// AUTH
router.use('/auth', require('./auth.js'));

// CLASSES
router.use('/classes', require('./classes.js'));

// GRADES
router.use('/grades', require('./grades.js'));

// HOMEWORK
router.use('/homework', require('./homework.js'));

module.exports = router