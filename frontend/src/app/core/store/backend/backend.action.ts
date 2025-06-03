import { createAction, props } from "@ngrx/store";
import {ConnectorModel} from '@core/index';
import { APIModel } from "@core/services";


export namespace BackendActions {

    export const SetConnectors = createAction('[BACKEND] Set Connectors',props<{connectors:ConnectorModel[]}>());

    export const SetBackend = createAction('[BACKEND] Set backend',props<{api:APIModel}>());

    export const SelectDcmConnection = createAction('[BACKEND] Select dcm connection',props<{dcm:ConnectorModel}>());
}