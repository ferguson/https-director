import http from 'http';
import express from 'express';
import { freeParser } from '_http_common';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import asyncHandler from 'express-async-handler';
//import WebSocketStream from 'websocket-stream';
import { WebSocketServer, createWebSocketStream } from 'ws';
import { Server as SocketIOServer } from 'socket.io';

import { Certificates, Route53, LetsEncrypt } from './API.js';

const log = Object.assign({}, console);
log.debug = ()=>{};

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = __dirname + '/../../static';


export default class HTTPSDirectorServer {
    constructor(options) {
        this.hostname = options.hostname;
        this.options = options;
        this.certificates = new Certificates();
        this.route53 = new Route53(options.subdomain);
        this.letsEncrypt = new LetsEncrypt(this.certificates, this.route53);
    }


    async init() {
        await this.certificates.init();
        await this.route53.init();
        await this.letsEncrypt.init();

        this.ws_server = new WebSocketServer(
            { clientTracking: false, noServer: true, perMessageDeflate: false }
        );
        this.static_server = express.static(STATIC_DIR);
        this.io_http_server = http.createServer();
        this.io_http_server.removeAllListeners('upgrade');
        let io_opts = {
            transports: ['websocket'],  // websockets only, no long poll
            //path: '/otto-hub/',
            serveClient: false,
        };
        this.io = new SocketIOServer(this.io_http_server, io_opts);
        //this.io = new SocketIOServer(io_opts);
    }


    addRoutes(app) {
        app.post('/api/v1/certificate', asyncHandler(async (req, res) => {
            let hostname = req.body.hostname;
            let ip_address = req.body.ip_address;
            log.log(`/api/v1/certificate request for ${hostname} with ip address ${ip_address}`);
            let ipchanged = await this.route53.updateOurIPAddressIfChanged(hostname, ip_address);
            let { cert, key, isnewcert } = await this.letsEncrypt.getCertificateForHostname(hostname);
            res.json({ cert, key, isnewcert, ipchanged });
        }));
    }
}
