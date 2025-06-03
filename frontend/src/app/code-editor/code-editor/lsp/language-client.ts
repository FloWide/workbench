import { DidChangeTextDocumentFeature, DidCloseTextDocumentFeature, DidOpenTextDocumentFeature } from "vscode-languageclient/lib/common/textSynchronization";
import { CompletionItemFeature } from "vscode-languageclient/lib/common/completion";
import { HoverFeature } from "vscode-languageclient/lib/common/hover";
import { SignatureHelpFeature } from "vscode-languageclient/lib/common/signatureHelp";
import { DefinitionFeature, DefinitionMiddleware, ProvideDefinitionSignature } from "vscode-languageclient/lib/common/definition";
import { ProvideReferencesSignature, ReferencesFeature, ReferencesMiddleware } from "vscode-languageclient/lib/common/reference";
import { DocumentHighlightFeature } from "vscode-languageclient/lib/common/documentHighlight";
import { DocumentSymbolFeature } from "vscode-languageclient/lib/common/documentSymbol";
import { CodeActionFeature } from "vscode-languageclient/lib/common/codeAction";
import { CodeLensFeature } from "vscode-languageclient/lib/common/codeLens";
import { DocumentFormattingFeature, DocumentOnTypeFormattingFeature, DocumentRangeFormattingFeature } from "vscode-languageclient/lib/common/formatting";
import { RenameFeature } from "vscode-languageclient/lib/common/rename";
import { DocumentLinkFeature } from "vscode-languageclient/lib/common/documentLink";
import { ExecuteCommandFeature } from "vscode-languageclient/lib/common/executeCommand";
import { TypeDefinitionFeature } from "vscode-languageclient/lib/common/typeDefinition";
import { ImplementationFeature } from "vscode-languageclient/lib/common/implementation";
import { ColorProviderFeature } from "vscode-languageclient/lib/common/colorProvider";
import { WorkspaceFoldersFeature } from "vscode-languageclient/lib/common/workspaceFolder";
import { FoldingRangeFeature } from "vscode-languageclient/lib/common/foldingRange";
import { DeclarationFeature } from "vscode-languageclient/lib/common/declaration";
import { SelectionRangeFeature } from "vscode-languageclient/lib/common/selectionRange";
import { SemanticTokensFeature } from "vscode-languageclient/lib/common/semanticTokens";
import { InlayHintsFeature } from "vscode-languageclient/lib/common/inlayHint";
import { DiagnosticFeature } from "vscode-languageclient/lib/common/diagnostic";
import { MonacoLanguageClient } from "monaco-languageclient";
import { TextDocument, Position, CancellationToken, Definition as VDefinition, DefinitionLink as VDefinitionLink, Location as VLocation  } from "vscode";
import { CodeEditorHandlingService } from "../code-editor-handling.service";
import * as monaco from 'monaco-editor';
import {relative} from 'path-browserify';
import { RepositoryEditService } from "@core/services/repo/repo-edit.service";
import { CodeEditorTextModelsService } from "../code-editor-text-models.service";

export class LanguageClient extends MonacoLanguageClient {

    protected registerBuiltinFeatures(): void {
        this.registerFeature(new DidOpenTextDocumentFeature(this, this['_syncedDocuments']));
        this.registerFeature(new DidChangeTextDocumentFeature(this));
        this.registerFeature(new DidCloseTextDocumentFeature(this, this['_syncedDocuments']));
        this.registerFeature(new CompletionItemFeature(this));
        this.registerFeature(new HoverFeature(this));
        this.registerFeature(new SignatureHelpFeature(this));
        this.registerFeature(new DefinitionFeature(this));
        this.registerFeature(new ReferencesFeature(this));
        this.registerFeature(new DocumentHighlightFeature(this));
        this.registerFeature(new DocumentSymbolFeature(this));
        this.registerFeature(new CodeActionFeature(this));
        this.registerFeature(new CodeLensFeature(this));
        this.registerFeature(new DocumentFormattingFeature(this));
        this.registerFeature(new DocumentRangeFormattingFeature(this));
        this.registerFeature(new DocumentOnTypeFormattingFeature(this));
        this.registerFeature(new RenameFeature(this));
        this.registerFeature(new DocumentLinkFeature(this));
        this.registerFeature(new ExecuteCommandFeature(this));
        this.registerFeature(new TypeDefinitionFeature(this));
        this.registerFeature(new ImplementationFeature(this));
        this.registerFeature(new ColorProviderFeature(this));
        // We only register the workspace folder feature if the client is not locked
        // to a specific workspace folder.
        if (this.clientOptions.workspaceFolder === undefined) {
            this.registerFeature(new WorkspaceFoldersFeature(this));
        }
        this.registerFeature(new FoldingRangeFeature(this));
        this.registerFeature(new DeclarationFeature(this));
        this.registerFeature(new SelectionRangeFeature(this));
        this.registerFeature(new SemanticTokensFeature(this));
        // NOT WORKING
        // this.registerFeature(new LinkedEditingFeature(this));
        this.registerFeature(new InlayHintsFeature(this));
        this.registerFeature(new DiagnosticFeature(this));
    }
}

export class LanguageClientMiddlewares implements DefinitionMiddleware, ReferencesMiddleware {

    constructor(
        private editHandler: CodeEditorHandlingService, 
        private editService: RepositoryEditService,
        private textModelService: CodeEditorTextModelsService
    ) {}

    async provideDefinition(document: TextDocument, position: Position, token: CancellationToken, next: ProvideDefinitionSignature): Promise<VDefinition | VDefinitionLink[]> {
        const definition = await next(document, position, token);
        if (Array.isArray(definition)) {
            for(const d of definition) {
                if ('uri' in d && d.uri) {
                    await this.handleDefinitionProvider(d.uri);
                } else if ('targetUri' in d && d.targetUri) {
                    await this.handleDefinitionProvider(d.targetUri);
                }
            }
        } else if (definition) {
            if ('uri' in definition && definition.uri) 
                await this.handleDefinitionProvider(definition.uri)
        }
        return definition;
    }

    async provideReferences (document: TextDocument, position: Position, options: { includeDeclaration: boolean; }, token: CancellationToken, next: ProvideReferencesSignature) : Promise<VLocation[]> {
        console.log('provideReferences', document, position, options, token);
        const def = await next(document, position,options,token);
        const cwd = await this.editService.getCwd();
        for(const d of def) {
            const fullPath = decodeURIComponent(d.uri.toString().replace('file://',''));
            const path = relative(cwd, fullPath);
            await this.textModelService.getModel(path);
        }
        return def;
    }

    private async handleDefinitionProvider(uri: monaco.Uri) {
        const fullPath = decodeURIComponent(uri.toString().replace('file://',''));
        const cwd = await this.editService.getCwd();
        const path = relative(cwd, fullPath);
        const model = await this.textModelService.getModel(path);
    }

}