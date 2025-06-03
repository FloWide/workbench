import { environment } from "@env/environment";




export namespace Logger {

    export function logMessage(...args: any[]): void {
        if (!environment.production) {
            console.log(...args)
        }
    }

    export function logWarning(...args: any[]): void {
        if (!environment.production) {
            console.warn(...args)
        }
    }

    export function logError(...args: any[]): void {
        console.error(...args)
    }

    export function logAlways(...args: any[]): void {
        console.log(...args)
    }

}