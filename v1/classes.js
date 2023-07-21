// / = /v1/classes

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
    connection.query('SELECT * FROM '+config.mysql.tables.classes+' WHERE user_id = ?', [res.locals.user_id], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error: ' + err);
        res.json(results);
    });
});

router.post('/', (req, res) => {
    // Check if body is empty
    if (!req.body) return res.status(400).json({error: 'invalid_request', error_description: 'Missing request body'});

    // Check name
    if (!req.body.name) return res.status(400).json({error: 'invalid_request', error_description: 'Missing name'});
    if (req.body.name.length > 20) return res.status(400).json({error: 'invalid_request', error_description: 'Name is too long'});
    // Check color
    if (!req.body.color) return res.status(400).json({error: 'invalid_request', error_description: 'Missing color'});
    if (!req.body.color.match(/^[0-9A-F]{6}$/i)) return res.status(400).json({error: 'invalid_request', error_description: 'Invalid color'});
    // Check grade_k
    if (!req.body.grade_k) return res.status(400).json({error: 'invalid_request', error_description: 'Missing grade_k'});
    if (isNaN(req.body.grade_k)) return res.status(400).json({error: 'invalid_request', error_description: 'Invalid grade_k'});
    // Check grade_m
    if (!req.body.grade_m) return res.status(400).json({error: 'invalid_request', error_description: 'Missing grade_m'});
    if (isNaN(req.body.grade_m)) return res.status(400).json({error: 'invalid_request', error_description: 'Invalid grade_m'});
    // Check grade_t
    if (!req.body.grade_t) return res.status(400).json({error: 'invalid_request', error_description: 'Missing grade_t'});
    if (isNaN(req.body.grade_t) && req.body.grade_t != "1exam") return res.status(400).json({error: 'invalid_request', error_description: 'Invalid grade_t'});
    // Check grade_s
    if (!req.body.grade_s) return res.status(400).json({error: 'invalid_request', error_description: 'Missing grade_s'});
    if (isNaN(req.body.grade_s)) return res.status(400).json({error: 'invalid_request', error_description: 'Invalid grade_s'});

    // Insert homework
    // Get date in Format YYYY-MM-DD HH:MM:SS
    lastuse = new Date();
    lastuse = lastuse.toISOString().slice(0, 19).replace('T', ' ');
    connection.query('INSERT INTO '+config.mysql.tables.classes+' (name, color, user_id, last_used, grade_k, grade_m, grade_t, grade_s) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [req.body.name, req.body.color, res.locals.user_id, lastuse, req.body.grade_k, req.body.grade_m, req.body.grade_t, req.body.grade_s], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error: ' + err);
        res.json({success: true, id: results.insertId});
    });
});

router.delete('/:id', (req, res) => {
    // Check if id is a number
    if (isNaN(req.params.id)) return res.status(400).json({error: 'invalid_request', error_description: 'Invalid id'});
    // Check if homework exists and user is owner
    connection.query('SELECT * FROM '+config.mysql.tables.classes+' WHERE id = ? AND user_id = ?', [req.params.id, res.locals.user_id], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error: ' + err);
        if (results.length == 0) return res.status(400).json({error: 'invalid_request', error_description: 'Class does not exist or you are not the owner'});
        // Delete homework
        connection.query('DELETE FROM '+config.mysql.tables.classes+' WHERE id = ?', [req.params.id], (err, results) => {
            if (err) return res.status(500).send('Internal Server Error: ' + err);
            res.json({success: true});
        });
    });
});

router.patch('/:id', (req, res) => {
    // Check if id is a number
    if (isNaN(req.params.id)) return res.status(400).json({error: 'invalid_request', error_description: 'Invalid id'});
    // Check if body is empty
    if (!req.body) return res.status(400).json({error: 'invalid_request', error_description: 'Missing request body'});

    // Load old class data
    connection.query('SELECT * FROM '+config.mysql.tables.classes+' WHERE id = ?', [req.params.id], (err, results) => {
        class_entry = results[0];
        error = false;
        
        // Check if user is owner
        if (class_entry.user_id != res.locals.user_id) { 
            error = true;
            return res.status(400).json({error: 'invalid_request', error_description: 'You are not the owner of this class'});
        }

        // Check if name change is requested
        if (!error && req.body.name) {
            error = false;
            // Check if name is valid
            if (req.body.name.length > 20) {
                error = true;
                return res.status(400).json({error: 'invalid_request', error_description: 'Name is too long'});
            }
            // Update name
            class_entry.name = req.body.name;
        }

        // Check if color change is requested
        if (!error && req.body.color) {
            error = false;
            // Check if color is valid
            if (!req.body.color.match(/^[0-9A-F]{6}$/i)) {
                error = true;
                return res.status(400).json({error: 'invalid_request', error_description: 'Invalid color'});
            }
            // Update color
            class_entry.color = req.body.color;
        }

        // Check if grade_k change is requested
        if (!error && req.body.grade_k) {
            error = false;
            // Check if grade_k is valid
            if (isNaN(req.body.grade_k)) {
                error = true;
                return res.status(400).json({error: 'invalid_request', error_description: 'Invalid grade_k'});
            }
            // Update grade_k
            class_entry.grade_k = req.body.grade_k;
        }

        // Check if grade_m change is requested
        if (!error && req.body.grade_m) {
            error = false;
            // Check if grade_m is valid
            if (isNaN(req.body.grade_m)) {
                error = true;
                return res.status(400).json({error: 'invalid_request', error_description: 'Invalid grade_m'});
            }
            // Update grade_m
            class_entry.grade_m = req.body.grade_m;
        }

        // Check if grade_t change is requested
        if (!error && req.body.grade_t) {
            error = false;
            // Check if grade_t is valid
            if (isNaN(req.body.grade_t) && req.body.grade_t != "1exam") {
                error = true;
                return res.status(400).json({error: 'invalid_request', error_description: 'Invalid grade_t'});
            }
            // Update grade_t
            class_entry.grade_t = req.body.grade_t;
        }

        // Check if grade_s change is requested
        if (!error && req.body.grade_s) {
            error = false;
            // Check if grade_s is valid
            if (isNaN(req.body.grade_s)) {
                error = true;
                return res.status(400).json({error: 'invalid_request', error_description: 'Invalid grade_s'});
            }
            // Update grade_s
            class_entry.grade_s = req.body.grade_s;
        }

        // Check if average change is requested (average can be floats but also integers)
        if (!error && req.body.average) {
            error = false;
            // Check if average is valid
            if (isNaN(req.body.average)) {
                error = true;
                return res.status(400).json({error: 'invalid_request', error_description: 'Invalid average'});
            }
            // Update average
            class_entry.average = req.body.average;
        }

        // Update homework
        if (!error) {

            // Update homework
            connection.query('UPDATE '+config.mysql.tables.classes + ' SET name = ?, color = ?, grade_k = ?, grade_m = ?, grade_t = ?, grade_s = ?, average = ? WHERE id = ?', [class_entry.name, class_entry.color, class_entry.grade_k, class_entry.grade_m, class_entry.grade_t, class_entry.grade_s, class_entry.average ,req.params.id], (err, results) => {
                if (err) return res.status(500).send('Internal Server Error: ' + err);
                res.json({success: true});
            });
        }
    });
});


module.exports = router