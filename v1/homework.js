// / = /v1/homework

// Require needed modules
const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const bodyParser = require('body-parser');

// Load config file with absolute path
const config = require(__dirname + '/../config.json');

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
    if (!req.headers.authorization) return res.status(401).json({ error: 'invalid_token', error_description: 'Missing authorization header' });
    if (!req.headers.authorization.startsWith('Bearer ')) return res.status(401).json({ error: 'invalid_token', error_description: 'Invalid authorization header' });
    let token = req.headers.authorization.replace('Bearer ', '');
    connection.query('SELECT * FROM ' + config.mysql.tables.tokens + ' WHERE access_token = ?', [token], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error');
        // Check if token is valid
        if (results.length == 0) return res.status(401).json({ error: 'invalid_token', error_description: 'Invalid token' });
        const expiryDate = new Date(results[0].expiry);
        const expiryTime = expiryDate.getTime() - expiryDate.getTimezoneOffset() * 60 * 1000;
        if (expiryTime < Date.now()) {
            return res.status(401).json({ error: 'invalid_token', error_description: 'Token expired' });
        }
        if (token != results[0].access_token) return res.status(401).json({ error: 'invalid_token', error_description: 'Invalid token' });
        // Set user id
        res.locals.user_id = results[0].user_id;
        next();
    });
});

router.get('/', (req, res) => {
    // Get all homework
    connection.query('SELECT * FROM ' + config.mysql.tables.homework + ' WHERE user_id = ?', [res.locals.user_id], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error');
        res.json(results);
    });
});

router.post('/', (req, res) => {
    // Check if body is empty
    if (!req.body) return res.status(400).json({ error: 'invalid_request', error_description: 'Missing request body' });

    // Check class_id
    if (!req.body.class_id) return res.status(400).json({ error: 'invalid_request', error_description: 'Missing class_id' });
    // Check deadline
    if (!req.body.deadline) return res.status(400).json({ error: 'invalid_request', error_description: 'Missing deadline' });
    // Check text
    if (!req.body.text) return res.status(400).json({ error: 'invalid_request', error_description: 'Missing text' });
    // Check type
    if (!req.body.type) return res.status(400).json({ error: 'invalid_request', error_description: 'Missing type' });

    // Check if class exists and user is owner
    connection.query('SELECT * FROM ' + config.mysql.tables.subjects + ' WHERE id = ? AND user_id = ?', [req.body.class_id, res.locals.user_id], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error');
        if (results.length == 0) return res.status(400).json({ error: 'invalid_request', error_description: 'Class does not exist or you are not the owner' });

        // Check if deadline is in format YYYY-MM-DD
        if (!req.body.deadline.match(/^\d{4}-\d{2}-\d{2}$/)) return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid deadline format' });
        // Check if deadline is a valid date
        if (isNaN(Date.parse(req.body.deadline))) return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid deadline' });

        // Check if text is too long | max 75
        if (typeof req.body.text == "string" && req.body.text.length > 75) return res.status(400).json({ error: 'invalid_request', error_description: 'Text is too long' });

        // Check if type is valid | b/v/w/o
        if (!req.body.type.match(/^[b|v|w|o]$/)) return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid type' });

        // Insert homework
        given = new Date();
        given = given.toISOString().slice(0, 19).replace('T', ' ');
        connection.query('INSERT INTO ' + config.mysql.tables.homework + ' (class, deadline, given, text, type, user_id) VALUES (?, ?, ?, ?, ?, ?)', [req.body.class_id, req.body.deadline, given, req.body.text, req.body.type, res.locals.user_id], (err, results) => {
            if (err) return res.status(500).send('Internal Server Error');
            res.json({ id: results.insertId });
        });
    });
});

router.delete('/:id', (req, res) => {
    // Check if id is a number
    if (isNaN(req.params.id)) return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid id' });
    // Check if homework exists and user is owner
    connection.query('SELECT * FROM ' + config.mysql.tables.homework + ' WHERE entry_id = ? AND user_id = ?', [req.params.id, res.locals.user_id], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error');
        if (results.length == 0) return res.status(400).json({ error: 'invalid_request', error_description: 'Homework does not exist or you are not the owner' });
        // Delete homework
        connection.query('DELETE FROM ' + config.mysql.tables.homework + ' WHERE entry_id = ?', [req.params.id], (err, results) => {
            if (err) return res.status(500).send('Internal Server Error');
            res.json({ success: true });
        });
    });
});

router.patch('/:id', (req, res) => {
    // Check if id is a number
    if (isNaN(req.params.id)) return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid id' });
    // Check if body is empty
    if (!req.body) return res.status(400).json({ error: 'invalid_request', error_description: 'Missing request body' });

    // Load old homework data (user_id, entry_id, class, deadline, text, type, status)
    connection.query('SELECT * FROM ' + config.mysql.tables.homework + ' WHERE entry_id = ?', [req.params.id], (err, results) => {
        hw_entry = results[0];
        error = false;

        // Check if user is owner
        if (hw_entry.user_id != res.locals.user_id) {
            error = true;
            return res.status(400).json({ error: 'invalid_request', error_description: 'You are not the owner of this homework' });
        }

        // Check if class_id change is requested
        if (!error && req.body.class_id) {
            error = false;
            // Check if class exists and user is owner
            connection.query('SELECT * FROM ' + config.mysql.tables.subjects + ' WHERE id = ? AND user_id = ?', [req.body.class_id, res.locals.user_id], (err, results) => {
                if (err) {
                    error = true;
                    return res.status(500).send('Internal Server Error');
                }
                if (results.length == 0) {
                    error = true;
                    return res.status(400).json({ error: 'invalid_request', error_description: 'Class does not exist or you are not the owner' });
                }
                // Update class_id
                hw_entry.class = req.body.class_id;
            });
        }

        // Check if deadline change is requested
        if (!error && req.body.deadline) {
            error = false;
            // Check if deadline is in format YYYY-MM-DD
            if (!req.body.deadline.match(/^\d{4}-\d{2}-\d{2}$/)) {
                error = true;
                return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid deadline format' });
            }
            // Check if deadline is a valid date
            if (isNaN(Date.parse(req.body.deadline))) {
                error = true;
                return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid deadline' });
            }
            // Update deadline
            hw_entry.deadline = req.body.deadline;
        }

        // Check if text change is requested
        if (!error && req.body.text) {
            error = false;
            // Check if text is too long | max 75
            if (typeof req.body.text == "string" && req.body.text.length > 75) {
                error = true;
                return res.status(400).json({ error: 'invalid_request', error_description: 'Text is too long' });
            }
            // Update text
            hw_entry.text = req.body.text;
        }

        // Check if type change is requested
        if (!error && req.body.type) {
            error = false;
            // Check if type is valid | b/v/w/o
            if (!req.body.type.match(/^[b|v|w|o]$/)) {
                error = true;
                return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid type' });
            }
            // Update type
            hw_entry.type = req.body.type;
        }

        // Check if status change is requested
        if (!error && req.body.status) {
            error = false;
            // Check if status is valid | 0/1/2
            if (!req.body.status.toString().match(/^[0|1|2]$/)) {
                error = true;
                return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid status' });
            }
            // Update status
            hw_entry.status = req.body.status;
        }

        // Update homework
        if (!error) {

            // Update homework
            connection.query('UPDATE ' + config.mysql.tables.homework + ' SET class = ?, deadline = ?, text = ?, type = ?, status = ? WHERE entry_id = ?', [hw_entry.class, hw_entry.deadline, hw_entry.text, hw_entry.type, hw_entry.status, req.params.id], (err, results) => {
                if (err) return res.status(500).send('Internal Server Error');
                res.json({ success: true });
            });
        }
    });
});


module.exports = router