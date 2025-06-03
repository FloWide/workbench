import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {CoreModule, FlexLayoutModule} from '@angular/flex-layout';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { environment } from '../environments/environment';
import { EffectsModule } from '@ngrx/effects';
import { appReducers, APP_EFFECTS } from '@core/store';
import { RuntimeConfigService } from '@core/services/runtime-config';
import { APP_BASE_HREF, PlatformLocation } from '@angular/common';
import { ComponentsModule } from './components';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { PagesModule } from './pages/pages.module';
import { LoadingBarModule} from '@ngx-loading-bar/core';
import { LoadingBarRouterModule } from '@ngx-loading-bar/router';
import { LoadingBarHttpClientModule } from '@ngx-loading-bar/http-client';
import { MaterialModule } from '@material/material.module';
import {KeycloakService,KeycloakAngularModule} from 'keycloak-angular';
import { AuthTokenInterceptor } from '@core/services/auth/auth.interceptor';


const configFactory =  (configService:RuntimeConfigService,keycloakService: KeycloakService,s: PlatformLocation) => {
  return async () => {
    await configService.loadConfig()
    await keycloakService.init({
      enableBearerInterceptor:false,
      config:configService.authConfig,
      initOptions:{
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri:
          `${window.location.origin}${s.getBaseHrefFromDOM()}/assets/silent-check-sso.html`
      }
    });
    return true
  };
}

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FlexLayoutModule,
    StoreModule.forRoot(appReducers,{
      runtimeChecks:{
        strictStateImmutability:false,
        strictActionImmutability:false
      }
    }),
    StoreDevtoolsModule.instrument({ maxAge: 25, logOnly: environment.production }),
    EffectsModule.forRoot(APP_EFFECTS),
    CoreModule,
    HttpClientModule,
    ComponentsModule,
    PagesModule,
    MaterialModule,
    LoadingBarModule,
    LoadingBarRouterModule,
    LoadingBarHttpClientModule,
    KeycloakAngularModule
  ],
  providers: [
    {
      provide:APP_INITIALIZER,
      useFactory:configFactory,
      deps:[RuntimeConfigService,KeycloakService,PlatformLocation],
      multi:true
    },
    {
      provide:APP_BASE_HREF,
      useFactory:(s:PlatformLocation) => s.getBaseHrefFromDOM(),
      deps:[PlatformLocation]
    },
    {
      provide:HTTP_INTERCEPTORS,
      useClass:AuthTokenInterceptor,
      multi:true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
