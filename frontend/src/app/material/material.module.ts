import { NgModule } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { CdkTreeModule } from '@angular/cdk/tree';
import { PortalModule } from '@angular/cdk/portal';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatRippleModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBarModule, MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTreeModule } from '@angular/material/tree';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import { MatDialogModule } from '@angular/material/dialog';
import {MatBadgeModule} from '@angular/material/badge';
import {MatGridListModule} from '@angular/material/grid-list';
import { SpinnerDirective } from './spinner.directive';
import { MenuBarComponent } from './menu-bar/menu-bar.component';
import { CommonModule } from '@angular/common';
import { MenuItemComponent } from './menu-bar/menu-item/menu-item.component';
import { KeybindService } from './keybind.service';
import { ToolBarComponent } from './tool-bar/tool-bar.component';
import { ForfilterPipe } from './forfilter.pipe';
import { PickerDialogComponent } from './picker-dialog/picker-dialog.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragoverVisibleDirective } from './dragover-visible.directive';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import { ThemeService } from './theme.service';
import {MatTooltipModule} from '@angular/material/tooltip';
import { MatContextMenuTrigger } from './mat-context-menu.directive';
import { LoaderToastComponent } from './loader-toast.component';
import { ToastService } from './toast.service';

const materialModules = [
  CdkTreeModule,
  MatAutocompleteModule,
  MatButtonModule,
  MatBadgeModule,
  MatCardModule,
  MatCheckboxModule,
  MatChipsModule,
  MatDividerModule,
  MatExpansionModule,
  MatGridListModule,
  MatIconModule,
  MatInputModule,
  MatListModule,
  MatMenuModule,
  MatProgressSpinnerModule,
  MatPaginatorModule,
  MatRippleModule,
  MatSelectModule,
  MatSidenavModule,
  MatSnackBarModule,
  MatSortModule,
  MatTableModule,
  MatTabsModule,
  MatToolbarModule,
  MatFormFieldModule,
  MatButtonToggleModule,
  MatTreeModule,
  OverlayModule,
  PortalModule,
  MatProgressBarModule,
  MatDialogModule,
  FormsModule,
  ReactiveFormsModule,
  MatSlideToggleModule,
  MatTooltipModule
];

@NgModule({
  imports: [
    ...materialModules,
    CommonModule
  ],
  exports: [
    ...materialModules,
    SpinnerDirective,
    MenuBarComponent,
    ToolBarComponent,
    PickerDialogComponent,
    DragoverVisibleDirective,
    MatContextMenuTrigger,
    LoaderToastComponent
  ],
  declarations: [
    SpinnerDirective,
    MenuBarComponent,
    MenuItemComponent,
    ToolBarComponent,
    ForfilterPipe,
    PickerDialogComponent,
    DragoverVisibleDirective,
    MatContextMenuTrigger,
    LoaderToastComponent
],
  providers:[
    ThemeService,
    ToastService,
    {provide: MAT_SNACK_BAR_DEFAULT_OPTIONS, useValue: {verticalPosition:'top',duration:2500,panelClass:['snackbar']}}
  ]
})
export class MaterialModule {
}