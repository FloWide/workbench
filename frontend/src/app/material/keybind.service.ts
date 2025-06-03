import { Injectable, Renderer2 } from '@angular/core';
import { Logger } from '../utils/logger';


class KeyBind {

  public canFire: boolean = true;

  constructor(
    public cmd: string,
    public checkFunction: Function,
    public callback: Function
  ) {}
}


@Injectable()
export class KeybindService {

  private keyBinds = new Map<string,KeyBind>();

  constructor() {
    window.addEventListener('keydown',this.onKeyDown.bind(this));
    window.addEventListener('keyup',this.onKeyUp.bind(this));
  }

  bind(command: string,callback: Function) {
    let keys = command.split('+')
    keys = keys.map((k) => k.trim());
    keys = keys.map((k) => k.toLowerCase());
    const key = keys.filter((k) => k !== 'ctrl' && k !== 'alt' && k !== 'meta' && k !== 'shift')[0];
    const ctrl = keys.some(key => key === 'ctrl')
    const meta = keys.some(key => key === 'meta')
    const shift = keys.some(key => key === 'shift')
    const alt = keys.some(key => key === 'alt')
    
    const keyBind = new KeyBind(
      command,
      (e: KeyboardEvent) => e.ctrlKey === ctrl &&
        e.metaKey === meta &&
        e.shiftKey === shift &&
        e.altKey === alt &&
        e.key.toLowerCase() === key.toLowerCase(),
      callback
    );
    this.keyBinds.set(command,keyBind);
  }

  unbind(command: string) {
    this.keyBinds.delete(command);
  }

  private onKeyDown(e: KeyboardEvent) {
    Logger.logMessage('KeyDown',e);
    this.keyBinds.forEach((value) => {
      if(value.checkFunction(e) && value.canFire){
        e.preventDefault();
        e.stopPropagation();
        value.canFire = false;
        value.callback();
      }
    });
  }

  private onKeyUp(e: KeyboardEvent) {
    Logger.logMessage('KeyUp',e);
    this.keyBinds.forEach((value) => {
      if(value.checkFunction(e)){
        value.canFire = true;
      }
    });
  }
}
