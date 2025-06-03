import { Inject, InjectionToken, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { MonacoCodeEditor } from './monaco-code-editor';
import { Themes, ThemeService } from '@material/theme.service';
import  * as monaco from 'monaco-editor';
import { shikiToMonaco } from '@shikijs/monaco'
import {createHighlighter} from './shiki-highlighter';


export const MONACO_LOADED = new InjectionToken<BehaviorSubject<boolean>>('MONACO_LOADED');


const DARK_THEME = "dark-plus"
const LIGHT_THEME = "light-plus"


window.MonacoEnvironment = {
  ...window.MonacoEnvironment,
	getWorkerUrl: function (moduleId, label) {
		if (label === 'json') {
			return './json.worker.js';
		}
		if (label === 'css' || label === 'scss' || label === 'less') {
			return './css.worker.js';
		}
		if (label === 'html' || label === 'handlebars' || label === 'razor') {
			return './html.worker.js';
		}
		if (label === 'typescript' || label === 'javascript') {
			return './ts.worker.js';
		}
    if (label === 'yaml') {
      return './yaml.worker.js';
    }

		return './editor.worker.js';
	}
};



@NgModule({
  declarations: [
    MonacoCodeEditor
  ],
  imports: [
    CommonModule
  ],
  exports:[
    MonacoCodeEditor
  ],
  providers:[
    {
      provide:MONACO_LOADED,
      useFactory: () => new BehaviorSubject<boolean>(false)
    }
  ]
})
export class MonacoEditorModule {

  constructor(
    @Inject(MONACO_LOADED) private monacoLoaded$: BehaviorSubject<boolean>,
    private themeService: ThemeService
  ) {
    this.themeChanger();
    this.shikiHighlighter().then(() => {
      monacoLoaded$.next(true);
    });
  }

  private themeChanger() {
    this.themeService.themeChange$.subscribe((theme) => {
      switch (theme) {
        case Themes.LIGHT:
          monaco.editor.setTheme(LIGHT_THEME);
          break;
        case Themes.DARK:
          monaco.editor.setTheme(DARK_THEME);
          break;
      }
    })
  }

  private async shikiHighlighter() {
    const highlighter = await createHighlighter();
    monaco.languages.register({
      id:'toml',
      extensions:['.toml'],
      aliases:['TOML','toml'],
      mimetypes:['text/toml']
    });
    monaco.languages.register({
      id:'tsx',
      extensions:['.tsx'],
      aliases:['TSX','tsx', 'typescriptreact'],
    });
    monaco.languages.register({
      id:'jsx',
      extensions:['.jsx'],
      aliases:['JSX','jsx', 'javascriptreact'],
    });
    shikiToMonaco(highlighter, monaco, {tokenizeMaxLineLength: 1000})

  }

}
