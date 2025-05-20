import { promises as fsP } from 'node:fs';
import url from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const CERTIFICATES_DIR = path.normalize(path.join(__dirname, '../data/certificates'));
const ONE_DAY_IN_MS = 1000 * 60 * 60 * 24;

const log = Object.assign({}, console);
log.debug = ()=>{};


export default class Certificates {
    constructor() {}
    async init() {}
    addRoutes() {}


    async saveCertificateForHostname(hostname, cert, key) {
        // save cert and key to disk in a hostname specific directory
        let timestamp = Date.now();
        let filename_timestamp = this.timestampForFilename(timestamp);

        let hostname_directory = path.join(CERTIFICATES_DIR, hostname);
        try {
            await fsP.mkdir(hostname_directory, { recursive: true });

            let fullchain_filename = `${filename_timestamp}-fullchain.pem`;
            let fullchain_file = path.join(hostname_directory, fullchain_filename);
            await fsP.writeFile(fullchain_file, cert);

            let privkey_filename = `${filename_timestamp}-privkey.pem`;
            let privkey_file = path.join(hostname_directory, privkey_filename);
            await fsP.writeFile(privkey_file, key);

            let fullchain_link = path.join(hostname_directory, 'fullchain.pem');
            let privkey_link = path.join(hostname_directory, 'privkey.pem');
            await this.symlinkForce(fullchain_filename, fullchain_link);
            await this.symlinkForce(privkey_filename, privkey_link);
        } catch(err) {
            log.error('error saving cert+key in', hostname_directory);
            throw err;
        }
    }


    async loadLatestCertificateForHostname(hostname) {
        // load cert and key pointed to by the soft links for hostname
        let hostname_directory = path.join(CERTIFICATES_DIR, hostname);
        let [cert, key] = [null, null];
        try {
            let fullchain_link = path.join(hostname_directory, 'fullchain.pem');
            let privkey_link = path.join(hostname_directory, 'privkey.pem');

            cert = await fsP.readFile(fullchain_link, 'utf8');
            key = await fsP.readFile(privkey_link, 'utf8');
        } catch(err) {
            if (err.code === 'ENOENT') {
                [cert, key] = [null, null];
            } else {
                log.error('error saving cert+key in', hostname_directory);
                throw err;
            }
        }
        return [cert, key];
    }


    daysLeftOnCertificate(cert) {
        let days_left = null;
        try {
            let { validTo } = new crypto.X509Certificate(cert);
            console.log('validTo', new Date(validTo));
            let time_left = new Date(validTo) - Date.now();
            if (time_left < 0) {
                days_left = 0;
            } else {
                days_left = time_left / ONE_DAY_IN_MS;
            }
        } catch(err) {
            console.error('error while checking days left on certificate', err);
        }
        return days_left;
    }


    timestampForFilename(timestamp) {
        let filename = (new Date(timestamp)).toISOString();
        // have: 2023-12-11T21:09:19.348Z
        // want: 20231211210919
        filename = filename.split('.')[0];          // drop fractional seconds and 'Z' timezone
        filename = filename.replace(/[:T-]/g, '');  // strip colons, dashes and 'T'
        return filename;
    }


    async symlinkForce(target, path) {
        try {
            await fsP.unlink(path);
        } catch(err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }
        await fsP.symlink(target, path);
    }
}
