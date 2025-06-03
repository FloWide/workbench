import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '@material/index';
import { FlexLayoutModule } from '@angular/flex-layout';
import { ComponentsModule } from '@components/index';
import { UtilsModule } from '../utils/utils.module';
import {LayoutModule} from '@angular/cdk/layout';
import { LoginComponent } from './login/login.component';
import { RouterModule } from '@angular/router';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';
import { NotFoundComponent } from './not-found/not-found.component';




@NgModule({
  declarations: [LoginComponent,UnauthorizedComponent, NotFoundComponent],
  imports: [
    CommonModule,
    MaterialModule,
    FlexLayoutModule,
    ComponentsModule,
    UtilsModule,
    LayoutModule,
    RouterModule
  ],
  exports:[]
})
export class PagesModule { }
