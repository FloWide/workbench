#!/usr/bin/env node
import express from "express";
import expressWs from "express-ws";
import * as ws from 'ws'
import { json } from "body-parser";
import Process from "./process";
import path from 'path';
import {lookup} from 'mime-types';
import {ChildProcess, spawn} from 'child_process';
import { chdir, kill } from "process";

declare global {
  namespace Express {
    interface Request {
      proc: Process;
    }
  }
}

const app = express();
const port = 3000;
const { app: wsApp, getWss } = expressWs(app);

const processes: Map<number, Process> = new Map();

const notificationWs: Set<ws> = new Set();


app.use(json());

app.get("/", (req, res) => {
  res.send(Object.fromEntries(processes.entries()));
});

wsApp.ws('/notifications', (ws, req) => {
  notificationWs.add(ws);
  ws.on('close',() => {
    notificationWs.delete(ws);
  })
})

let lspChildProcess: ChildProcess | null = null;

function killLsp() {
  if (lspChildProcess) {
    lspChildProcess.kill('SIGKILL')
  }
}

app.post('/startLsp', (req, res) => {
  const lspArgs: Record<string, string> = req.body
  killLsp()
    
  let commandArgs = Object.entries(lspArgs).map(([name, cmd]) => ['--', `${name}=run ${cmd}`]).flat()
  lspChildProcess = spawn('lsp-ws-proxy',['--listen', '63070', ...commandArgs],{shell:true})
  lspChildProcess.stdout?.on('data', (data) => console.log(String(data)));
  lspChildProcess.stderr?.on('data', (data) => console.log(String(data)));
  lspChildProcess.on('exit',(code) => {
    lspChildProcess = null;
  })
  res.status(200).send({port:63070, lsps:Object.keys(lspArgs)})
})

app.post('/openRequest', (req, res) => {
  const body = req.body
  console.log('Open request', body)
  const data = {
    type:'OPEN_FILE_REQUEST',
    pid: null,
    data: {
      name: path.basename(body.path),
      path: path.relative(process.cwd(), body.fullPath),
      isDirectory: false,
      absolutePath: body.fullPath,
      mimeType: lookup(body.fullPath)
    }
  }
  notificationWs.forEach((ws) => {
    ws.send(JSON.stringify(data))
  })
  res.status(200).send()
})

app.use("/:id", (req, res, next) => {
  const id = parseInt(req.params.id);
  const proc = processes.get(id);
  if (!proc) {
    res.status(404).send({ error: `Not found ${id}` });
    return;
  }

  req.proc = proc;
  next();
});
app.post("/", (req, res) => {
  const body = req.body;
  if (body === undefined || body === null) {
    res.send(400).send({"detail":"Invalid request"})
    return
  }
  console.log(body);
  const new_proc = Process.spawn(body)
  new_proc.pause();
  const notifyListener = new_proc.onNotify((e) => {
    notificationWs.forEach((ws) => ws.send(JSON.stringify(e)))
  })
  const listener = new_proc.onExit(() => {
    new_proc.dispose();
    listener.dispose();
    notifyListener.dispose();
    processes.delete(new_proc.pid);
  });
  

  processes.set(new_proc.pid, new_proc);
  res.status(201).send(new_proc);
});
app.post("/:id/resize", (req, res) => {
  const body = req.body;
  req.proc.resize(body.cols, body.rows);
  res.status(200).send();
});
app.post("/:id/kill", (req, res) => {
  const listener = req.proc.onExit((data) => {
    res.status(200).send(data);
    listener.dispose();
  })
  req.proc.kill(String(req.query.signal || 'SIGTERM'));
});
app.post("/:id/pause", (req, res) => {
  req.proc.pause();
  res.status(200).send();
});
app.post("/:id/resume", (req, res) => {
  req.proc.resume();
  res.status(200).send();
});
app.post("/:id/clear", (req, res) => {
  req.proc.clear();
  res.status(200).send();
});
app.get("/:id/wait", (req, res) => {
  req.proc.wait(req.query.timeout as any).then((result) => {
    res.status(200).send(result)
  })
});



wsApp.ws("/:id/attach", (ws, req) => {
  const ptyProcess = req.proc;
  ptyProcess!.resume();
  ws.on("message", (message) => {
    ptyProcess!.write(message.toString());
  });
  const dataListener = ptyProcess!.onData((e) => {
    ws.send(e);
  });
  const exitListener = ptyProcess!.onExit((e) => {
    ws.close();
    dataListener.dispose();
    exitListener.dispose();
  });
});

const server = app.listen(port, () => {
  process.env["PWD"] = process.cwd();
  console.log(`Workdir: ${process.cwd()}`)
  console.log(`Server running at http://localhost:${port}`);
});

['SIGINT', 'SIGTERM', 'SIGQUIT']
  .forEach(signal => process.on(signal, () => {
    server.close()
    killLsp()
    process.exit();
  }));