import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './dashboard/dashboard.component';
import { RouterModule, Routes } from '@angular/router';
import { MaterialModule } from '@material/material.module';
import { ComponentsModule } from '@components/components.module';
import { FlexModule } from '@angular/flex-layout';
import { ScriptBoardComponent } from './script-board/script-board.component';
import { ServicesBoardComponent } from './services-board/services-board.component';
import { CreateNewDialogComponent } from './create-new-dialog/create-new-dialog.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ServiceButtonComponent } from './services-board/service-button/service-button.component';
import {CdkAccordionModule} from '@angular/cdk/accordion';
import { MonacoEditorModule } from '../monaco-editor/monaco-editor.module';
import { KeyfilterPipe } from './keyfilter.pipe';
import { ReposBoardComponent } from './repos-board/repos-board.component';
import { RepoButtonComponent } from './repos-board/repo-button/repo-button.component';
import { ReleasesDialogComponent } from './repos-board/releases-dialog/releases-dialog.component';
import { CreateReleaseDialogComponent } from './repos-board/create-release-dialog/create-release-dialog.component';
import { SearchDialogComponent } from './search-dialog/search-dialog.component';
import { RequiresPermissionsDirective } from './requires-permissions.directive';
import { ScriptServiceDetailsComponent } from './script-service-details/script-service-details.component';
import { DefaultBoardComponent } from './default-board/default-board.component';
import { BoardEventsService } from './board-events.service';
import { PlatformServicesComponent } from './services-board/platform-services/platform-services.component';
import { PlatformServiceButtonComponent } from './services-board/platform-service-button/platform-service-button.component';

const routes: Routes = [
  {
    path:'',
    component:DashboardComponent,
    children:[
      {
        path:'',
        component:DefaultBoardComponent
      },
      {
        path:'apps',
        component:ScriptBoardComponent
      },
      {
        path:'services',
        component:ServicesBoardComponent
      },
      {
        path:'repos',
        component:ReposBoardComponent
      }
    ]
  }
]


@NgModule({
  declarations: [
    DashboardComponent,
    ScriptBoardComponent,
    ServicesBoardComponent,
    CreateNewDialogComponent,
    ServiceButtonComponent,
    KeyfilterPipe,
    ReposBoardComponent,
    RepoButtonComponent,
    ReleasesDialogComponent,
    CreateReleaseDialogComponent,
    SearchDialogComponent,
    RequiresPermissionsDirective,
    ScriptServiceDetailsComponent,
    DefaultBoardComponent,
    PlatformServicesComponent,
    PlatformServiceButtonComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    MaterialModule,
    ComponentsModule,
    FlexModule,
    FormsModule,
    ReactiveFormsModule,
    CdkAccordionModule,
    MonacoEditorModule
  ],
  providers:[BoardEventsService]
})
export class DashboardModule { }
