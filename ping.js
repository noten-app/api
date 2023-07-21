// Ping route for /ping

const express = require('express');
const router = express.Router();
const ping = require('ping');

// Load config file with absolute path
const config = require(__dirname+'/config.json');

router.use('/', (req, res) => {
    ping.promise.probe(config.mysql.credentials.host).then((result) => {
        if (result.alive) {
            res.status(200).json({ ping: result.time });
        } else {
            res.status(500).json({ error: 'Internal Server Error'});
        }
    });
});

module.exports = router