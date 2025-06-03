import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { KeybindService } from '@material/keybind.service';



export interface MenuButton {
  title:string;
  id?:string;
  keybind?:string;
  dontBind?:boolean;
}

export interface SubMenuButton {
  title:string;
  children?: MenuItem[];
}

export interface ToggleMenuButton extends MenuButton {
  checkbox:true;
  checked:boolean;
}

export interface Divider {
  divider:true
}

export type MenuItem = MenuButton | SubMenuButton | ToggleMenuButton | Divider;

export interface TopLevelMenuItem {
  title:string;
  children: MenuItem[];
}


@Component({
  selector: 'menu-bar',
  templateUrl: './menu-bar.component.html',
  styleUrls: ['./menu-bar.component.scss']
})
export class MenuBarComponent implements OnInit {

  @Input() setting: TopLevelMenuItem[] = [];

  @Output() menuItemClicked = new EventEmitter<MenuItem>();
  
  menuBar = this;

  constructor(private keybindService: KeybindService) { }

  ngOnInit(): void {
    this.setting.forEach((menu) => this.setupKeyBinds(menu.children));
  }

  onMenuClicked(el: MenuItem) {
    if(isCheckbox(el)) {
      el.checked = !el.checked;
    }
    this.menuItemClicked.emit(el);
  }

  setChecked(id:string,checked: boolean) {
    this.setting.forEach((toplevel) => {
      const e = this.findMenuItem(id,toplevel.children);
      if(isCheckbox(e)) {
        e.checked = checked;
      }
    })
  }


  private findMenuItem(id: string,items: MenuItem[]) : MenuItem {
    const el = items.find((item) => {
      return 'id' in item && item.id === id;
    });
    if(el) return el;
    for (let i = 0; i < items.length; i++) {
      const element = items[i];
      if('children' in element)
        return this.findMenuItem(id,element.children); 
    }
    return null;
  }

  private setupKeyBinds(items: MenuItem[]) {
    items.forEach((item) => {
      if('children' in item && item.children) {
        this.setupKeyBinds(item.children);
      }
      if('keybind' in item && item.keybind && !item.dontBind) {
        this.keybindService.bind(item.keybind,() => this.onMenuClicked(item));
      }
    })
  }
}

function isCheckbox(el: MenuItem): el is ToggleMenuButton {
  return el && 'checkbox' in el && el.checkbox;
}