// / = /v1/homework

// Require needed modules
const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const bodyParser = require('body-parser');

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

// Body parser
router.use(bodyParser.json());

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
    // Check if body is empty
    if (!req.body) return res.status(400).json({error: 'invalid_request', error_description: 'Missing request body'});

    // Check class_id
    if (!req.body.class_id) return res.status(400).json({error: 'invalid_request', error_description: 'Missing class_id'});
    // Check deadline
    if (!req.body.deadline) return res.status(400).json({error: 'invalid_request', error_description: 'Missing deadline'});
    // Check text
    if (!req.body.text) return res.status(400).json({error: 'invalid_request', error_description: 'Missing text'});
    // Check type
    if (!req.body.type) return res.status(400).json({error: 'invalid_request', error_description: 'Missing type'});

    // Check if class exists and user is owner
    connection.query('SELECT * FROM '+config.mysql.tables.classes+' WHERE id = ? AND user_id = ?', [req.body.class_id, res.locals.user_id], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error: ' + err);
        if (results.length == 0) return res.status(400).json({error: 'invalid_request', error_description: 'Class does not exist or you are not the owner'});
        
        // Check if deadline is in format YYYY-MM-DD
        if (!req.body.deadline.match(/^\d{4}-\d{2}-\d{2}$/)) return res.status(400).json({error: 'invalid_request', error_description: 'Invalid deadline format'});
        // Check if deadline is a valid date
        if (isNaN(Date.parse(req.body.deadline))) return res.status(400).json({error: 'invalid_request', error_description: 'Invalid deadline'});

        // Check if text is too long | max 75
        if (req.body.text.length > 75) return res.status(400).json({error: 'invalid_request', error_description: 'Text is too long'});

        // Check if type is valid | b/v/w/o
        if (!req.body.type.match(/^[b|v|w|o]$/)) return res.status(400).json({error: 'invalid_request', error_description: 'Invalid type'});

        // Insert homework
        connection.query('INSERT INTO '+config.mysql.tables.homework+' (class, deadline, text, type, user_id) VALUES (?, ?, ?, ?, ?)', [req.body.class_id, req.body.deadline, req.body.text, req.body.type, res.locals.user_id], (err, results) => {
            if (err) return res.status(500).send('Internal Server Error: ' + err);
            res.json({id: results.insertId});
        });
    });
});

router.delete('/:id', (req, res) => {
    // Check if id is a number
    if (isNaN(req.params.id)) return res.status(400).json({error: 'invalid_request', error_description: 'Invalid id'});
    // Check if homework exists and user is owner
    connection.query('SELECT * FROM '+config.mysql.tables.homework+' WHERE entry_id = ? AND user_id = ?', [req.params.id, res.locals.user_id], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error: ' + err);
        if (results.length == 0) return res.status(400).json({error: 'invalid_request', error_description: 'Homework does not exist or you are not the owner'});
        // Delete homework
        connection.query('DELETE FROM '+config.mysql.tables.homework+' WHERE entry_id = ?', [req.params.id], (err, results) => {
            if (err) return res.status(500).send('Internal Server Error: ' + err);
            res.json({success: true});
        });
    });
});

router.patch('/', (req, res) => {

});


module.exports = router