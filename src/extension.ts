import * as vscode from "vscode";

import { looksLikeMtrText } from "./language-detection";
import { TOKEN_TYPE_INDEX, TOKEN_TYPES, tokenizeMtrText, type TokenType } from "./semantic-tokens";

function isFileDocument(document: vscode.TextDocument | undefined): document is vscode.TextDocument {
    if (!document) {
        return false;
    }

    return document.uri.scheme === "file";
}

function shouldManageDocument(document: vscode.TextDocument | undefined): boolean {
    if (!isFileDocument(document)) {
        return false;
    }

    return document.fileName.toLowerCase().endsWith(".mtr") || looksLikeMtrText(document.getText());
}

function createSemanticLegend(): vscode.SemanticTokensLegend {
    return new vscode.SemanticTokensLegend([...TOKEN_TYPES], []);
}

function getTokenTypeIndex(tokenType: TokenType): number {
    const index = TOKEN_TYPE_INDEX.get(tokenType);
    if (index === undefined) {
        throw new Error(`Unknown token type: ${tokenType}`);
    }

    return index;
}

function createSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder();

    for (const token of tokenizeMtrText(document.getText())) {
        builder.push(
            token.line,
            token.startCharacter,
            token.length,
            getTokenTypeIndex(token.tokenType),
            0,
        );
    }

    return builder.build();
}

export function activate(context: vscode.ExtensionContext): void {
    const semanticLegend = createSemanticLegend();
    const managedDocuments = new Set<string>();

    function updateManagedDocument(document: vscode.TextDocument): void {
        if (!isFileDocument(document)) {
            return;
        }

        const key = document.uri.toString();
        if (shouldManageDocument(document)) {
            managedDocuments.add(key);
            return;
        }

        managedDocuments.delete(key);
    }

    function refreshOpenDocuments(): void {
        for (const document of vscode.workspace.textDocuments) {
            updateManagedDocument(document);
        }
    }

    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            [{ scheme: "file" }],
            {
                provideDocumentSemanticTokens(document) {
                    if (!managedDocuments.has(document.uri.toString()) && !shouldManageDocument(document)) {
                        return null;
                    }

                    return createSemanticTokens(document);
                },
            },
            semanticLegend,
        ),
        vscode.workspace.onDidOpenTextDocument((document) => {
            updateManagedDocument(document);
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            updateManagedDocument(event.document);
        }),
        vscode.workspace.onDidSaveTextDocument((document) => {
            updateManagedDocument(document);
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                updateManagedDocument(editor.document);
            }
        }),
        vscode.workspace.onDidRenameFiles(() => {
            refreshOpenDocuments();
        }),
        vscode.workspace.onDidCloseTextDocument((document) => {
            managedDocuments.delete(document.uri.toString());
        }),
        {
            dispose() {
                managedDocuments.clear();
            },
        },
    );

    refreshOpenDocuments();
}

export function deactivate(): void {}
