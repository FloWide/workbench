import { ScriptModel, Scripts } from "@core/services";
import { AppConfig } from "@core/services/repo/repo.model";
import { createAction, props } from "@ngrx/store";



export namespace ScriptActions {


    export const GetScripts = createAction('[SCRIPT] Get Scripts');
    export const GetScriptsSuccess = createAction('[SCRIPT] Get Scripts Success',props<{scripts:Scripts}>());
    export const GetScriptsError = createAction('[SCRIPT] Get Scripts Error',props<{message:string}>());

    export const GetScript = createAction('[SCRIPT] Get Script',props<{id: number}>());
    export const GetScriptSuccess = createAction('[SCRIPT] Get Script Success',props<{script:ScriptModel}>());
    export const GetScriptError = createAction('[SCRIPT] Get Script Error',props<{message:string}>());


    export const StopScript = createAction('[SCRIPT] Stop Script',props<{id: number}>());
    export const StopScriptSuccess = createAction('[SCRIPT] Stop Script Success',props<{script:ScriptModel}>());
    export const StopScriptError = createAction('[SCRIPT] Stop Script Error',props<{message:string}>());

    export const KillScript = createAction('[SCRIPT] Kill Script',props<{id: number}>());
    export const KillScriptSuccess = createAction('[SCRIPT] Kill Script Success',props<{script:ScriptModel}>());
    export const KillScriptError = createAction('[SCRIPT] Kill Script Error',props<{message:string}>());

    export const RunScript = createAction('[SCRIPT] Run Script',props<{id: number,overrides?:Partial<AppConfig>}>());
    export const RunScriptSuccess = createAction('[SCRIPT] Run Script Success',props<{script:ScriptModel}>());
    export const RunScriptError = createAction('[SCRIPT] Run Script Error',props<{message:string}>());
}