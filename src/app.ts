import * as express from "express";
import * as uuid from "uuid";
import { SocketConnector } from './base/SocketConnector';
import { broker } from '../../CommonJS/src/base/base.model';
import { QueueType } from '../../CommonJS/src/messaging/QueueType';
import * as  io from 'socket.io';

class Server {
    private app: express.Express;
    private socket: any;

    public static server(): Server {
        return new Server();
    }

    constructor() {
        this.app = express();
        this.config();
        this.initSocket();
        this.initBroker();
    }

    private config() {

    }

    private initSocket() {
        this.socket = new SocketConnector(io());
    }

    private async initBroker() {
        await broker.init();
        const queueName = QueueType.SOCKET_SERVICE;
        //setup queue for being able to reply to exactly this service requests
        const callbackQueue = queueName + "-" + uuid.v4();
        broker.declareQueue(callbackQueue, { autoDelete: true });
        broker.callbackQueue = callbackQueue;
        broker.subscribe(callbackQueue, undefined, undefined, false);
    }

    public get socketIO() {
        return this.socket.io;
    }

    public get server() {
        return this.app;
    }

}

let server = Server.server();

module.exports = server;