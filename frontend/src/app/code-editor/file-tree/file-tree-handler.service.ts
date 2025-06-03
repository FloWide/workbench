import { GoldenLayoutComponentService } from "src/app/golden-layout";
import { ToggleableComponentHandlerService } from "../component-handler.service";
import { FileTreeComponent } from "./file-tree.component";
import { Injectable } from "@angular/core";



@Injectable()
export class FileTreeHandlerService extends ToggleableComponentHandlerService<FileTreeComponent> {
    
    constructor(
        glComponents: GoldenLayoutComponentService
    ) {
        super(glComponents, FileTreeComponent, 'file-tree')
    }

    protected getId(component: {} | FileTreeComponent) {
        return 'file-tree'
    }

}