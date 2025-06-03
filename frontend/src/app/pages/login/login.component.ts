import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '@core/index';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit,OnDestroy {

  private destroy$ = new Subject();

  constructor(public auth:AuthenticationService,private router:Router) { }
  
  
  ngOnInit(): void {
    this.auth.isAuthenticated$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(loggedIn => {
      if(loggedIn) {
        this.router.navigate(["/"]);
      }
    })
  }

  ngOnDestroy(): void {
    this.destroy$.next(null);
    this.destroy$.complete();
  }

}
