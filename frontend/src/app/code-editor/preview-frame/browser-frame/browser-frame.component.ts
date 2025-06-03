import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-browser-frame',
  templateUrl: './browser-frame.component.html',
  styleUrls: ['./browser-frame.component.scss']
})
export class BrowserFrameComponent implements OnInit {

  @Input() state:string;
  @Output() refreshClick = new EventEmitter<void>();
  @Output() popout = new EventEmitter<void>();

  constructor() { }

  ngOnInit(): void {
  }

}
