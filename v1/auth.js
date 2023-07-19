// / = /v1/auth

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

let rate_limit_ips = [];

router.get('/token', (req, res) => {

    // Ratelimiting
    if (rate_limit_ips.includes(req.ip)) return res.status(429).json({error: 'rate_limit_exceeded', error_description: 'You can only call this endpoint every '+config.rate_limits.auth.token+' seconds'});
    rate_limit_ips.push(req.ip);
    setTimeout(() => {
        rate_limit_ips.splice(rate_limit_ips.indexOf(req.ip), 1);
    }, config.rate_limits.auth.token * 1000);    

    // Check if the request has the required parameters
    if (!req.query.grant_type || !req.query.username || !req.query.password) 
        return res.status(400).json({error: 'invalid_request', error_description: 'Missing required parameter(s)'});

    // Check if the grant_type is password
    if (req.query.grant_type != 'password')
        return res.status(400).json({error: 'invalid_request', error_description: 'grant_type must be password'});

    // Check if the user exists
    connection.query('SELECT * FROM '+config.mysql.tables.accounts+' WHERE username = ?', [req.query.username], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error: ' + err);
        if (results.length == 0) return res.status(400).send('Bad Request: User does not exist');
        
        // Check if the password is correct (Password in the DB is hashed using php's password_hash() function)
        if (!bcrypt.compareSync(req.query.password, results[0].password.toString().replace("$2y$", "$2a$"))) return res.status(400).send('Bad Request: Incorrect password');
        
        // Delete the tokens if there are any tokens with the same user_id
        connection.query('DELETE FROM '+config.mysql.tables.tokens+' WHERE user_id = ?', [results[0].id], (err, results) => {
            if (err) return res.status(500).send('Internal Server Error: ' + err);
        });
        
        // Generate a random token a-z A-Z 0-9 (32 characters long)
        let token = "";
        let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < 32; i++) token += possible.charAt(Math.floor(Math.random() * possible.length));
        // Generate a random refresh token a-z A-Z 0-9 (32 characters long)
        let refresh_token = "";
        for (let i = 0; i < 32; i++) refresh_token += possible.charAt(Math.floor(Math.random() * possible.length));

        // Insert the token into the database
        expiry = new Date();
        expiry.setHours(expiry.getHours() + 1);
        expiry = expiry.toISOString().slice(0, 19).replace('T', ' ');
        connection.query('INSERT INTO '+config.mysql.tables.tokens+' (user_id, access_token, token_type, expiry, refresh_token) VALUES (?, ?, ?, ?, ?)', [results[0].id, token, 'Bearer', expiry, refresh_token], (err, results) => {
            if (err) return res.status(500).send('Internal Server Error: ' + err);

            // Send the token to the client
            res.send({ 
                access_token: token,
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: refresh_token
             });
        });
    });
});

router.get('/refresh', (req, res) => {

    // Ratelimiting
    if (rate_limit_ips.includes(req.ip)) return res.status(429).json({error: 'rate_limit_exceeded', error_description: 'You can only call this endpoint every '+config.rate_limits.auth.refresh+' seconds'});
    rate_limit_ips.push(req.ip);
    setTimeout(() => {
        rate_limit_ips.splice(rate_limit_ips.indexOf(req.ip), 1);
    }, config.rate_limits.auth.refresh * 1000);    

    // Check if the request has the required parameters
    if (!req.query.grant_type || !req.query.refresh_token) 
        return res.status(400).json({error: 'invalid_request', error_description: 'Missing required parameter(s)'});

    // Check if the grant_type is password
    if (req.query.grant_type != 'refresh_token')
        return res.status(400).json({error: 'invalid_request', error_description: 'grant_type must be refresh_token'});

    // Check if the refresh token exists
    connection.query('SELECT * FROM '+config.mysql.tables.tokens+' WHERE refresh_token = ?', [req.query.refresh_token], (err, results) => {
        if (err) return res.status(500).send('Internal Server Error: ' + err);

        // Generate a random token a-z A-Z 0-9 (32 characters long)
        let token = "";
        let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let i = 0; i < 32; i++) token += possible.charAt(Math.floor(Math.random() * possible.length));
        // Generate a random refresh token a-z A-Z 0-9 (32 characters long)
        let refresh_token = "";
        for (let i = 0; i < 32; i++) refresh_token += possible.charAt(Math.floor(Math.random() * possible.length));

        // Update the token in the database
        expiry = new Date();
        expiry.setHours(expiry.getHours() + 1);
        expiry = expiry.toISOString().slice(0, 19).replace('T', ' ');
        connection.query('UPDATE '+config.mysql.tables.tokens+' SET access_token = ?, expiry = ?, refresh_token = ? WHERE refresh_token = ?', [token, expiry, refresh_token, req.query.refresh_token], (err, results) => {
            if (err) return res.status(500).send('Internal Server Error: ' + err);

            // Send the token to the client            
            res.send({ 
                access_token: token,
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: refresh_token
             });
        });
    });
});

module.exports = router