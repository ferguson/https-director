import { WebServer } from './API.js';
import parseArgs from './parseArgs.js';

const log = Object.assign({}, console);
//log.debug = ()=>{};


const usage = `
  --subdomain <subdomain>  - subdomain to manage dns entries and certificates for (required)
                             may optionally start with * where the hostname would go
                             e.g. direct.example.com or *.direct.example.com
  --email <email>          - email address to provide to Let's Encrypt (required)
  --port <port>            - override the default port (80 for http, 443 for https)
  --bind                   - the ip address to bind to (default 0.0.0.0)
  --use-https              - use https
  --redirect-http          - redirect port 80 to port 443 (or --port) if using https
  --redirect-port          - change port for redirector to listen on (default 80)
  --private-key-file       - privkey.pem file to use for https
  --cert-chain-file        - fullchain.pem file to use for https
`;

const environment = {
    '--subdomain':        'HTTPS_DIRECTOR_SUBDOMAIN',
    '--email':            'HTTPS_DIRECTOR_EMAIL',
    '--port':             'PORT',
    '--bind':             'HOST',
    '--use-https':        'HTTPS',
    '--redirect-http':    'HTTPS_DIRECTOR_SERVER_REDIRECT_HTTP',
    '--redirect-port':    'HTTPS_DIRECTOR_SERVER_REDIRECT_PORT',
    '--cert-chain-file':  'SSL_CERT_FILE',
    '--private-key-file': 'SSL_KEY_FILE',
};

const defaults = {
    '--bind': '0.0.0.0',
    '--port': 80,
};


export default async function main(argv) {
    let options = parseArgs(argv, usage, defaults, environment);
    log.debug('options', options);
    let server = new WebServer(options);
    await server.init();
    log.debug('https-director server ready');
}
