import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'maxLengthString'
})
export class MaxLengthStringPipe implements PipeTransform {

  transform(value: string, length: number): string {
    if (value.length < length)
      return value
    else
      return value.slice(0,length-3) + "..."
  }

}
