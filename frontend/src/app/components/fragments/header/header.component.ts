import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { AppState, AuthenticationService, BackendActions, ConnectorModel, Select, UserProfile } from '@core/index';
import { Themes, ThemeService } from '@material/theme.service';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit,OnDestroy {

  selectedConnector:ConnectorModel = null;
  connectors:ConnectorModel[] = [];
  user:UserProfile;

  theme: Themes;
  Themes = Themes;

  private destroy$ = new Subject();

  constructor(private store:Store<AppState>,
              private auth:AuthenticationService,
              private themeService: ThemeService) { }
  

  ngOnInit(): void {
    this.store.select(Select.connectors).pipe(
      takeUntil(this.destroy$)
    ).subscribe((connectors) => {
      this.connectors = connectors;
    });

    this.store.select(Select.selectedDcmConnection).pipe(
      takeUntil(this.destroy$)
    ).subscribe((conn) => {
      this.selectedConnector = conn;
    });

    this.store.select(Select.user).pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.user = user;
    });

    this.themeService.themeChange$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((theme) => {
      this.theme = theme;
    })

  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

  setConnector(conn:ConnectorModel) {
    this.store.dispatch(BackendActions.SelectDcmConnection({dcm:conn}));
  }

  onLogOutClick() {
    this.auth.logout();
  }

  themeChange(ev: MatSlideToggleChange) {
    if(ev.checked)
      this.themeService.setTheme(Themes.DARK);
    else
      this.themeService.setTheme(Themes.LIGHT); 
  }

}
