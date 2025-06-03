import { ComponentType } from "@angular/cdk/portal";
import { HttpEvent, HttpEventType, HttpResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { MatDialog, MatDialogConfig, MatDialogRef } from "@angular/material/dialog";
import { ConfirmDialogComponent, ConfirmDialogData } from "@components/dialogs/confirm-dialog/confirm-dialog.component";
import { InputDialogComponent, InputDialogData } from "@components/dialogs/input-dialog/input-dialog.component";
import { RepositoryEditService } from "@core/services/repo/repo-edit.service";
import { RepositoryService } from "@core/services/repo/repo.service";
import { AppState, Select } from "@core/store";
import { CodeEditorActions } from "@core/store/code-editor/code-edior.action";
import { LoaderToastComponent, LoaderToastData } from "@material/loader-toast.component";
import { ToastService } from "@material/toast.service";
import { Store } from "@ngrx/store";
import { basename } from "path-browserify";
import {catchError, filter, firstValueFrom, map, Observable, Subject, takeUntil, tap} from 'rxjs';


@Injectable()
export class CommonEditorService {
    private activeDialog: MatDialogRef<unknown> | null = null;

    constructor(
        private matDialog: MatDialog,
        private store: Store<AppState>,
        private editService: RepositoryEditService,
        private repoService: RepositoryService,
        private toastService: ToastService
    ) {}

    async newFile(path: string | null = null, content: string = '', base64encode = false): Promise<string> {
        path = path ?? await this.promptForPath('File name with path', 'File', 'dir/file.py');
        if (!path) return;

        try {
            const createdPath = await this.editService.createFile(path, content, base64encode);
            this.store.dispatch(CodeEditorActions.OpenTab({
                tab: {
                    modified: false,
                    isDirectory: false,
                    path: createdPath,
                    absolutePath: '',
                    mimeType: 'text/plain',
                    name: basename(createdPath),
                }
            }));
            return createdPath;
        } catch (error) {
            console.error('Error creating file', error);
        }
    }

    async deleteFiles(paths: string[]): Promise<void> {
        if (!paths.length) return;

        const confirm = await this.waitForDialog<ConfirmDialogComponent, ConfirmDialogData>(ConfirmDialogComponent, {
            data: {
                title: 'Confirm delete',
                message: paths.length === 1 
                    ? `Are you sure you want to delete ${paths[0]}?` 
                    : `Are you sure you want to delete ${paths.length} files?`,
                submitButton: paths.length === 1 ? 'Delete' : 'Delete all',
                color: 'warn',
            }
        });
        
        if (!confirm) return;

        const openedTabs = await firstValueFrom(this.store.select(Select.openCodeTabs))

        try {
            await Promise.all(paths.map(path => {
                if (path in openedTabs)
                    this.store.dispatch(CodeEditorActions.CloseTab({tab:openedTabs[path]}))
                this.editService.deleteFile(path)
            }));
        } catch (error) {
            console.error('Error deleting files', error);
        }
    }

    async newFolder(path: string | null = null): Promise<string> {
        path = path ?? await this.promptForPath('Folder name with path', 'Folder', 'dir');
        if (!path) return;

        try {
            return await this.editService.makeDir(path);
        } catch (error) {
            console.error('Error creating folder', error);
        }
    }

    private handleFileTransfer<T extends Blob | any>(
        operation: Observable<HttpEvent<T>>, 
        fileName: string, 
        totalSize: number | null, 
        message: string
    ): void {
        const progress$ = new Subject<number>();
        const cancel$ = new Subject<void>();
        const dialog = this.toastService.open<LoaderToastComponent, LoaderToastData>(LoaderToastComponent, {
            message,
            progress$,
            format: this.byteFormat,
            total: totalSize || 0,
            cancel$,
        });

        operation.pipe(
            takeUntil(cancel$),
            tap((event) => {
                if (event.type === HttpEventType.UploadProgress || event.type === HttpEventType.DownloadProgress) {
                    progress$.next(event.loaded);
                    if (event.total && !dialog.componentInstance.data.total) {
                        dialog.componentInstance.data.total = event.total;
                    }
                }
            }),
            filter(event => event.type === HttpEventType.Response),
            map((event: HttpResponse<T>) => event.body),
        ).subscribe({
            next: (body) => {
                if (body instanceof Blob) {
                    const a = document.createElement('a');
                    const url = URL.createObjectURL(body);
                    a.href = url;
                    a.download = fileName;
                    a.click();
                    URL.revokeObjectURL(url);
                }
                progress$.complete();
                dialog.close();
            },
            error: () => {
                progress$.complete();
                dialog.close();
            }
        });
    }

    downloadFile(repoId: number, path: string): void {
        this.handleFileTransfer(
            this.repoService.getFile(repoId, path),
            basename(path),
            null,
            `Downloading ${basename(path)}`
        );
    }

    uploadFile(repoId: number, path: string, file: File): void {
        this.handleFileTransfer(
            this.repoService.uploadFile(repoId, path, file),
            file.name,
            file.size,
            `Uploading ${file.name}`
        );
    }


    private byteFormat(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    private async promptForPath(title: string, inputLabel: string, hint: string): Promise<string | null> {
        return this.waitForDialog<InputDialogComponent, InputDialogData, string>(InputDialogComponent, {
            data: { title, inputLabel, submitButton: 'Create', hint, inputPrefix: '/' }
        });
    }

    private async waitForDialog<T, D = any, R = any>(component: ComponentType<T>, config?: MatDialogConfig<D>): Promise<R> {
        if (this.activeDialog) return null as unknown as R;
        this.activeDialog = this.matDialog.open<T, D, R>(component, config);
        const result = await firstValueFrom(this.activeDialog.afterClosed());
        this.activeDialog = null;
        return result;
    }

}