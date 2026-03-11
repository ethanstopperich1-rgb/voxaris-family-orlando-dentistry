/**
 * tool-calls Handler
 *
 * VAPI sends tool-calls when the LLM wants to execute a function.
 * We route each tool call to the appropriate handler and return results.
 *
 * Response format:
 * {
 *   results: [
 *     { name: "tool_name", toolCallId: "tc_xxx", result: "{...}" }
 *   ]
 * }
 *
 * Note: `result` must be a JSON string, not an object.
 */

const { handleToolCall } = require("../lib/tool-handlers");

async function handleToolCalls(body) {
  const call = body.message?.call || {};
  const callId = call.id || "unknown";
  const toolCallList = body.message?.toolCallList || [];

  if (toolCallList.length === 0) {
    console.warn(`[tool-calls] Empty toolCallList for call ${callId}`);
    return { results: [] };
  }

  const results = [];

  for (const tc of toolCallList) {
    // Defensive: VAPI may nest under tc.function.name / tc.function.arguments
    // Arguments can arrive as a JSON string or already-parsed object
    const toolCallId = tc.id || tc.toolCallId;
    const toolName = tc.name || tc.function?.name;
    const rawArgs = tc.parameters || tc.function?.arguments;
    const parameters = rawArgs
      ? typeof rawArgs === "string"
        ? JSON.parse(rawArgs)
        : rawArgs
      : {};

    console.log(
      `[tool-calls] call=${callId} tool=${toolName} tcId=${toolCallId}`
    );

    try {
      const result = await handleToolCall(callId, toolName, parameters || {});

      results.push({
        name: toolName,
        toolCallId,
        result: JSON.stringify(result),
      });
    } catch (err) {
      console.error(
        `[tool-calls] Error in ${toolName} for call ${callId}:`,
        err.message
      );

      results.push({
        name: toolName,
        toolCallId,
        result: JSON.stringify({
          success: false,
          error: "Internal tool error. The team will follow up.",
        }),
      });
    }
  }

  return { results };
}

module.exports = { handleToolCalls };
