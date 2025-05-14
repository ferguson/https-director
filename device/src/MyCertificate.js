import os from 'node:os';
import { promises as fsP } from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
//import asyncHandler from 'express-async-handler';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MYCERTIFICATE_DIR = path.normalize(path.join(__dirname, '../data/mycertificate'));

const log = Object.assign({}, console);
log.debug = ()=>{};


export default class MyCertificate {
    constructor(route53) {
    }


    async init() {
    }


    addRoutes(app) {
    }


    async saveCertificate(cert, key) {
        // save cert and key to disk
        let timestamp = Date.now();
        let filename_timestamp = this.timestampForFilename(timestamp);

        try {
            await fsP.mkdir(MYCERTIFICATE_DIR, { recursive: true });

            let fullchain_filename = `${filename_timestamp}-fullchain.pem`;
            let fullchain_file = path.join(MYCERTIFICATE_DIR, fullchain_filename);
            await fsP.writeFile(fullchain_file, cert);

            let privkey_filename = `${filename_timestamp}-privkey.pem`;
            let privkey_file = path.join(MYCERTIFICATE_DIR, privkey_filename);
            await fsP.writeFile(privkey_file, key);

            let fullchain_link = path.join(MYCERTIFICATE_DIR, 'fullchain.pem');
            let privkey_link = path.join(MYCERTIFICATE_DIR, 'privkey.pem');
            await this.symlinkForce(fullchain_filename, fullchain_link);
            await this.symlinkForce(privkey_filename, privkey_link);
        } catch(err) {
            log.error('error saving cert+key in', MYCERTIFICATE_DIR);
            throw err;
        }
    }


    timestampForFilename(timestamp) {
        let filename = (new Date(timestamp)).toISOString();
        // have: 2023-12-11T21:09:19.348Z
        // want: 20231211210919
        filename = filename.split('.')[0];         // drop fractional seconds and 'Z' timezone
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
