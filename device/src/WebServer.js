import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import * as socket_io from 'socket.io';
//import compression from 'compression';
import cookieParser from 'cookie-parser';
//import asyncHandler from 'express-async-handler';

const log = { ...console };
//log.debug = ()=>{};

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = process.env.HTTPS_REFLECTOR_PUBLIC_STATIC_DIR || __dirname + '/../static';
const DEFAULT_CERTIFICATE_DIR  = __dirname + '/../data/mycertificate';


export default class WebServer {
    constructor(options, app=null) {
        this.options = { ...options };
        this.app = app;
    }


    async init(cert, key) {
        this.setSecureContext(cert, key);
        if (!this.app) {
            log.debug('creating express app');
            this.app = express();
        } else {
            log.debug('using provided express app');
        }
        let app = this.app;

        this.cookie_parser = cookieParser();
        // let io_opts = { transports: ['websocket'] };  // websockets only, no long poll
        // let io = new socket_io.Server(this.http_server, io_opts);

        app.use(cors({origin: '*'}));
        app.use(bodyParser.json());
        app.use(this.cookie_parser);
        //app.use(compression()); // wondering how much this helps, esp. locally
        this.addRoutes(app);

        let https_server = https.createServer({
            cert: cert,
            key: key,
            SNICallback: this.handleSNICallback.bind(this)
        });
        //this.https_server = https_server;
        https_server.on('request', app);

        https_server.listen(this.options.port, this.options.bind, async () => {
            log.log(`server listening on ${this.options.bind}:${this.options.port}`);
            // if (this.options.use_https && this.options.redirect_http) {
            //     this.initHTTPRedirector();
            // }
        });
    }


    setSecureContext(cert, key) {
        log.log('setting secure context');
        this.secure_context = tls.createSecureContext({ cert, key });
    }


    handleSNICallback(servername, callback) {
        log.log('SNICallback', servername);
        callback(null, this.secure_context);
    }


    addRoutes(app) {
        app.use((req, res, next) => {
            log.log('req.path', req.path);
            next();
        });
        log.log('STATIC_DIR', STATIC_DIR);
        app.use(express.static(STATIC_DIR));
    }


    initHTTPRedirector() {
        let redirect_app = express();  // using express here is a bit overkill
        let redirect_server = http.createServer(redirect_app);

        redirect_app.use((req, res, next) => {
            let host = (req.headers && req.headers.host) || this.options.hostname;
            host = host.split(':')[0];  // remove port
            log.debug('redirecting to', 'https://' + host + req.originalUrl);
            res.redirect('https://' + host + req.originalUrl);
        });

        redirect_server.listen(this.options.http_port, this.options.bind, async () => {
            log.log(`redirect server listening on ${this.options.bind}:${this.options.http_port}`);
        });
    }
}
