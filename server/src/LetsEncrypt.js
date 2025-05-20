import { promises as fsP } from 'node:fs';
import url from 'node:url';
import path from 'node:path';
//import asyncHandler from 'express-async-handler';
import acme from 'acme-client';

const LETSENCRYPT_DIRECTORY_URL = acme.directory.letsencrypt.production;
//const LETSENCRYPT_DIRECTORY_URL = acme.directory.letsencrypt.staging;

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const ACCOUNT_KEY_DIR = path.normalize(path.join(__dirname, '../data/account'));
const ACCOUNT_KEY_FILE = path.join(ACCOUNT_KEY_DIR, 'account_key.json');

const log = Object.assign({}, console);
log.debug = ()=>{};


export default class LetsEncrypt {
    constructor(certificates, route53, email) {
        this.certificates = certificates;
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


    addRoutes() {}


    async getCertificateForHostname(hostname) {
        let [cert, key] = await this.certificates.loadLatestCertificateForHostname(hostname);
        let isnewcert = false;
        if (cert && key) {
            log.log(`found saved cert for ${hostname}, checking how long it is valid for`);
            let days_left = this.certificates.daysLeftOnCertificate(cert);
            if (days_left > 15.0) {
                console.log('saved cert is still valid for more than 15 days, using saved cert');
            } else {
                cert = key = undefined;
            }
        }

        if (!cert || !key) {
            console.log('requesting new cert');
            [cert, key] = await this.requestAndSaveCertificate(hostname);
            let days_left = this.certificates.daysLeftOnCertificate(cert);
            console.log(`new cert valid for at least ${Math.floor(days_left)} days`);
            isnewcert = true;
        }

        return {cert, key, isnewcert};
    }


    async requestAndSaveCertificate(hostname) {
        let [cert, key] = [null, null];
        try {
            [cert, key] = await this.requestCertificate(hostname);
            await this.certificates.saveCertificateForHostname(hostname, cert, key);
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
}
