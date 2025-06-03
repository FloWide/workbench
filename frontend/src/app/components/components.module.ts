import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '@material/material.module';
import { StreamlitScriptButtonComponent } from './streamlit-script-button/streamlit-script-button.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { InputDialogComponent } from './dialogs/input-dialog/input-dialog.component';
import { FlexLayoutModule } from '@angular/flex-layout';
import { HeaderComponent } from './fragments/header/header.component';
import { FooterComponent } from './fragments/footer/footer.component';
import { AvatarModule } from 'ngx-avatar-ng13';
import { RouterModule } from '@angular/router';
import { ConfirmDialogComponent } from './dialogs/confirm-dialog/confirm-dialog.component';
import { MaxLengthStringPipe } from './max-length-string.pipe';



@NgModule({
  declarations: [StreamlitScriptButtonComponent, InputDialogComponent,HeaderComponent,FooterComponent, ConfirmDialogComponent, MaxLengthStringPipe],
  imports: [
    CommonModule,
    MaterialModule,
    FormsModule,
    ReactiveFormsModule,
    FlexLayoutModule,
    AvatarModule,
    RouterModule
  ],
  exports:[StreamlitScriptButtonComponent,HeaderComponent,FooterComponent,ConfirmDialogComponent]
})
export class ComponentsModule { }
