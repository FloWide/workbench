import { Release } from "../release/release.model";
import { AppConfig } from "../repo/repo.model";
import { UserModel } from "../user/user.model";

export type PythonServiceState = 'ACTIVE' | 'INACTIVE'


export interface PythonServiceModel {
   owner_id: string;
   owner: UserModel;

   created_at: string;
   id: number;
   name: string;
   ready: boolean;
   enabled: boolean;
   started_at: string;
   status: PythonServiceState
   proxied_url?: string;

   release_id: number;
   release: Release;

   service_config: AppConfig;
}

export type PythonServices = PythonServiceModel[];