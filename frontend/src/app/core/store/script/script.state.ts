import { Scripts } from "@core/services";
import { Action, createReducer, on } from "@ngrx/store";
import { ScriptActions } from "./script.action";


export interface ScriptState {
    scripts: Scripts
}

const initalState: ScriptState = {
    scripts:[]
}



const reducer = createReducer(
    initalState,
    on(ScriptActions.GetScriptsSuccess,(state,{scripts}) => {
        return {
            ...state,
            scripts:scripts
        }
    }),
    on(
        ScriptActions.GetScriptSuccess,
        ScriptActions.StopScriptSuccess,
        ScriptActions.KillScriptSuccess,
        ScriptActions.RunScriptSuccess,
        (state,{script}) => {
            const newScripts = [...state.scripts]
            const idx = newScripts.findIndex((value) => value.id === script.id)
            if (idx !== -1) {
                newScripts[idx] = script
            } else {
                newScripts.push(script)
            }
            return {
                ...state,
                scripts:newScripts
            }
        }
    )
)

export function scriptReducer(state: ScriptState,action: Action) {
    return reducer(state,action);
}