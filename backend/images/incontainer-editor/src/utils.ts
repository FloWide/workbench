import fs from "fs";
import { exec } from "child_process";
import type { IDisposable } from "node-pty";

interface SocketMap {
  [key: number]: {
    pid: number;
    socket: number;
  };
}

interface ParsedAddress {
  socket: number;
  ip: string;
  port: number;
}

function loadConnectionTable(stdout: string): Record<string, string>[] {
  const lines = stdout.trim().split("\n");
  const names = lines
    .shift()!
    .trim()
    .split(/\s+/)
    .filter((name) => name !== "rx_queue" && name !== "tm->when");
  const table = lines.map((line) =>
    line
      .trim()
      .split(/\s+/)
      .reduce((obj, value, i) => {
        obj[names[i] || i] = value;
        return obj;
      }, {} as Record<string, string>)
  );
  return table;
}

function parseIpAddress(hex: string): string {
  let result = "";
  if (hex.length === 8) {
    for (let i = hex.length - 2; i >= 0; i -= 2) {
      result += parseInt(hex.substr(i, 2), 16);
      if (i !== 0) {
        result += ".";
      }
    }
  } else {
    for (let i = hex.length - 4; i >= 0; i -= 4) {
      result += parseInt(hex.substr(i, 4), 16).toString(16);
      if (i !== 0) {
        result += ":";
      }
    }
  }
  return result;
}

function getSockets(stdout: string): SocketMap {
  const lines = stdout.trim().split("\n");
  const mapped: { pid: number; socket: number }[] = [];
  lines.forEach((line) => {
    const match = /\/proc\/(\d+)\/fd\/\d+ -> socket:\[(\d+)\]/.exec(line);
    if (match && match.length >= 3) {
      mapped.push({
        pid: parseInt(match[1], 10),
        socket: parseInt(match[2], 10),
      });
    }
  });
  const socketMap = mapped.reduce((m, socket) => {
    m[socket.socket] = socket;
    return m;
  }, {} as SocketMap);
  return socketMap;
}

function loadListeningPorts(...stdouts: string[]): ParsedAddress[] {
  const table = ([] as Record<string, string>[]).concat(
    ...stdouts.map(loadConnectionTable)
  );
  return [
    ...new Map(
      table
        .filter((row) => row.st === "0A")
        .map((row) => {
          const address = row.local_address.split(":");
          return {
            socket: parseInt(row.inode, 10),
            ip: parseIpAddress(address[0]),
            port: parseInt(address[1], 16),
          };
        })
        .map((port) => [port.ip + ":" + port.port, port])
    ).values(),
  ];
}

async function getListeningPortsViaSS(pid: number): Promise<number[]> {
  const descendants = await getAllDescendants(pid);
  const descendantPids = new Set([pid, ...descendants.map(d => d.PID)]);

  return new Promise<number[]>((resolve) => {
    exec('ss -plnt', (err, stdout) => {
      const ports: number[] = [];
      const lines = stdout.split('\n').slice(1);
      for (const line of lines) {
        const match = line.match(/LISTEN\s+\d+\s+\d+\s+\S+:(\d+)\s+.*pid=(\d+)/);
        if (match) {
          const port = parseInt(match[1]);
          const ownerPid = parseInt(match[2]);
          if (descendantPids.has(ownerPid)) {
            ports.push(port);
          }
        }
      }
      resolve(ports);
    });
  });
}

export async function getPortsForPid(pid: number, checkDescendands: boolean = false): Promise<number[]> {
  const procFilePath = `/proc/${pid}/net/tcp`;

  try {
    const data = await new Promise<string>((resolve) => {
      fs.readFile(procFilePath, { encoding: "utf-8" }, (err, data) => {
        resolve(data);
      });
    });
    if (!data) return [];
    const listening = loadListeningPorts(data);

    const sockets = await new Promise<SocketMap>((resolve) => {
      exec(
        `ls -l /proc/${pid}/fd/[0-9]* | grep socket:`,
        (err, stdout, stderr) => {
          resolve(getSockets(stdout));
        }
      );
    });

    const ports: number[] = [];
    for (const l of listening) {
      if (l.socket in sockets) {
        ports.push(l.port);
      }
    }


    if (ports.length === 0 && checkDescendands) {
      const descendants = await getAllDescendants(pid);
      const descendantPorts = await Promise.all(
        descendants.map( async d => {
          return (await getListeningPortsViaSS(d.PID));
        })
      );

      return Array.from(new Set(descendantPorts.flat(2)));
    }


    return ports;
  } catch (error: any) {
    console.error(error);
    return [];
  }
}

interface IListener<T> {
  (e: T): void;
}

export interface IEvent<T> {
  (listener: (e: T) => any): IDisposable;
}

export class EventEmitter2<T> {
  private _listeners: IListener<T>[] = [];
  private _event?: IEvent<T>;

  public get event(): IEvent<T> {
    if (!this._event) {
      this._event = (listener: (e: T) => any) => {
        this._listeners.push(listener);
        const disposable = {
          dispose: () => {
            for (let i = 0; i < this._listeners.length; i++) {
              if (this._listeners[i] === listener) {
                this._listeners.splice(i, 1);
                return;
              }
            }
          },
        };
        return disposable;
      };
    }
    return this._event;
  }

  public fire(data: T): void {
    const queue: IListener<T>[] = [];
    for (let i = 0; i < this._listeners.length; i++) {
      queue.push(this._listeners[i]);
    }
    for (let i = 0; i < queue.length; i++) {
      queue[i].call(undefined, data);
    }
  }
}

function parseColumns(stdout: string, coercion: Record<string, CallableFunction> = {}) {
  const lines = stdout.trim().split('\n')
  const headers = lines.shift()!.trim().split(/\s+/);

  const results: Record<string, any>[] = [];

  for (const line of lines) {
    const columns = line.trim().split(/\s+/);

    const rowData: any = {};

    for (let i = 0; i < headers.length; i++) {
      if (headers[i] in coercion)
        rowData[headers[i]] = coercion[headers[i]](columns[i]);  
      else
        rowData[headers[i]] = columns[i];  
    }

    results.push(rowData);
  }

  return results
}


export async function getChildProcesses(pid: number): Promise<Record<string, any>[]> {
  const rawOutput = await new Promise<string>((resolve) => {
    exec(`ps --ppid=${pid}`,(err,stdout,stderr) => {
      resolve(stdout)
    })
  });
  return parseColumns(rawOutput, {"PID":Number})
}

export async function getAllDescendants(pid: number): Promise<Record<string, any>[]> {
  const descendants: Record<string, any>[] = [];

  async function walk(currentPid: number) {
    const children = await getChildProcesses(currentPid);
    for (const child of children) {
      descendants.push(child);
      await walk(child.PID);
    }
  }

  await walk(pid);
  return descendants;
}