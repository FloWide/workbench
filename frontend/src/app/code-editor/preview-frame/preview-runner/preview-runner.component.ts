import { Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { AppState, Select} from '@core/store';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { map, take, takeUntil } from 'rxjs/operators';
import { GlComponentDirective } from 'src/app/golden-layout';
import { PreviewHandlerService } from '../preview-handler.service';

@Component({
  selector: 'app-preview-runner',
  templateUrl: './preview-runner.component.html',
  styleUrls: ['./preview-runner.component.scss']
})
export class PreviewRunnerComponent extends GlComponentDirective implements OnDestroy {
  
  @Input() pid: number;

  @Input() port: number;

  @Input() url: string;

  @Input() title: string;

  @Input() state: 'active' | 'inactive'

  private destroy$ = new Subject();

  frameRefresh = false;

  appName$ = this.store.select(Select.appsToProcesses).pipe(
    takeUntil(this.destroy$),
    map((appsToProcess) => {
      return Object.keys(appsToProcess).find((key) => appsToProcess[key] === this.pid)
    }),
    take(1)
  )
  
  onOpenPopout$ = new Subject<void>();

  @ViewChild('frame',{read: ElementRef, static: false}) set frame(frame: ElementRef) {
    if (!frame) return;
    frame.nativeElement.onload = () => {
      if (!this.initialLoad) {
        setTimeout(() => this.refresh(),500);
        this.initialLoad = true;
      }
    }
  };
  
  initialLoad: boolean = false;

  constructor(
    elemenRef:ElementRef,
    private store: Store<AppState>,
    ) {
      super(elemenRef.nativeElement);
   }
  
  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
    this.onOpenPopout$.complete();
  }

  refresh() {
    this.frameRefresh = true;

    setTimeout(() => {
        this.frameRefresh = false;
    }, 50);
  }

  popout() {
    this.onOpenPopout$.next();
  }

  focus(): void {
    
  }
}
