import { AbstractMessageReader, AbstractMessageWriter, Message } from 'vscode-ws-jsonrpc';
import { MessageReader as IMessageReader, MessageWriter as IMessageWriter, DataCallback, Disposable} from 'monaco-languageclient';
import { RepositoryEditService } from '@core/services/repo/repo-edit.service';
import { Subject } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

export class MessageReader extends AbstractMessageReader implements IMessageReader {
    protected state: 'initial' | 'listening' | 'closed' = 'initial';
    protected callback: DataCallback | undefined;
    protected readonly events: { message?: any, error?: any }[] = [];

    private destroy$ = new Subject();

    constructor (private lang: string, protected readonly editService: RepositoryEditService) {
        super();
        this.editService.onLspStream$.pipe(
            takeUntil(this.destroy$),
            filter((data) => data.lang === this.lang),
            map((data) => data.data)
        ).subscribe((data) => {
            this.readMessage(data)
        })
    }

    listen (callback: DataCallback): Disposable {
        if (this.state === 'initial') {
            this.state = 'listening';
            this.callback = callback;
            while (this.events.length !== 0) {
                const event = this.events.pop()!;
                if (event.message) {
                    this.readMessage(event.message);
                } else if (event.error) {
                    this.fireError(event.error);
                } else {
                    this.fireClose();
                }
            }
        }
        return {
            dispose: () => {
                if (this.callback === callback) {
                    this.callback = undefined;
                }
            }
        };
    }

    protected readMessage (message: any): void {
        if (this.state === 'initial') {
            this.events.splice(0, 0, { message });
        } else if (this.state === 'listening') {
            const data = JSON.parse(message);
            this.callback!(data);
        }
    }

    protected fireError (error: any): void {
        if (this.state === 'initial') {
            this.events.splice(0, 0, { error });
        } else if (this.state === 'listening') {
            super.fireError(error);
        }
    }

    protected fireClose (): void {
        if (this.state === 'initial') {
            this.events.splice(0, 0, {});
        } else if (this.state === 'listening') {
            super.fireClose();
        }
        this.state = 'closed';
    }

    dispose(): void {
        this.destroy$.next(null);
        this.destroy$.complete();
    }
}


export class MessageWriter extends AbstractMessageWriter implements IMessageWriter {
    protected errorCount = 0;

    constructor (private lang: string,protected readonly editService: RepositoryEditService) {
        super();
    }

    end (): void {
    }

    async write (msg: Message): Promise<void> {
        try {
            const content = JSON.stringify(msg);
            await this.editService.writeToLsp(this.lang, content)
        } catch (e) {
            this.errorCount++;
            this.fireError(e, msg, this.errorCount);
        }
    }
}