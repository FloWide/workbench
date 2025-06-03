import { GoldenLayoutComponentService } from "src/app/golden-layout";
import { ToggleableComponentHandlerService } from "../component-handler.service";
import { ProcessTreeComponent } from "./process-tree.component";
import { Injectable } from "@angular/core";



@Injectable()
export class ProcessTreeHandlerService extends ToggleableComponentHandlerService<ProcessTreeComponent> {

    constructor(glComponents: GoldenLayoutComponentService) {
        super(glComponents, ProcessTreeComponent, 'process-tree');
    }


    protected getId(component: {} | ProcessTreeComponent) {
        return 'process-tree'
    }

}