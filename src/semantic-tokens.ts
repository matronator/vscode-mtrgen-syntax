export const TOKEN_TYPES = [
    "comment",
    "property",
    "operator",
    "keyword",
    "variable",
    "function",
    "string",
    "number",
    "parameter",
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

export interface MtrSemanticToken {
    line: number;
    startCharacter: number;
    length: number;
    tokenType: TokenType;
}

interface OffsetRange {
    start: number;
    end: number;
}

interface TextPosition {
    line: number;
    startCharacter: number;
}

const HEADER_BLOCK_RE = /^--- MTRGEN ---\r?\n[\s\S]*?^--- \/MTRGEN ---\s*$/gm;
const HEADER_FIELD_RE = /^(\s*)([A-Za-z_][\w-]*)(\s*:)/gm;
const TEMPLATE_BLOCK_RE = /<#([\s\S]*?)#>|<%([\s\S]*?)%>/g;

const CONTROL_KEYWORDS = new Set<string>([
    "if",
    "elseif",
    "else",
    "endif",
    "for",
    "endfor",
    "first",
    "last",
    "sep",
    "empty",
    "endfirst",
    "endlast",
    "endsep",
    "endempty",
    "of",
    "true",
    "false",
    "null",
]);

const VARIABLE_RE = /\$[A-Za-z_][\w]*/y;
const NUMBER_RE = /-?\d+(?:\.\d+)?\b/y;
const IDENTIFIER_RE = /[A-Za-z_][\w-]*/y;

export const TOKEN_TYPE_INDEX = new Map<TokenType, number>(
    TOKEN_TYPES.map((tokenType, index) => [tokenType, index] as const),
);

const MULTI_CHAR_OPERATORS = ["===", "!==", "==", "!=", "<=", ">=", "&&", "||"] as const;
const SINGLE_CHAR_OPERATORS = new Set<string>(["<", ">", "!", "=", "|"]);
const PUNCTUATION = new Set<string>(["[", "]", "(", ")", "{", "}", ",", ".", ":"]);

function createLineStarts(text: string): number[] {
    const lineStarts = [0];

    for (let index = 0; index < text.length; index += 1) {
        if (text.charCodeAt(index) === 10) {
            lineStarts.push(index + 1);
        }
    }

    return lineStarts;
}

function offsetToPosition(lineStarts: readonly number[], offset: number): TextPosition {
    let low = 0;
    let high = lineStarts.length - 1;

    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const lineStart = lineStarts[middle];
        const nextLineStart =
            middle + 1 < lineStarts.length ? lineStarts[middle + 1] : Number.POSITIVE_INFINITY;

        if (offset < lineStart) {
            high = middle - 1;
            continue;
        }

        if (offset >= nextLineStart) {
            low = middle + 1;
            continue;
        }

        return {
            line: middle,
            startCharacter: offset - lineStart,
        };
    }

    const lastLine = lineStarts.length - 1;
    return {
        line: lastLine,
        startCharacter: Math.max(0, offset - lineStarts[lastLine]),
    };
}

function pushToken(
    tokens: MtrSemanticToken[],
    lineStarts: readonly number[],
    startOffset: number,
    endOffset: number,
    tokenType: TokenType,
): void {
    if (endOffset <= startOffset) {
        return;
    }

    let segmentStart = startOffset;
    while (segmentStart < endOffset) {
        const { line, startCharacter } = offsetToPosition(lineStarts, segmentStart);
        const lineEnd = line + 1 < lineStarts.length ? lineStarts[line + 1] - 1 : Number.POSITIVE_INFINITY;
        const segmentEnd = Math.min(endOffset, lineEnd);

        if (segmentEnd > segmentStart) {
            tokens.push({
                line,
                startCharacter,
                length: segmentEnd - segmentStart,
                tokenType,
            });
        }

        segmentStart = segmentEnd + 1;
    }
}

function addHeaderTokens(tokens: MtrSemanticToken[], text: string, lineStarts: readonly number[]): OffsetRange[] {
    const headerRanges: OffsetRange[] = [];

    for (const match of text.matchAll(HEADER_BLOCK_RE)) {
        const start = match.index ?? 0;
        const end = start + match[0].length;
        headerRanges.push({ start, end });
        pushToken(tokens, lineStarts, start, end, "comment");

        for (const fieldMatch of match[0].matchAll(HEADER_FIELD_RE)) {
            const fieldStart = start + (fieldMatch.index ?? 0) + fieldMatch[1].length;
            const fieldEnd = fieldStart + fieldMatch[2].length;
            pushToken(tokens, lineStarts, fieldStart, fieldEnd, "property");
        }
    }

    return headerRanges;
}

function rangeContains(ranges: readonly OffsetRange[], offset: number): boolean {
    for (const range of ranges) {
        if (offset < range.start) {
            return false;
        }

        if (offset >= range.start && offset < range.end) {
            return true;
        }
    }

    return false;
}

function readString(source: string, startIndex: number): number {
    const quote = source[startIndex];
    let index = startIndex + 1;

    while (index < source.length) {
        const character = source[index];

        if (character === "\\") {
            index += 2;
            continue;
        }

        index += 1;
        if (character === quote) {
            return index;
        }
    }

    return source.length;
}

function matchWord(regex: RegExp, source: string, index: number): RegExpExecArray | null {
    regex.lastIndex = index;
    return regex.exec(source);
}

function addTagTokens(
    tokens: MtrSemanticToken[],
    innerText: string,
    innerStartOffset: number,
    lineStarts: readonly number[],
): void {
    let index = 0;

    while (index < innerText.length) {
        const character = innerText[index];

        if (/\s/.test(character)) {
            index += 1;
            continue;
        }

        if (character === "\"" || character === "'") {
            const stringEnd = readString(innerText, index);
            pushToken(tokens, lineStarts, innerStartOffset + index, innerStartOffset + stringEnd, "string");
            index = stringEnd;
            continue;
        }

        if (character === "|") {
            pushToken(tokens, lineStarts, innerStartOffset + index, innerStartOffset + index + 1, "operator");
            const filterMatch = matchWord(IDENTIFIER_RE, innerText, index + 1);
            if (filterMatch) {
                const filterStart = innerStartOffset + index + 1;
                pushToken(tokens, lineStarts, filterStart, filterStart + filterMatch[0].length, "function");
                index = filterMatch.index + filterMatch[0].length;
            } else {
                index += 1;
            }

            continue;
        }

        const variableMatch = matchWord(VARIABLE_RE, innerText, index);
        if (variableMatch) {
            pushToken(
                tokens,
                lineStarts,
                innerStartOffset + index,
                innerStartOffset + index + variableMatch[0].length,
                "variable",
            );
            index += variableMatch[0].length;
            continue;
        }

        const numberMatch = matchWord(NUMBER_RE, innerText, index);
        if (numberMatch) {
            pushToken(
                tokens,
                lineStarts,
                innerStartOffset + index,
                innerStartOffset + index + numberMatch[0].length,
                "number",
            );
            index += numberMatch[0].length;
            continue;
        }

        const operator = MULTI_CHAR_OPERATORS.find((candidate) => innerText.startsWith(candidate, index));
        if (operator) {
            pushToken(
                tokens,
                lineStarts,
                innerStartOffset + index,
                innerStartOffset + index + operator.length,
                "operator",
            );
            index += operator.length;
            continue;
        }

        if (SINGLE_CHAR_OPERATORS.has(character) || PUNCTUATION.has(character)) {
            pushToken(tokens, lineStarts, innerStartOffset + index, innerStartOffset + index + 1, "operator");
            index += 1;
            continue;
        }

        const identifierMatch = matchWord(IDENTIFIER_RE, innerText, index);
        if (identifierMatch) {
            const tokenType: TokenType = CONTROL_KEYWORDS.has(identifierMatch[0]) ? "keyword" : "parameter";
            pushToken(
                tokens,
                lineStarts,
                innerStartOffset + index,
                innerStartOffset + index + identifierMatch[0].length,
                tokenType,
            );
            index += identifierMatch[0].length;
            continue;
        }

        index += 1;
    }
}

export function tokenizeMtrText(text: string): MtrSemanticToken[] {
    const lineStarts = createLineStarts(text);
    const tokens: MtrSemanticToken[] = [];
    const excludedRanges = addHeaderTokens(tokens, text, lineStarts);

    for (const match of text.matchAll(TEMPLATE_BLOCK_RE)) {
        const start = match.index ?? 0;
        if (rangeContains(excludedRanges, start)) {
            continue;
        }

        const end = start + match[0].length;
        if (match[1] !== undefined) {
            pushToken(tokens, lineStarts, start, end, "comment");
            continue;
        }

        pushToken(tokens, lineStarts, start, start + 2, "operator");
        pushToken(tokens, lineStarts, end - 2, end, "operator");
        addTagTokens(tokens, match[2] ?? "", start + 2, lineStarts);
    }

    tokens.sort((left, right) => {
        if (left.line !== right.line) {
            return left.line - right.line;
        }

        if (left.startCharacter !== right.startCharacter) {
            return left.startCharacter - right.startCharacter;
        }

        return left.length - right.length;
    });

    return tokens;
}
