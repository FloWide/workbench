import { Component, ElementRef, EventEmitter, HostListener, OnDestroy, OnInit, Output, ViewChild, ViewContainerRef } from '@angular/core';
import { ThemeService, Themes } from '@material/theme.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Terminal, ITheme } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import {CanvasAddon} from 'xterm-addon-canvas';

const LIGHT: ITheme & {selectionBackground: string} = {
  foreground: '#232322',
  background: '#eaeaea',
  cursor: '#16afca',
  selectionBackground:'#08080810',

  black: '#212121',
  brightBlack: '#424242',

  red: '#b7141f',
  brightRed: '#e83b3f',

  green: '#457b24',
  brightGreen: '#7aba3a',

  yellow: '#f6981e',
  brightYellow: '#ffea2e',

  blue: '#134eb2',
  brightBlue: '#54a4f3',

  magenta: '#560088',
  brightMagenta: '#aa4dbc',

  cyan: '#0e717c',
  brightCyan: '#26bbd1',

  white: '#efefef',
  brightWhite: '#d9d9d9'
};

const DARK: ITheme = {
  foreground: '#e5e5e5',
  background: '#232322',
  cursor: '#16afca',

  black: '#212121',
  brightBlack: '#424242',

  red: '#b7141f',
  brightRed: '#e83b3f',

  green: '#457b24',
  brightGreen: '#7aba3a',

  yellow: '#f6981e',
  brightYellow: '#ffea2e',

  blue: '#134eb2',
  brightBlue: '#54a4f3',

  magenta: '#560088',
  brightMagenta: '#aa4dbc',

  cyan: '#0e717c',
  brightCyan: '#26bbd1',

  white: '#efefef',
  brightWhite: '#d9d9d9'
};

@Component({
  selector: 'base-term',
  template:``,
  styles:[
    `
      :host {
        width:100%;
        height:98%;
        box-sizing:border-box;
        display:block;
      }
    `
  ]
})
export class BaseTermComponent implements OnInit,OnDestroy {


  @Output() ready = new EventEmitter<Terminal>();

  private terminal: Terminal = null;

  private fitAddon: FitAddon = null;

  private destroy$ = new Subject();

  constructor(
    private elementRef: ElementRef,
    private themeService: ThemeService
  ) { }
  

  ngOnInit(): void {
    this.terminal = new Terminal();
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(new CanvasAddon());
    this.terminal.open(this.elementRef.nativeElement);
    this.fitAddon.fit();
    this.ready.emit(this.terminal);
    this.themeService.themeChange$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((theme) => {
      if (theme === Themes.DARK) {
        this.terminal.options.theme = DARK;
      } else {
        this.terminal.options.theme = LIGHT;
      }
    })
    this.terminal.onKey((e) => {
      if (e.domEvent.key.toLowerCase() === 'escape') {
        this.terminal.blur();
      }
    })
  }

  ngOnDestroy(): void {
    this.fitAddon.dispose();
    this.terminal.dispose();
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  @HostListener('resize')
  onResize() {
    this.fitAddon.fit();

  }

  @HostListener('contextmenu')
  async onRightClick() {
    if (this.terminal.hasSelection()) {
      await navigator.clipboard.writeText(this.terminal.getSelection())
      this.terminal.select(0, 0, 0);
    } else {
      this.terminal.write(await navigator.clipboard.readText());
    }
  }

  get fit() {
    return this.fitAddon
  }

}
