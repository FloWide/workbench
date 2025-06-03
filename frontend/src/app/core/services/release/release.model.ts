import {UserModel} from '../user/user.model'

export interface Release {
    id: number;
    created_at: string;
    git_tag: string;
    repo_id: number;
    name: string;
    owner_id: string;
    owner:UserModel
}

export interface CreateReleaseModel {
    name: string;
    git_tag: string;
    repo_id: number;
    target_refish: string;
}