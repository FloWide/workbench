import { Injectable, OnDestroy } from "@angular/core";
import { RepositoryEditService } from "@core/services/repo/repo-edit.service";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";




@Injectable()
export class TerminalBufferService implements OnDestroy {

    private _buffers: Record<number | string, string[]> = {}

    private destroy$ = new Subject();

    constructor(
        private editService: RepositoryEditService
    ) {
        this.editService.onStream$.pipe(
            takeUntil(this.destroy$)
        ).subscribe((stream) => {
            if (stream.pid in this._buffers) {
                this._buffers[stream.pid].push(stream.data)
            } else {
                this._buffers[stream.pid] = [stream.data]
            }
        });

        this.editService.onTaskStream$.pipe(
            takeUntil(this.destroy$)
        ).subscribe((stream) => {
            if (stream.id in this._buffers) {
                this._buffers[stream.id].push(stream.data)
            } else {
                this._buffers[stream.id] = [stream.data]
            }
        })
    }
    

    getBuffer(id: number | string): string[] {
        if (id in this._buffers)
            return this._buffers[id]
        else
            return []
    }

    clear(id?: number | string) {
        if (id === undefined || id === null) {
            this._buffers = {}
        } else {
            this._buffers[id] = []
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next(null);
        this.destroy$.complete();
    }
}