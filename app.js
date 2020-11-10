"use strict";

process.on('uncaughtException', error => {
    console.error(error);
});

process.on('warning', warning => {
    console.error(warning);
});

//module dependencies.
const app = require("./src/app");
const http = require("http");
const configs = require('../CommonJS/src/utils/utils');
const config = configs.CONFIG();
//get port from environment and store in Express.
const port = normalizePort(config.Socket.port);
app.server.set("port", port);

//create http server
const server = http.createServer(app.server);
app.socketIO.attach(server);

server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}
function onListening() {
    var addr = server.address();
    var bind = typeof addr === "string"
        ? "pipe " + addr
        : "port " + addr.port;
    console.log("Listening on " + bind);
}
function onError(error) {
    if (error.syscall !== "listen") {
        throw error;
    }

    var bind = typeof port === "string"
        ? "Pipe " + port
        : "Port " + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case "EACCES":
            console.error(bind + " requires elevated privileges");
            process.exit(1);
            break;
        case "EADDRINUSE":
            console.error(bind + " is already in use");
            process.exit(1);
            break;
        default:
            throw error;
    }
}