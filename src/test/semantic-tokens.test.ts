import assert = require("node:assert/strict");
import test = require("node:test");

import { tokenizeMtrText } from "../semantic-tokens";

test("tokenizes header fields and template tags", () => {
    const template = `--- MTRGEN ---
name: token
filename: token.clar
--- /MTRGEN ---

contract <% if $fungible %>ft<% else %>nft<% endif %>
`;

    const tokenTypes = tokenizeMtrText(template).map((token) => token.tokenType);

    assert.ok(tokenTypes.includes("comment"));
    assert.ok(tokenTypes.includes("property"));
    assert.ok(tokenTypes.includes("operator"));
    assert.ok(tokenTypes.includes("keyword"));
    assert.ok(tokenTypes.includes("variable"));
});
