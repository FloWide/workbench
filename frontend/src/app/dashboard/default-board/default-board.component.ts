import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { CustomHttpService } from '@core/services';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { BoardEventsService } from '../board-events.service';

@Component({
  selector: 'app-default-board',
  templateUrl: './default-board.component.html',
  styleUrls: ['./default-board.component.scss']
})
export class DefaultBoardComponent {

  isBackendWorking$ = this.http.get('').pipe(
    map(() => true),
    catchError((err: HttpErrorResponse) => {
      return of(err.status !== 0)
    })
  );

  constructor(
    private http: CustomHttpService,
    public boardEvents: BoardEventsService
  ) { }
}
