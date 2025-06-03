#!/usr/bin/env node
import {promisify} from 'util';
import { access as accessSync, constants, stat as statSync } from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

const access = promisify(accessSync);
const stat = promisify(statSync);

const OPEN_URL = 'http://localhost:3000/openRequest';


(async function() {
    const file = process.argv[2]
    if (process.argv.length < 3) {
        console.log(`Usage ${path.basename(__filename)} <file>`)
        process.exit(1)
    }
    try {
        await access(file,constants.F_OK)
    } catch(err: any) {
        console.error(`${err.message}`)
        process.exit(1)
    }
    const stats = await stat(file)

    if (!stats.isFile()) {
        console.error(`${file} is not a file!`)
        process.exit(1)
    }
    const fullPath = path.resolve(file) 
    const data = JSON.stringify({
        "fullPath":fullPath,
        "path":file
    })
    try {
        const resp = await fetch(OPEN_URL, {
            method:'POST',
            body:data,
            headers:{
                "Content-Type":"application/json"
            }
        })
        if (resp.status !== 200) {
            console.error("Service unavailable")
            process.exit(1)
        }
    } catch(e) {
        console.error("Service unavailable")
        process.exit(1)
    }

})();