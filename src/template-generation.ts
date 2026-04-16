import * as fs from "node:fs/promises";
import * as path from "node:path";

export type TemplateLiteralValue =
    | string
    | boolean
    | number
    | null
    | TemplateLiteralValue[]
    | { [key: string]: TemplateLiteralValue };

export interface GeneratedFile {
    filePath: string;
    contents: string;
}

const { Generator, LITERALLY_NULL, Parser } = require("mtrgen-js") as {
    Generator: {
        getDefaultArguments(input: string): Record<string, TemplateLiteralValue>;
        parseTemplate(template: string, args?: Record<string, unknown>): GeneratedFile;
    };
    LITERALLY_NULL: symbol;
    Parser: {
        parseLiteral(raw: string): TemplateLiteralValue | symbol;
    };
};

export const TEMPLATE_DIRECTORY_NAME = ".mtrgen";
export const DEFAULT_TEMPLATE_FILE_NAME = "new-template.mtr";

export interface TemplateFile {
    absolutePath: string;
    relativePath: string;
    label: string;
}

export interface TemplatePromptField {
    key: string;
    defaultValue?: TemplateLiteralValue;
}

interface ParsedReference {
    base: string;
    segments: Array<number | string>;
}

export async function listTemplateFiles(workspaceRoot: string): Promise<TemplateFile[]> {
    const templateRoot = path.join(workspaceRoot, TEMPLATE_DIRECTORY_NAME);

    try {
        const stat = await fs.stat(templateRoot);
        if (!stat.isDirectory()) {
            return [];
        }
    } catch {
        return [];
    }

    const files = await collectFiles(templateRoot, templateRoot);
    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function collectFiles(root: string, currentDirectory: string): Promise<TemplateFile[]> {
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    const files: TemplateFile[] = [];

    for (const entry of entries) {
        if (entry.name.startsWith(".")) {
            continue;
        }

        const absolutePath = path.join(currentDirectory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectFiles(root, absolutePath)));
            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        const relativePath = toPosixPath(path.relative(root, absolutePath));
        files.push({
            absolutePath,
            relativePath,
            label: relativePath,
        });
    }

    return files;
}

export function extractTemplatePromptFields(template: string): TemplatePromptField[] {
    const discoveredFields = new Map<string, TemplatePromptField>();
    const templateDefaults = Generator.getDefaultArguments(template);

    for (const match of template.matchAll(/<%\s*([\s\S]*?)\s*%>/g)) {
        const rawExpression = (match[1] ?? "").trim();
        if (!rawExpression) {
            continue;
        }

        if (rawExpression === "else" || rawExpression === "endif") {
            continue;
        }

        if (rawExpression.startsWith("if ")) {
            collectConditionReferences(rawExpression.slice(3), templateDefaults, discoveredFields);
            continue;
        }

        if (rawExpression.startsWith("elseif ")) {
            collectConditionReferences(rawExpression.slice(7), templateDefaults, discoveredFields);
            continue;
        }

        const [referenceExpression] = splitTopLevel(rawExpression, "|");
        if (!referenceExpression) {
            continue;
        }

        const assignmentIndex = findTopLevelAssignment(referenceExpression);
        const key = (assignmentIndex === -1 ? referenceExpression : referenceExpression.slice(0, assignmentIndex)).trim();
        const defaultExpression = assignmentIndex === -1 ? undefined : referenceExpression.slice(assignmentIndex + 1).trim();
        addReference(discoveredFields, templateDefaults, key, defaultExpression);
    }

    return [...discoveredFields.values()];
}

function collectConditionReferences(
    condition: string,
    templateDefaults: Record<string, TemplateLiteralValue>,
    discoveredFields: Map<string, TemplatePromptField>,
): void {
    const conditionMatch = /^(?<negation>!?)(?<left>\S+?)(?:\s*(?<operator>(?:<=|<|===|==|>=|>|!==|!=))\s*(?<right>.+))?$/.exec(
        condition.trim(),
    );

    if (!conditionMatch?.groups) {
        return;
    }

    addReference(discoveredFields, templateDefaults, conditionMatch.groups.left);
    if (conditionMatch.groups.right) {
        addReference(discoveredFields, templateDefaults, conditionMatch.groups.right.trim());
    }
}

function addReference(
    discoveredFields: Map<string, TemplatePromptField>,
    templateDefaults: Record<string, TemplateLiteralValue>,
    referenceExpression: string,
    inlineDefaultExpression?: string,
): void {
    const normalizedKey = normalizeReference(referenceExpression);
    if (!normalizedKey || discoveredFields.has(normalizedKey)) {
        return;
    }

    const parsedReference = parseReference(normalizedKey);
    if (!parsedReference) {
        return;
    }

    let defaultValue = getValueAtReference(templateDefaults, parsedReference);

    if (defaultValue === undefined && inlineDefaultExpression) {
        const parsedInlineDefault = Parser.parseLiteral(inlineDefaultExpression);
        defaultValue = parsedInlineDefault === LITERALLY_NULL
            ? inlineDefaultExpression
            : (parsedInlineDefault as TemplateLiteralValue);
    }

    discoveredFields.set(normalizedKey, defaultValue === undefined
        ? { key: normalizedKey }
        : { key: normalizedKey, defaultValue });
}

export function parsePromptValue(input: string): unknown {
    const literal = Parser.parseLiteral(input);
    return literal === LITERALLY_NULL ? input : literal;
}

export function stringifyPromptValue(value: TemplateLiteralValue): string {
    if (typeof value === "string") {
        return value;
    }

    if (typeof value === "number" || typeof value === "boolean" || value === null) {
        return String(value);
    }

    return JSON.stringify(value);
}

export function applyPromptValue(target: Record<string, unknown>, key: string, value: unknown): void {
    const parsedReference = parseReference(key);
    if (!parsedReference) {
        return;
    }

    if (parsedReference.segments.length === 0) {
        target[parsedReference.base] = value;
        return;
    }

    let current: Record<string, unknown> | unknown[] = target;
    const pathSegments = [parsedReference.base, ...parsedReference.segments];

    for (let index = 0; index < pathSegments.length; index += 1) {
        const segment = pathSegments[index];
        const nextSegment = pathSegments[index + 1];
        const isLeaf = index === pathSegments.length - 1;

        if (typeof segment === "number") {
            if (!Array.isArray(current)) {
                throw new Error(`Cannot assign numeric segment "${segment}" to a non-array value for "${key}".`);
            }

            if (isLeaf) {
                current[segment] = value;
                return;
            }

            const existingValue = current[segment];
            if (existingValue === undefined || existingValue === null || typeof existingValue !== "object") {
                current[segment] = typeof nextSegment === "number" ? [] : {};
            }

            current = current[segment] as Record<string, unknown> | unknown[];
            continue;
        }

        if (isLeaf) {
            setProperty(current, segment, value);
            return;
        }

        const existingValue = getProperty(current, segment);
        if (existingValue === undefined || existingValue === null || typeof existingValue !== "object") {
            setProperty(current, segment, typeof nextSegment === "number" ? [] : {});
        }

        current = getProperty(current, segment) as Record<string, unknown> | unknown[];
    }
}

export function renderTemplate(template: string, args: Record<string, unknown>): GeneratedFile {
    return Generator.parseTemplate(template, args);
}

export function resolveGeneratedFilePath(workspaceRoot: string, generatedFile: GeneratedFile): string {
    const resolvedPath = path.resolve(workspaceRoot, generatedFile.filePath);
    const relativePath = path.relative(workspaceRoot, resolvedPath);

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(`The generated path "${generatedFile.filePath}" points outside the workspace root.`);
    }

    return resolvedPath;
}

export async function ensureTemplateDirectory(workspaceRoot: string): Promise<string> {
    const templateDirectory = path.join(workspaceRoot, TEMPLATE_DIRECTORY_NAME);
    await fs.mkdir(templateDirectory, { recursive: true });
    return templateDirectory;
}

export async function findAvailableTemplatePath(workspaceRoot: string, requestedName: string): Promise<string> {
    const templateDirectory = await ensureTemplateDirectory(workspaceRoot);
    const sanitizedName = requestedName.trim() || DEFAULT_TEMPLATE_FILE_NAME;
    const extension = path.extname(sanitizedName);
    const basename = extension ? sanitizedName.slice(0, -extension.length) : sanitizedName;
    const resolvedExtension = extension || ".mtr";

    let candidateName = `${basename}${resolvedExtension}`;
    let candidatePath = path.join(templateDirectory, candidateName);
    let counter = 2;

    while (await pathExists(candidatePath)) {
        candidateName = `${basename}-${counter}${resolvedExtension}`;
        candidatePath = path.join(templateDirectory, candidateName);
        counter += 1;
    }

    return candidatePath;
}

async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

function normalizeReference(referenceExpression: string): string {
    const trimmed = referenceExpression.trim().replace(/^\$/, "");
    if (!trimmed) {
        return "";
    }

    const literal = Parser.parseLiteral(trimmed);
    if (literal !== LITERALLY_NULL) {
        return "";
    }

    return trimmed;
}

function getValueAtReference(
    source: Record<string, TemplateLiteralValue>,
    parsedReference: ParsedReference,
): TemplateLiteralValue | undefined {
    let current: unknown = source[parsedReference.base];

    for (const segment of parsedReference.segments) {
        if (current === undefined || current === null || typeof current !== "object") {
            return undefined;
        }

        current = (current as Record<string, unknown> | unknown[])[segment as keyof typeof current];
    }

    return current as TemplateLiteralValue | undefined;
}

function getProperty(container: Record<string, unknown> | unknown[], segment: number | string): unknown {
    if (typeof segment === "number") {
        return (container as unknown[])[segment];
    }

    return (container as Record<string, unknown>)[segment];
}

function setProperty(container: Record<string, unknown> | unknown[], segment: number | string, value: unknown): void {
    if (typeof segment === "number") {
        (container as unknown[])[segment] = value;
        return;
    }

    (container as Record<string, unknown>)[segment] = value;
}

function parseReference(referenceExpression: string): ParsedReference | null {
    const trimmed = referenceExpression.trim();
    const baseMatch = /^[a-zA-Z0-9_]+/.exec(trimmed);
    if (!baseMatch) {
        return null;
    }

    const base = baseMatch[0];
    const segments: Array<number | string> = [];
    let cursor = base.length;

    while (cursor < trimmed.length) {
        const currentCharacter = trimmed[cursor];
        if (currentCharacter === ".") {
            cursor += 1;
            const propertyMatch = /^[a-zA-Z0-9_]+/.exec(trimmed.slice(cursor));
            if (!propertyMatch) {
                return null;
            }

            segments.push(propertyMatch[0]);
            cursor += propertyMatch[0].length;
            continue;
        }

        if (currentCharacter === "[") {
            const closingBracketIndex = trimmed.indexOf("]", cursor + 1);
            if (closingBracketIndex === -1) {
                return null;
            }

            const rawSegment = trimmed.slice(cursor + 1, closingBracketIndex).trim();
            if (/^\d+$/.test(rawSegment)) {
                segments.push(Number(rawSegment));
            } else if (
                (rawSegment.startsWith("'") && rawSegment.endsWith("'"))
                || (rawSegment.startsWith("\"") && rawSegment.endsWith("\""))
            ) {
                segments.push(rawSegment.slice(1, -1).replace(/\\(['"])/g, "$1"));
            } else if (rawSegment.length > 0) {
                segments.push(rawSegment);
            } else {
                return null;
            }

            cursor = closingBracketIndex + 1;
            continue;
        }

        return null;
    }

    return {
        base,
        segments,
    };
}

function splitTopLevel(input: string, separator: string): string[] {
    const parts: string[] = [];
    let current = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaping = false;
    let bracketDepth = 0;
    let braceDepth = 0;
    let parenDepth = 0;

    for (const character of input) {
        if (escaping) {
            current += character;
            escaping = false;
            continue;
        }

        if (character === "\\") {
            current += character;
            escaping = true;
            continue;
        }

        if (character === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            current += character;
            continue;
        }

        if (character === "\"" && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            current += character;
            continue;
        }

        if (!inSingleQuote && !inDoubleQuote) {
            if (character === "[") {
                bracketDepth += 1;
            } else if (character === "]") {
                bracketDepth = Math.max(0, bracketDepth - 1);
            } else if (character === "{") {
                braceDepth += 1;
            } else if (character === "}") {
                braceDepth = Math.max(0, braceDepth - 1);
            } else if (character === "(") {
                parenDepth += 1;
            } else if (character === ")") {
                parenDepth = Math.max(0, parenDepth - 1);
            } else if (character === separator && bracketDepth === 0 && braceDepth === 0 && parenDepth === 0) {
                parts.push(current.trim());
                current = "";
                continue;
            }
        }

        current += character;
    }

    if (current.trim().length > 0 || input.endsWith(separator)) {
        parts.push(current.trim());
    }

    return parts;
}

function findTopLevelAssignment(input: string): number {
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaping = false;
    let bracketDepth = 0;
    let braceDepth = 0;
    let parenDepth = 0;

    for (let index = 0; index < input.length; index += 1) {
        const character = input[index];
        if (escaping) {
            escaping = false;
            continue;
        }

        if (character === "\\") {
            escaping = true;
            continue;
        }

        if (character === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            continue;
        }

        if (character === "\"" && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            continue;
        }

        if (inSingleQuote || inDoubleQuote) {
            continue;
        }

        if (character === "[") {
            bracketDepth += 1;
            continue;
        }

        if (character === "]") {
            bracketDepth = Math.max(0, bracketDepth - 1);
            continue;
        }

        if (character === "{") {
            braceDepth += 1;
            continue;
        }

        if (character === "}") {
            braceDepth = Math.max(0, braceDepth - 1);
            continue;
        }

        if (character === "(") {
            parenDepth += 1;
            continue;
        }

        if (character === ")") {
            parenDepth = Math.max(0, parenDepth - 1);
            continue;
        }

        const nextCharacter = input[index + 1];
        const previousCharacter = input[index - 1];
        if (
            character === "="
            && bracketDepth === 0
            && braceDepth === 0
            && parenDepth === 0
            && nextCharacter !== "="
            && previousCharacter !== "!"
            && previousCharacter !== "<"
            && previousCharacter !== ">"
        ) {
            return index;
        }
    }

    return -1;
}

function toPosixPath(filePath: string): string {
    return filePath.split(path.sep).join(path.posix.sep);
}
