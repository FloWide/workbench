export type PlatformServiceStatus = 'created' | 'running' | 'paused' | 'restarting' | 'exited' | 'removing' | 'dead';
export interface PlatformService {
    id: string;
    name: string;
    started_at?: string;
    status: PlatformServiceStatus;
}