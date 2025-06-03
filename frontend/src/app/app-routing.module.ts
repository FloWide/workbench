import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthenticationGuard, RoleGuard } from './core';
import { LoginComponent } from './pages/login/login.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';
import { UnauthorizedComponent } from './pages/unauthorized/unauthorized.component';

const routes: Routes = [
  {
    path:'',
    loadChildren: () => import('./dashboard/dashboard.module').then((m) => m.DashboardModule),
    canActivate:[AuthenticationGuard]
  },
  {
    path:'login',
    component:LoginComponent
  },
  {
    path:'script/:id',
    canActivate:[AuthenticationGuard],
    data:{
      roles:['run:script']
    },
    loadChildren:() => import('./script-runner/script-runner.module').then(m => m.ScriptRunnerModule)
  },
  {
    path:'edit/:id',
    canActivate:[AuthenticationGuard],
    data:{
      roles:['edit:repo']
    },
    loadChildren:() => import('./code-editor/editor.module').then(m => m.EditorModule)
  },
  {
    path:'kiosk',
    loadChildren:() => import('./kiosk-mode/kiosk-mode.module').then(m => m.KioskModeModule)
  },
  {
    path:'unauthorized',
    component:UnauthorizedComponent
  },
  {
    path:'404',
    component:NotFoundComponent
  },
  {
    path:'**',
    redirectTo:'404'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes,{onSameUrlNavigation:'reload'})],
  exports: [RouterModule]
})
export class AppRoutingModule { }
