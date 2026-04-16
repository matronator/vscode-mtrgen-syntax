import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";

import { looksLikeMtrText } from "./language-detection";
import { TOKEN_TYPE_INDEX, TOKEN_TYPES, tokenizeMtrText, type TokenType } from "./semantic-tokens";
import {
    DEFAULT_TEMPLATE_FILE_NAME,
    applyPromptValue,
    extractTemplatePromptFields,
    findAvailableTemplatePath,
    listTemplateFiles,
    parsePromptValue,
    renderTemplate,
    resolveGeneratedFilePath,
    stringifyPromptValue,
} from "./template-generation";

const CREATE_FILE_FROM_TEMPLATE_COMMAND = "mtrgenSyntax.createFileFromTemplate";

const TEMPLATE_HEADER_SNIPPET = new vscode.SnippetString([
    "--- MTRGEN ---",
    "name: ${1:name}",
    "filename: ${2:filename}",
    "path: ${3:path}",
    "--- /MTRGEN ---",
    "",
    "$0",
].join("\n"));

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
        vscode.commands.registerCommand(CREATE_FILE_FROM_TEMPLATE_COMMAND, async (resource?: vscode.Uri) => {
            await withUserFacingErrors(() => createFileFromTemplate(resource));
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

async function createFileFromTemplate(resource?: vscode.Uri): Promise<void> {
    const workspaceFolder = getRelevantWorkspaceFolder(resource);
    if (!workspaceFolder) {
        void vscode.window.showWarningMessage("Open a project folder to use MTRGen templates.");
        return;
    }

    const templates = await listTemplateFiles(workspaceFolder.uri.fsPath);
    if (templates.length === 0) {
        const action = await vscode.window.showQuickPick(
            [
                {
                    label: "Create a new template",
                    description: "Set up .mtrgen and open a starter template file.",
                },
            ],
            {
                placeHolder: `No templates were found in ${workspaceFolder.name}/.mtrgen`,
            },
        );

        if (action) {
            await createNewTemplate(workspaceFolder.uri.fsPath);
        }

        return;
    }

    const templateSelection = await vscode.window.showQuickPick(
        templates.map((template) => ({
            label: template.label,
            description: path.dirname(template.relativePath) === "." ? "Workspace template" : path.dirname(template.relativePath),
            template,
        })),
        {
            placeHolder: "Select an MTRGen template",
            matchOnDescription: true,
        },
    );

    if (!templateSelection) {
        return;
    }

    const templateContents = await fs.readFile(templateSelection.template.absolutePath, "utf8");
    const promptValues = await collectPromptValues(templateContents);
    if (!promptValues) {
        return;
    }

    const generatedFile = renderTemplate(templateContents, promptValues);
    const outputPath = resolveGeneratedFilePath(workspaceFolder.uri.fsPath, generatedFile);

    const overwriteSelection = await confirmOverwrite(outputPath, generatedFile, workspaceFolder.uri.fsPath);
    if (!overwriteSelection) {
        return;
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, generatedFile.contents, "utf8");

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(outputPath));
    await vscode.window.showTextDocument(document);

    void vscode.window.showInformationMessage(
        `Created ${path.relative(workspaceFolder.uri.fsPath, outputPath) || path.basename(outputPath)} from ${templateSelection.template.relativePath}.`,
    );
}

async function createNewTemplate(workspaceRoot: string): Promise<void> {
    const fileName = await vscode.window.showInputBox({
        title: "New MTRGen Template",
        prompt: "Template file name",
        value: DEFAULT_TEMPLATE_FILE_NAME,
        validateInput(value) {
            if (!value.trim()) {
                return "Enter a file name.";
            }

            if (value.includes("/") || value.includes("\\")) {
                return "Enter a file name only. The file will be created inside .mtrgen.";
            }

            return undefined;
        },
    });

    if (fileName === undefined) {
        return;
    }

    const templatePath = await findAvailableTemplatePath(workspaceRoot, fileName);
    await fs.writeFile(templatePath, "", { flag: "wx" });

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(templatePath));
    const editor = await vscode.window.showTextDocument(document);
    await editor.insertSnippet(TEMPLATE_HEADER_SNIPPET, new vscode.Position(0, 0));
}

async function collectPromptValues(templateContents: string): Promise<Record<string, unknown> | undefined> {
    const promptFields = extractTemplatePromptFields(templateContents);
    const promptValues: Record<string, unknown> = {};

    for (const field of promptFields) {
        const value = await vscode.window.showInputBox({
            title: "Create File from MTRGen Template",
            prompt: `Value for ${field.key}`,
            placeHolder: "Strings can be plain text. Numbers, booleans, arrays, and objects can use literal syntax.",
            value: field.defaultValue === undefined ? "" : stringifyPromptValue(field.defaultValue),
        });

        if (value === undefined) {
            return undefined;
        }

        if (value === "" && field.defaultValue !== undefined) {
            applyPromptValue(promptValues, field.key, field.defaultValue);
            continue;
        }

        applyPromptValue(promptValues, field.key, value === "" ? "" : parsePromptValue(value));
    }

    return promptValues;
}

async function confirmOverwrite(
    outputPath: string,
    generatedFile: { filePath: string },
    workspaceRoot: string,
): Promise<boolean> {
    try {
        await fs.access(outputPath);
    } catch {
        return true;
    }

    const relativeOutputPath = path.relative(workspaceRoot, outputPath) || generatedFile.filePath;
    const overwriteChoice = await vscode.window.showWarningMessage(
        `${relativeOutputPath} already exists. Do you want to overwrite it?`,
        { modal: true },
        "Overwrite",
    );

    return overwriteChoice === "Overwrite";
}

function getRelevantWorkspaceFolder(resource?: vscode.Uri): vscode.WorkspaceFolder | undefined {
    if (resource) {
        return vscode.workspace.getWorkspaceFolder(resource);
    }

    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
    if (activeEditorUri) {
        return vscode.workspace.getWorkspaceFolder(activeEditorUri);
    }

    return vscode.workspace.workspaceFolders?.[0];
}

async function withUserFacingErrors(action: () => Promise<void>): Promise<void> {
    try {
        await action();
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error.";
        void vscode.window.showErrorMessage(`MTRGen: ${message}`);
    }
}
