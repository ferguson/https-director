import { HTTPSDirectorDevice, WebServer } from './API.js';
import parseArgs from '../../server/src/parseArgs.js';

const log = console;

const usage = `
  --server <url>   - https director server url (required)
  --port <port>    - override the default port (443)
  --bind           - the ip address to bind to (default 0.0.0.0)
  --redirect-http  - redirect port 80 to port 443 (or --port)
  --redirect-port  - change port for redirector to listen on (default 80)
`;
//   --devicename <name>   - unique device name to use (defaults to hostname)

const defaults = {
    '--port': 443,
    '--bind': '0.0.0.0',
    // '--redirect-http': true,
    // '--redirect-port': 80,
};

const environment = {
    '--server':           'HTTPS_DIRECTOR_SERVER_URL',
    '--port':             'PORT',
    '--bind':             'HOST',
    '--use-https':        'HTTPS',
    '--redirect-http':    'HTTPS_DIRECTOR_SERVER_REDIRECT_HTTP',
    '--redirect-port':    'HTTPS_DIRECTOR_SERVER_REDIRECT_PORT',
    '--cert-chain-file':  'SSL_CERT_FILE',
    '--private-key-file': 'SSL_KEY_FILE',
};


export default async function main(argv) {
    let options = parseArgs(argv, usage, defaults, environment);
    log.log('options', options);
    let webServer = new WebServer(options);
    let director = new HTTPSDirectorDevice(options, webServer);
    await director.init();
    log.debug('local director device ready');
}
