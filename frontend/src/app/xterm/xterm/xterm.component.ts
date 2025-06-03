import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {Terminal} from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { fromEvent, Observable, of, Subject, Subscription } from 'rxjs';
import {webSocket,WebSocketSubject} from 'rxjs/webSocket';
import { delay, retry, takeUntil, timeout } from 'rxjs/operators';
import { Logger } from 'src/app/utils/logger';

@Component({
  selector: 'xterm',
  templateUrl: './xterm.component.html',
  styleUrls: ['./xterm.component.scss']
})
export class XtermComponent implements OnDestroy {

  @ViewChild('terminal',{static:true}) container: ElementRef<HTMLDivElement>;


  @Input() websocketConnection: string;
  reconnect: boolean = true;


  private destroy$ = new Subject();

  private terminal: Terminal = null;

  private websocketSubject$: WebSocketSubject<ArrayBuffer | string> = null;

  private websocketSubscription: Subscription = null;

  private reconnectTimeout : any = null;

  constructor() { }
  
  onReady(terminal: Terminal) {
    this.terminal = terminal;
    this.connectToWebsocket();

    this.terminal.onBinary((binaryData) => {
      const buffer = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; ++i) {
        buffer[i] = binaryData.charCodeAt(i) & 255;
      }
      this.websocketSubject$.next(buffer);
    });
    this.terminal.onData((textData) =>{
      this.websocketSubject$.next(textData);
    })
  }

  ngOnDestroy(): void {
    Logger.logMessage("xterm destroyed")
    this.reconnect = false;
    this.destroy$.next(null);
    this.destroy$.complete();
    this.websocketSubject$.complete();
    this.websocketSubscription.unsubscribe();
  }

  private connectToWebsocket() {
    Logger.logMessage("xterm connecting to websocket");
    if(this.websocketSubject$ && this.websocketSubscription) {
      this.websocketSubject$.complete();
      this.websocketSubscription.unsubscribe();
    }

    this.websocketSubject$ = webSocket({
      url:this.websocketConnection,
      serializer:(data) => data,
      deserializer:(e) => e.data,
      binaryType:'arraybuffer',
      closeObserver:{next:this.onWebsocketClose.bind(this)}
    });
    this.websocketSubscription = this.websocketSubject$.pipe(
      takeUntil(this.destroy$),
    ).subscribe((data) => {
      Logger.logMessage("Received terminal ws data",data);
      this.terminal.write(typeof data === 'string' ? data : new Uint8Array(data))
    });
  }

  private onWebsocketClose(ev: CloseEvent) {
    if (this.reconnectTimeout)
      clearTimeout(this.reconnectTimeout)
    this.reconnectTimeout = setTimeout(() => {
      if (this.reconnect )
        this.connectToWebsocket();
    }, 1500);
  }

}
