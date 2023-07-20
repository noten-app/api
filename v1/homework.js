// / = /v1/homework

// Require needed modules
const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const bcrypt = require('bcrypt');

// Load config file with absolute path
const config = require(__dirname+'/../config.json');

// Login to MySQL
const connection = mysql.createConnection({
    host: config.mysql.credentials.host,
    user: config.mysql.credentials.user,
    password: config.mysql.credentials.password,
    database: config.mysql.credentials.database
});
connection.connect();

router.use((req, res, next) => { 
    // Check auth
    if (!req.headers.authorization) return res.status(401).json({error: 'invalid_token', error_description: 'Missing authorization header'});
    if (!req.headers.authorization.startsWith('Bearer ')) return res.status(401).json({error: 'invalid_token', error_description: 'Invalid authorization header'});
    let token = req.headers.authorization.replace('Bearer ', '');
    connection.query('SELECT * FROM '+config.mysql.tables.tokens+' WHERE access_token = ?', [token], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error: ' + err);
        // Check if token is valid
        if (results.length == 0) return res.status(401).json({error: 'invalid_token', error_description: 'Invalid token'});
        const expiryDate = new Date(results[0].expiry);
        const expiryTime = expiryDate.getTime() - expiryDate.getTimezoneOffset() * 60 * 1000;
        if (expiryTime < Date.now()) {
            return res.status(401).json({error: 'invalid_token', error_description: 'Token expired'});
        }
        if (token != results[0].access_token) return res.status(401).json({error: 'invalid_token', error_description: 'Invalid token'});
        // Set user id
        res.locals.user_id = results[0].user_id;
        next();
    });
});

router.get('/', (req, res) => {
    // Get all homework
    connection.query('SELECT * FROM '+config.mysql.tables.homework+' WHERE user_id = ?', [res.locals.user_id], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error: ' + err);
        res.json(results);
    });
});

router.post('/', (req, res) => {

});

router.delete('/', (req, res) => {

});

router.patch('/', (req, res) => {

});


module.exports = router