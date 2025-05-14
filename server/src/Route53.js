import os from 'node:os';
//import asyncHandler from 'express-async-handler';
import { Route53Client,
         ChangeResourceRecordSetsCommand,
         GetChangeCommand
       } from '@aws-sdk/client-route-53';

//import { upsertRecordSet } from 'mindless-route53';

const TTL = 60;  // 1 minute (the smallest it can be i believe)


const log = Object.assign({}, console);
log.debug = ()=>{};


export default class Route53 {
    constructor(subdomain) {
        this.route53_client = new Route53Client({ region: 'us-east-1' });
        this.subdomain = subdomain;
        if (this.subdomain.startsWith('*.')) {
            this.subdomain = this.subdomain.replace('*.', '');
        }
    }


    async init() {
    }


    addRoutes(app) {
    }


    getSubdomain() {
        return this.subdomain;
    }


    async updateOurIPAddress(hostname, ip_address) {
        try {
            log.log(`updating ip address for hostname ${hostname} to ${ip_address}`);
            let changeInfo = await this.updateRoute53Record(hostname, ip_address);
            await this.waitForChangeToPropagate(changeInfo.Id);
        } catch (err) {
            log.error('failed to update dns record:', err);
        }
    }


    async updateRoute53Record(hostname, ip_address) {
        let params = this.assembleParams(hostname, ip_address);
        let command = new ChangeResourceRecordSetsCommand(params);
        let response = await this.route53_client.send(command);
        log.log(`updated dns record to ${ip_address}`, response.ChangeInfo);
        return response.ChangeInfo;
    }


    async waitForChangeToPropagate(change_id) {
        let command = new GetChangeCommand({ Id: change_id });
        let status = 'PENDING';
        let retries = 30;

        while (status === 'PENDING' && retries-- > 0) {
            let response = await this.route53_client.send(command);
            status = response.ChangeInfo.Status;
            log.log(`change status: ${status}`);
            if (status === 'INSYNC') break;
            await new Promise((res) => setTimeout(res, 5000));  // wait 5 seconds
        }

        if (status === 'INSYNC') {
            log.log('dns change has propagated across all route 53 name servers');
        } else {
            log.warn('dns change is still pending after max retries');
        }
    }


    assembleParams(hostname, ip_address) {
        let record_name = `${hostname}.${this.subdomain}.`;  // note the trailing dot

        let upsert_action = {
            Action: 'UPSERT',
            ResourceRecordSet: {
                Name: record_name,
                Type: 'A',
                TTL: TTL,
                ResourceRecords: [{ Value: ip_address }]
            }
        };

        let params = {
            HostedZoneId: process.env.ROUTE53_HOSTED_ZONE_ID,
            ChangeBatch: {
                Changes: [
                    upsert_action
                ]
            }
        };

        return params;
    }


    async setDnsChallenge(record_name, value) {
        let command = new ChangeResourceRecordSetsCommand({
            HostedZoneId: process.env.ROUTE53_HOSTED_ZONE_ID,
            ChangeBatch: {
                Changes: [{
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                        Name: record_name,
                        Type: 'TXT',
                        TTL: TTL,
                        ResourceRecords: [{ Value: `"${value}"` }]
                    }
                }]
            }
        });

        let response = await this.route53_client.send(command);
        let change_id = response.ChangeInfo.Id;
        await this.waitForChangeToPropagate(change_id);
        log.log(`dns challenge record set for ${record_name}`);
    }


    async removeDnsChallenge(record_name) {
        let command = new ChangeResourceRecordSetsCommand({
            HostedZoneId: process.env.ROUTE53_HOSTED_ZONE_ID,
            ChangeBatch: {
                Changes: [{
                    Action: 'DELETE',
                    ResourceRecordSet: {
                        Name: record_name,
                        Type: 'TXT',
                        TTL: TTL,
                        ResourceRecords: [{ Value: '"dummy"' }]  // Replace with actual value if you track it (???)
                    }
                }]
            }
        });

        try {
            await this.route53_client.send(command);
            log.log(`dns challenge record removed for ${record_name}`);
        } catch (err) {
            log.warn(`could not remove record ${record_name} (may already be gone)`);
        }
    }
}
