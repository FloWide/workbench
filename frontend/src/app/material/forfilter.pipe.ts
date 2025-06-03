import { Pipe, PipeTransform } from '@angular/core';


type ObjectLike = {
  [key:string]:any;
};

@Pipe({
  name: 'forFilter',
  pure:false
})
export class ForfilterPipe implements PipeTransform {

  transform<T extends ObjectLike>(items: T[], field: string, value: any): T[] {
    if(!items) return [];
    if(value === null || value === undefined) return items;
    return items.filter((el) => el[field] === value);
  }

}
