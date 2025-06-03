export interface Auth0ConfigModel {
    domain:string;
    client_id:string;
    audience:string;
}

export interface ConnectorModel {
    location_name: string;
    api_base_url: string;
}

export interface APIModel {
    api:string
    streamlit_apps:string;
}

export interface BackendConfig {
    api:APIModel;
    dcm_connections:ConnectorModel[];
}
