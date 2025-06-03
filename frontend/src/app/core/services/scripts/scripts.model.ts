import { Release } from "../release/release.model";
import { AppConfig } from "../repo/repo.model";
import { UserModel } from "../user/user.model";

export interface ScriptModel {
    owner_id: string;
    owner: UserModel;

    created_at: string;
    id: number;
    name: string;
    ready: boolean;

    release_id: number;
    release: Release;

    app_config: AppConfig;
}

export type Scripts = ScriptModel[];

export function isScriptModel(obj: any): obj is ScriptModel {
    if (obj === null || obj === undefined) return false;

    if (Array.isArray(obj)) return false;

    return 'type' in obj && (obj.type === 'python' || obj.type === 'streamlit')
}