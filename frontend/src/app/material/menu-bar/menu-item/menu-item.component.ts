import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatMenu } from '@angular/material/menu';
import { MenuBarComponent, MenuItem } from '../menu-bar.component';

@Component({
  selector: 'menu-item',
  templateUrl: './menu-item.component.html',
  styleUrls: ['./menu-item.component.scss']
})
export class MenuItemComponent implements OnInit {

  @Input() setting: MenuItem[] = [];
  @ViewChild('childMenu',{static:true}) public childMenu: MatMenu;

  @Input() parentBar: MenuBarComponent;

  constructor() { }

  ngOnInit(): void {
  }

}
