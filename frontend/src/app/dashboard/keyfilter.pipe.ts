
import { Pipe, PipeTransform } from '@angular/core';
import { isScriptModel, ScriptModel } from '@core/services';
import { PythonServiceModel } from '@core/services/python-service/python-service.model';
import { isRepositoryModel, RepositoryModel } from '@core/services/repo/repo.model';

@Pipe({
  name: 'keyfilter'
})
export class KeyfilterPipe implements PipeTransform {

  transform(value: (RepositoryModel | ScriptModel | PythonServiceModel)[],find:string): any[] {
    if(!value) return value;

    if(!find || find === '') return value;

    const regex = new RegExp(`.*${find}.*`)
    
    return value.filter((v: any) => regex.test(v.id) || regex.test(v.name))
  }
}