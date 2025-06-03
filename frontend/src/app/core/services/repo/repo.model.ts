import { UserModel } from "../user/user.model";


export interface MetaData {
    imported_from?: string;
}

export interface LanguageService {
    cmd: string;
    languages: string[];
}

export interface Development {
    ignore?: string[];
    languageService: Record<string, string | LanguageService>
}

export interface AppConfig {
    run: string;
    app_icon?: string;
    env?: Record<string, string>
    cli_args?: any[]
    port?: number
    proxy: boolean
}

export interface BuildConfig {
    cmd: string;
    watch?: boolean;
    file_patterns?: string;
    run_before_apps?: boolean;
}

export interface SetupConfig {
    packages?: string[];
    setup_script?: string;
}

export interface WorkBenchConfig {
    apps?: Record<string, AppConfig>;
    services?: Record<string, AppConfig>;
    metadata?: MetaData;
    development?: Development;
    build?: BuildConfig;
    setup?: SetupConfig;
    networks: string[];
}

export interface RepositoryModel {
    id: number;
    owner_id: string;
    created_at: string;
    name: string;
    ready: boolean;

    owner: UserModel;
}

export type Repositories = RepositoryModel[];

export interface RepositoryCreationModel {
    name: string;
    template?: 'streamlit' | 'python' | 'service';
}

export interface RepositoryFileEntry {
    name: string;
    path: string;
    absolutePath: string;
    isDirectory: boolean;
    mimeType?: string;
}

export enum GitAnalyzeResults {
    UP_TO_DATE = 'Up to date',
    FAST_FORWARD = 'Fast Forward',
    MERGE_REQUIRED = 'Merge Required',
    MERGE_CONFLICT = 'Merge Conflict',
    MERGE_CONFLICT_LOCAL_HARD_RESET = "Merge conflict local hard reset",
    MERGE_CONFLICT_REMOTE_HARD_RESET = "Merge conflict remote hard reset",
    AUTO_MERGE = 'Auto merge',
    NO_ACTION = 'No action',
}

export interface GitCommitModel {
    message: string;
}

export interface GitStatus {
    [k:string]: number;
}

export interface GitState {
    head:string;
    tags: string[];
    branches: string[];
    status:GitStatus;
}

export enum GitStatusFlags {
    GIT_STATUS_CURRENT = 0,
    GIT_STATUS_INDEX_NEW = 1,
    GIT_STATUS_INDEX_MODIFIED = 2,
    GIT_STATUS_INDEX_DELETED = 4,
    GIT_STATUS_INDEX_RENAMED = 8,
    GIT_STATUS_INDEX_TYPECHANGE = 16,
    GIT_STATUS_WT_NEW = 128,
    GIT_STATUS_WT_MODIFIED = 256,
    GIT_STATUS_WT_DELETED = 512,
    GIT_STATUS_WT_TYPECHANGE = 1024,
    GIT_STATUS_WT_RENAMED = 2048,
    GIT_STATUS_WT_UNREADABLE = 4096,
    GIT_STATUS_IGNORED = 16384,
    GIT_STATUS_CONFLICTED = 32768
}


export interface ChildProcess {
    pid: number;
    ppid: number;
    name: string;
    ports: number[];
}

export interface Process{
    pid: number;
    name: string;
    cmd: string;
    args: string[];
    ports: number[];
    children: Record<number, ChildProcess>;
}

export interface BaseNotification {
    pid: number;
    type: string;
    data: any
}

export interface ProcessStartedNotification extends BaseNotification{
    type: 'PROCESS_STARTED';
    data: Process;
}
export interface ProcessExitedNotification extends BaseNotification {
    type: 'PROCESS_EXITED';
    data: {exitCode: number, signal: number};
}

export interface ProcessPortsChangedNotification extends BaseNotification {
    type: 'PORTS_CHANGED';
    data: number[];
}

export interface ChildProcessStartedNotification extends BaseNotification {
    type: 'CHILD_PROCESS_STARTED';
    data: ChildProcess;
}

export interface ChildProcessExitedNotification extends BaseNotification {
    type: 'CHILD_PROCESS_EXITED';
    data: ChildProcess;
}

export type Notification = ProcessStartedNotification | ProcessExitedNotification | ProcessPortsChangedNotification | ChildProcessStartedNotification | ChildProcessExitedNotification


export interface FileChange {
    change: 'added' | 'modified' | 'deleted';
    path: string;
    name: string;
    isDirectory: boolean;
}


export function isRepositoryModel(obj: any): obj is RepositoryModel {
    if (obj === null || obj === undefined) return false

    if (Array.isArray(obj)) return false

    return 'git_service_id' in obj && 'http_url' in obj && 'name' in obj;
}