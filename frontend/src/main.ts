import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

function wait(ms: number) {
  return new Promise((resolve,reject) => setTimeout(resolve,ms));
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .then(async () => {
    const splashScreen = document.getElementById('splash');
    await wait(200);
    splashScreen.classList.add('off');
    await wait(1500);
    splashScreen.remove();
  })
  .catch(err => console.error(err));
