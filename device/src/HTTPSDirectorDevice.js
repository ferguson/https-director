import os from 'node:os';
import { fileURLToPath } from 'node:url';
import path, { dirname } from 'node:path';
import WebServer from './WebServer.js';
import MyCertificate from './MyCertificate.js';
import { fetchPostJSON } from './fetching.js';

const log = Object.assign({}, console);
//log.debug = ()=>{};

//const __dirname = dirname(fileURLToPath(import.meta.url));


export default class HTTPSDirectorDevice {
    constructor(options) {
        if (!options.server) throw new Error('server is required');
        this.options = options;
        this.server_url = options.server;
        this.myCertificate = new MyCertificate();
        this.web_server = new WebServer();
    }


    async init(hostname=null, ip_address=null) {
        this.hostname = hostname || this.getHostname();
        this.ip_address = ip_address || this.getLocalIPAddress();
        log.debug(`HTTPSDirectorDevice hostname ${hostname} ip_address ${ip_address}`);

        log.log('requesting certificate and dns name update...');
        let [cert, key] = await this.requestAndSaveCertificate();
        log.log('certificate and dns name updated');

        await this.web_server.init(cert, key);
    }


    async requestAndSaveCertificate() {
        let data = {
            hostname: this.hostname,
            ip_address: this.ip_address,
        };
        let result = await fetchPostJSON('/api/v1/certificate', data, null, this.server_url);
        let {cert, key} = result;
        await this.myCertificate.saveCertificate(cert, key);
        return [cert, key];
    }


    getHostname() {
        let hostname = os.hostname();
        hostname = hostname.split('.')[0];
        return hostname;
    }


    getLocalIPAddress() {
        let network_interfaces = os.networkInterfaces();
        let platform = os.platform();
        let ip_address;

        switch (platform) {
        case 'linux':
            let wlan0 = network_interfaces['wlan0'];
            for (let address of wlan0) {
                if (address?.family === 'IPv4') {
                    ip_address = address.address;
                    break;
                }
            }
            break;

        case 'darwin':
            let en0 = network_interfaces['en0'];
            for (let address of en0) {
                if (address?.family === 'IPv4') {
                    ip_address = address.address;
                    break;
                }
            }
            break;

        default:
            throw new Error(`do not know how to handle platfom ${platform}`);
        }

        return ip_address;
    }


    // async getPublicIPAddress() {
    //     let res = await axios.get('https://api.ipify.org?format=json');
    //     return res.data.ip;
    // }
}
