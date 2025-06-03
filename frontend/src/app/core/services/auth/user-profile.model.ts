
import type {KeycloakProfile} from 'keycloak-js'

export interface UserProfile extends KeycloakProfile {
    roles:string[];
}