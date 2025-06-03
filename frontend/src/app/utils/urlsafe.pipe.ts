import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Pipe({
  name: 'urlsafe'
})
export class UrlsafePipe implements PipeTransform {

  constructor(private sanitizer:DomSanitizer) {}

  transform(url:string): string | SafeUrl{
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

}
