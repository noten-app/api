// Require needed modules
const express = require('express');
const app = express();

// Load config file with absolute path
const config = require(__dirname+'/config.json');

// Simple request time logger
app.use((req, res, next) => {
    console.clear();
    console.log('Latest Request');
    console.log('==============');
    console.log('Time: ', Date.now());
    console.log('Request Type: ', req.method);
    console.log('Request IP: ', req.ip);
    console.log('Request Params: ', req.params);
    console.log('==============');
    if (config.logging) console.log('This request \x1b[32m%s\x1b[0m be logged!', 'will');
    else console.log('This request \x1b[31m%s\x1b[0m be logged!', 'will not');
    next();  
});

// V1
app.use('/v1', require('./v1/routes.js'))

// Ping route for Uptime-Monitoring-Software
app.use('/ping', require('./ping.js'));

// Wildcard routes
app.use('*', (req, res) => res.status(404).send('Warning: The requested route does not exist!'));

app.listen(config.port, () => console.log('Noten-App API listening on port '+config.port+'!'));