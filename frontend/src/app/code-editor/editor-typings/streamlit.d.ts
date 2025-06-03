

export as namespace Streamlit;

export const API_VERSION = 1;
export const RENDER_EVENT = "streamlit:render";
/** Dispatches events received from Streamlit. */
/**
 * Tell Streamlit that the component is ready to start receiving data.
 * Streamlit will defer emitting RENDER events until it receives the
 * COMPONENT_READY message.
 */
export function setComponentReady():void;
/**
 * Report the component's height to Streamlit.
 * This should be called every time the component changes its DOM - that is,
 * when it's first loaded, and any time it updates.
 */
export function setFrameHeight(height?: number | undefined):void;
/**
 * Set the component's value. This value will be returned to the Python
 * script, and the script will be re-run.
 *
 * For example:
 *
 * JavaScript:
 * Streamlit.setComponentValue("ahoy!")
 *
 * Python:
 * value = st.my_component(...)
 * st.write(value) # -> "ahoy!"
 *
 * The value must be an ArrowTable, a typed array, an ArrayBuffer, or be
 * serializable to JSON.
 */
export function setComponentValue(value: any):void;
 