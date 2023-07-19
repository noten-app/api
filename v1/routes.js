// Routes.js for /v1

const express = require('express');
const router = express.Router();

// AUTH
router.use('/auth', require('./auth.js'));

// CLASSES
router.use('/classes', require('./classes.js'));

// GRADES
router.use('/grades', require('./grades.js'));

// HOMEWORK
router.use('/homework', require('./homework.js'));

// Wildcard route for /v1
router.get('*', (req, res) => res.status(404).send('Warning: Route /v1' + req.url + ' does not exist'));

module.exports = router