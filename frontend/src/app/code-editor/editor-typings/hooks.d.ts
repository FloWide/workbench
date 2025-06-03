

export as namespace Hooks;

export interface JsonPatch {
    op:string;
    path:string;
    value:any;
    times:{
        dcmTime:number;
        measurement:number;
        sensorsetbuffer:number;
    }
}

export type Args = Record<string,any>

export interface UpdateMapHook {
    setup(map:L.Map,livemap: L.Playback.LivePlay,args: Args): Promise<void>;

    message(patch:Hooks.JsonPatch):void;

    onRerun?(args?: Args): void;
}



export interface CustomMap {

    setupMap(container: HTMLDivElement,args?: Args): Promise<L.Map>;

    setupComponent(args?: Args): Promise<boolean>;

    onRerun(args?: Args): void;
}



export interface FloWideMap {

    
    /**
     * 
     * Setup function is called after the maps has been created.
     *
     * @param {L.Map} masterMap Map used for control. Placed on the top of the stack. Use it for events.
     * @param {L.Map} overLayMap Map used for overlays such as tilelayers. Placed on the bottom of the stack. 
     * @param {Record<string,L.Map>} maps Other maps in the stack with their custom CRS
     * @param {Args} args Arguments passed from the python script to the frontend
     * @memberof FloWideMap
     */
    setup(
        masterMap: L.Map,
        overLayMap: L.Map,
        maps: Map<string,L.Map>,
        args: Args
    ): void;

    /**
     *  Called everytime the script is rerun.
     *
     * @param {Args} args
     * @memberof FloWideMap
     */
    onRerun(args: Args): void;

}

export function switchFromMapCoords(fromMap: L.Map,toMap: L.Map,latlng: L.LatLng): L.LatLng;