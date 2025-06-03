import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable()
export class BoardEventsService {

  onCreateNew$ = new Subject<void>();

  constructor() { }
}
