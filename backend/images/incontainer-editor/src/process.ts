import type {IPty, IDisposable} from "node-pty";
import { spawn } from "node-pty"
import {getPortsForPid, EventEmitter2, getChildProcesses} from './utils'

export type NotificationType = 'PORTS_CHANGED' | 
                                'PROCESS_EXITED' | 
                                'PROCESS_STARTED' | 
                                'CHILD_PROCESS_STARTED' |
                                'CHILD_PROCESS_EXITED';

export interface Notification {
    pid: number;
    type: NotificationType;
    ppid?: number;
    data: any;
}

function areArraysEqual<T>(array1: T[], array2: T[]): boolean {
    if (array1.length !== array2.length) {
        return false;
    }

    for (let i = 0; i < array1.length; i++) {
        if (array1[i] !== array2[i]) {
            return false;
        }
    }

    return true;
}

export interface ChildProcess {
    pid: number;
    ppid: number;
    name: string;
    ports?: number[];
}

export default class Process implements IDisposable {

    public pid: number
    public ports: number[] = []

    private _notify: EventEmitter2<Notification> = new EventEmitter2();

    private _portsWatcher: NodeJS.Timer

    private children: Record<number, ChildProcess> = {}

    constructor(
        private pty: IPty,
        private cmd: string,
        private args: string[]
    ) {
        this.pid = pty.pid
        this.onExit((result) => {
            for(const cproc of Object.values(this.children)) {
                try{
                    process.kill(cproc.pid)
                } catch {
                    //noop
                }
                this._notify.fire({
                    type:'CHILD_PROCESS_EXITED',
                    pid:this.pid,
                    data:cproc
                })
            }
            this._notify.fire({
                pid:this.pid,
                type:'PROCESS_EXITED',
                data:result
            });
        });
        this._notify.fire({
            pid:this.pid,
            type:'PROCESS_STARTED',
            data:this.toJSON()
        })
        console.log("New process", this.toJSON());
        this._portsWatcher = setInterval(this.refresh.bind(this),2000)
    }

    private async refresh() {
        this.ports = await this.checkForPorts(this.pid, this.ports)
        const procs = await getChildProcesses(this.pid)
        const childPids: Set<number> = new Set();
        for(const proc of procs) {
            childPids.add(proc.PID)
            if ( !(proc.PID in this.children) ) {
                this.children[proc.PID] = {
                    pid:proc.PID,
                    ppid:this.pid,
                    name:proc.CMD,
                    ports:[]
                }
                console.log("New child process: ", this.children[proc.PID])
                this._notify.fire({
                    type:'CHILD_PROCESS_STARTED',
                    pid:this.pid,
                    data:this.children[proc.PID]
                })
            }
        }
        for(const cproc of Object.values(this.children)) {
            if (!childPids.has(cproc.pid)) {
                delete this.children[cproc.pid]
                console.log("Child process exited: ", cproc)
                this._notify.fire({
                    type:'CHILD_PROCESS_EXITED',
                    pid:this.pid,
                    data:cproc
                })
            } else {
                this.children[cproc.pid].ports = await this.checkForPorts(cproc.pid, cproc.ports || [], true,this.pid)
            }
        }
    }

    private async checkForPorts(pid: number, oldPorts: number[], checkDescendands: boolean = false ,ppid?: number) {
        const ports = await getPortsForPid(pid, checkDescendands)
        if (!areArraysEqual(ports, oldPorts)) {
            console.log("Ports",ports,"opened on process ", pid)
            this._notify.fire({
                type:'PORTS_CHANGED',
                pid:pid,
                ppid: ppid,
                data:ports
            })
        }
        return ports
    }

    static spawn(data: any): Process {
        const new_proc = spawn(data.cmd || "run", data.args || [], {
            name: data.term || "xterm-color",
            cols: data.cols || 80,
            rows: data.rows || 30,
            cwd: data.cwd || process.cwd(),
            env: Object.assign(data.env || {}, process.env),
            encoding: "utf-8",
        });
        return new Process(new_proc, data.cmd || "run", data.args || []);
    }

    pause(): void {
        this.pty!.pause()
    }

    resume(): void {
        this.pty!.resume()
    }

    resize(cols: number, rows: number): void {
        this.pty!.resize(cols, rows)
    }

    kill(signal?: string) {
        this.pty!.kill(signal)
    }

    clear() {
        this.pty!.clear()
    }

    wait(timeout?: number) : Promise<{ exitCode: number, signal?: number } | {detail:string}> {
        return new Promise((resolve) => {
            const listener = this.pty!.onExit((e) => {
                resolve(e)
                listener.dispose()
            })
            if (timeout !== undefined && timeout !== null)
                setTimeout(() => {
                    listener.dispose()
                    resolve({detail:'Timeout'})
                },timeout)
        })    
    }

    write(data: string) {
        this.pty!.write(data)
    }

    onData(listener: (e: string) => any) : IDisposable {
        return this.pty!.onData(listener)
    }

    onExit(listener: (e: { exitCode: number, signal?: number }) => any): IDisposable {
        return this.pty!.onExit(listener)
    }

    onNotify(listener: (e: Notification) => any): IDisposable {
        return this._notify.event(listener)
    }

    dispose() {
        if (this.pty)
            this.pty.kill()
        clearInterval(this._portsWatcher)
    }

    toJSON() {
        return {
            pid:this.pid,
            name: this.pty.process,
            ports:this.ports,
            cmd: this.cmd,
            args: this.args,
            children:this.children
        }
    }
}