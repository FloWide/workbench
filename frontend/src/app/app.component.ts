import { Component} from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <ngx-loading-bar [includeSpinner]="false" [color]='"#e3790b"'></ngx-loading-bar>
    <router-outlet></router-outlet>
  `,
  styles:[]
})
export class AppComponent{
  title = 'flowide-ui';

  constructor() {}

}
