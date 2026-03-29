import * as vscode from "vscode";

import {
    DEFAULT_LANGUAGE_ID,
    FALLBACK_LANGUAGE_SPECS,
    createLanguageRegistry,
    detectLanguageId,
    type LanguageContribution,
    type LanguageRegistry,
} from "./language-detection";
import { TOKEN_TYPE_INDEX, TOKEN_TYPES, tokenizeMtrText, type TokenType } from "./semantic-tokens";

type TimeoutHandle = ReturnType<typeof setTimeout>;

function isMtrDocument(document: vscode.TextDocument | undefined): document is vscode.TextDocument {
    if (!document) {
        return false;
    }

    if (document.uri.scheme !== "file") {
        return false;
    }

    return document.fileName.toLowerCase().endsWith(".mtr");
}

function isLanguageContribution(value: unknown): value is LanguageContribution {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const candidate = value as LanguageContribution;
    return typeof candidate.id === "string" || typeof candidate.languageId === "string";
}

function collectInstalledLanguageSpecs(): LanguageContribution[] {
    const languageSpecs: LanguageContribution[] = [];

    for (const extension of vscode.extensions.all) {
        const packageJson = extension.packageJSON as
            | {
                  contributes?: {
                      languages?: unknown;
                  };
              }
            | undefined;
        const contributedLanguages = packageJson?.contributes?.languages;
        if (!Array.isArray(contributedLanguages)) {
            continue;
        }

        for (const contribution of contributedLanguages) {
            if (!isLanguageContribution(contribution)) {
                continue;
            }

            languageSpecs.push(contribution);
        }
    }

    return languageSpecs;
}

function createRuntimeLanguageRegistry(): LanguageRegistry {
    return createLanguageRegistry([...FALLBACK_LANGUAGE_SPECS, ...collectInstalledLanguageSpecs()]);
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

async function syncDocumentLanguage(
    document: vscode.TextDocument,
    languageRegistry: LanguageRegistry,
): Promise<void> {
    if (!isMtrDocument(document)) {
        return;
    }

    const desiredLanguageId = detectLanguageId(document.fileName, document.getText(), languageRegistry);
    const currentLanguageId = document.languageId || DEFAULT_LANGUAGE_ID;
    if (currentLanguageId === desiredLanguageId) {
        return;
    }

    try {
        await vscode.languages.setTextDocumentLanguage(document, desiredLanguageId);
    } catch (error: unknown) {
        console.error("[mtrgen-vscode] Failed to set language mode:", error);
    }
}

export function activate(context: vscode.ExtensionContext): void {
    const semanticLegend = createSemanticLegend();
    const languageRegistry = createRuntimeLanguageRegistry();
    const pendingUpdates = new Map<string, TimeoutHandle>();

    function scheduleSync(document: vscode.TextDocument, delay = 150): void {
        if (!isMtrDocument(document)) {
            return;
        }

        const key = document.uri.toString();
        const existing = pendingUpdates.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        const timeout = setTimeout(() => {
            pendingUpdates.delete(key);
            void syncDocumentLanguage(document, languageRegistry);
        }, delay);

        pendingUpdates.set(key, timeout);
    }

    async function syncOpenDocuments(): Promise<void> {
        for (const document of vscode.workspace.textDocuments) {
            await syncDocumentLanguage(document, languageRegistry);
        }
    }

    context.subscriptions.push(
        vscode.languages.registerDocumentSemanticTokensProvider(
            [
                { language: DEFAULT_LANGUAGE_ID },
                { scheme: "file", pattern: "**/*.mtr" },
            ],
            {
                provideDocumentSemanticTokens(document) {
                    return createSemanticTokens(document);
                },
            },
            semanticLegend,
        ),
        vscode.workspace.onDidOpenTextDocument((document) => {
            scheduleSync(document, 0);
        }),
        vscode.workspace.onDidChangeTextDocument((event) => {
            scheduleSync(event.document);
        }),
        vscode.workspace.onDidSaveTextDocument((document) => {
            scheduleSync(document, 0);
        }),
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                scheduleSync(editor.document, 0);
            }
        }),
        vscode.workspace.onDidRenameFiles(() => {
            void syncOpenDocuments();
        }),
        {
            dispose() {
                for (const timeout of pendingUpdates.values()) {
                    clearTimeout(timeout);
                }

                pendingUpdates.clear();
            },
        },
    );

    void syncOpenDocuments();
}

export function deactivate(): void {}
