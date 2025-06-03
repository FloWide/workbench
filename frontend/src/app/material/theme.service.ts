import { Injectable, Renderer2 } from "@angular/core";
import { BehaviorSubject } from "rxjs";




export enum Themes {
    DARK = 'dark-theme',
    LIGHT = 'light-theme'
}


@Injectable({
    providedIn:'root'
})
export class ThemeService {


    themeChange$ = new BehaviorSubject<Themes>(Themes.LIGHT);

    theme: Themes = Themes.LIGHT

    constructor() {
        const savedTheme = localStorage.getItem('__theme');
        if (savedTheme)
            this.setTheme(savedTheme as Themes);
    }

    setTheme(theme: Themes) {
        document.body.classList.remove('dark-theme');
        document.body.classList.remove('light-theme');
        document.body.classList.add(theme);
        this.themeChange$.next(theme);
        localStorage.setItem('__theme',theme);
    }

}