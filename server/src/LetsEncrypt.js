import os from 'node:os';
import { promises as fsP } from 'node:fs';
import path from 'node:path';
//import asyncHandler from 'express-async-handler';
import acme from 'acme-client';

//const LETSENCRYPT_DIRECTORY_URL = acme.directory.letsencrypt.production;
const LETSENCRYPT_DIRECTORY_URL = acme.directory.letsencrypt.staging;

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __dirname = dirname(fileURLToPath(import.meta.url));

const ACCOUNT_KEY_DIR = path.normalize(path.join(__dirname, '../data/account'));
const ACCOUNT_KEY_FILE = path.join(ACCOUNT_KEY_DIR, 'account_key.json');
const CERTIFICATES_DIR = path.normalize(path.join(__dirname, '../data/certificates'));

const log = Object.assign({}, console);
log.debug = ()=>{};


export default class LetsEncrypt {
    constructor(route53, email) {
        this.route53 = route53;
        this.email = email;
    }


    async init() {
        let account_key = await this.loadOrCreateAccountKey();

        this.acme_client = new acme.Client({
            directoryUrl: LETSENCRYPT_DIRECTORY_URL,
            accountKey: account_key
        });

        // enables debugging messages:
        acme.setLogger((message) => {
            log.debug(message);
        });
    }


    addRoutes(app) {
    }


    async requestAndSaveCertificate(hostname) {
        let [cert, key] = [null, null];
        try {
            [cert, key] = await this.requestCertificate(hostname);
            await this.saveCertificate(hostname, cert, key);
        } catch(err) {
            log.error('error requesting cert', err);
        }
        return [cert, key];
    }


    async requestCertificate(hostname) {
        let common_name = `${hostname}.${this.route53.getSubdomain()}`;
        let [key, csr] = await acme.crypto.createCsr({
            commonName: common_name
        });
        key = key.toString();

        let cert = await this.acme_client.auto({
            csr, email: this.email, termsOfServiceAgreed: true,
            challengePriority: ['dns-01'],
            challengeCreateFn: async (...args) => this.challengeCreateHandler(...args),
            challengeRemoveFn: async (...args) => this.challengeRemoveHandler(hostname, ...args)
        });

        return [cert, key];
    }


    async challengeCreateHandler(authz, challenge, keyAuthorization) {
        let record_name = `_acme-challenge.${authz.identifier.value}.`;
        //let value = acme.utils.toDns01(keyAuthorization);
        let value = keyAuthorization;
        await this.route53.setDnsChallenge(record_name, value);
    }


    async challengeRemoveHandler(hostname, authz, challenge, keyAuthorization) {
        let record_name = `_acme-challenge.${authz.identifier.value}.`;
        await this.route53.removeDnsChallenge(hostname);
    }


    async saveCertificate(hostname, cert, key) {
        // save cert and key to disk
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


    async loadOrCreateAccountKey() {
        let account_key;

        try {
            account_key = await fsP.readFile(ACCOUNT_KEY_FILE, 'utf8');
        } catch(err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }

        if (!account_key) {
            log.log('account key not found, creating it');
            account_key = await acme.crypto.createPrivateKey();
            try {
                await fsP.mkdir(ACCOUNT_KEY_DIR, { recursive: true });
                await fsP.writeFile(ACCOUNT_KEY_FILE, account_key);
            } catch(err) {
                log.error('error writing account key file', ACCOUNT_KEY_FILE);
                throw err;
            }
        }

        return account_key;
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
