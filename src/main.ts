import { ChatGPTContext } from "./openaiGpt.js"
import tgBot, { senderOf, errfySender, Sender } from "./tgbot.js"
import { MultiContexts, isGPTModel } from "./openaiGpt.js";
import ChatContexts from "./chatContext.js";

const gptContexts = new MultiContexts();
const chatContexts = new ChatContexts();

async function queryGPTAndResp(ctx: ChatGPTContext, sender: Sender) {
    try {
        const res = (await ctx.send()).data.choices[0].message;
        if (res?.content === undefined) { errfySender(sender)("Invalid response"); return; }
        sender(res.content);
    } catch (err) {
        errfySender(sender)(`Error Requesting GPT: ${err}`);
    }
}

tgBot.on("message", (msg) => {
    const chatId = msg.chat.id;
    chatContexts.ctxOf(chatId).push(msg);
});


tgBot.onText(/\/gptCreate (.+) (.+)/, (msg, match) => {
    const sendMsg = senderOf(tgBot, msg.chat.id);
    const sendErr = errfySender(sendMsg);

    if (match === null) { sendErr("Invalid match"); return; }
    const chatId = msg.chat.id;
    const contextName = match[1];
    const modelName = match[2];

    if (gptContexts.contextOf(contextName) !== undefined) {
        sendErr(`Context ${contextName} already exists.`);
        return;
    }

    if (!isGPTModel(modelName)) {
        sendErr(`Invalid model name ${modelName}.`);
        return;
    }

    gptContexts.newContext(contextName, new ChatGPTContext(modelName));
    sendMsg(`Context ${contextName} created.`);
});

tgBot.onText(/\/gptDelete (.+)/, (msg, match) => {
    const sendMsg = senderOf(tgBot, msg.chat.id);
    const sendErr = errfySender(sendMsg);

    if (match === null) { sendErr("Invalid match"); return; }
    const chatId = msg.chat.id;
    const contextName = match[1];

    if (gptContexts.contextOf(contextName) === undefined) {
        sendErr(`Context ${contextName} does not exist.`);
        return;
    }

    gptContexts.delContext(contextName);
    sendMsg(`Context ${contextName} deleted.`);
});

tgBot.onText(/\/gptList/, (msg, match) => {
    const sendMsg = senderOf(tgBot, msg.chat.id);

    const contextNames = Array.from(gptContexts.contexts.keys());
    sendMsg(`Contexts: ${contextNames.join(", ")}`);
});

tgBot.onText(/\/gptSend (.+) (.+)/, async (msg, match) => {
    const sendMsg = senderOf(tgBot, msg.chat.id);
    const sendErr = errfySender(sendMsg);

    if (match === null) { sendErr("Invalid match"); return; }

    const chatId = msg.chat.id;
    const contextName = match[1];
    const queryContent = match[2];

    const gptContext = gptContexts.contextOf(contextName);
    if (gptContext === undefined) {
        sendErr(`Context ${contextName} does not exist.`);
        return;
    }

    gptContext.add({
        role: "user",
        content: queryContent
    });

    await queryGPTAndResp(gptContext, sendMsg);
});

tgBot.onText(/\/recap (\d+)/, (msg, match) => {
    const sendMsg = senderOf(tgBot, msg.chat.id);
    const sendErr = errfySender(sendMsg);

    if (match === null) { sendErr("Invalid match"); return; }

    const chatId = msg.chat.id;
    const maxLen = parseInt(match[1]);

    const chatContext = chatContexts.ctxOf(chatId);
    const messages = chatContext.slice(-maxLen);

    const recap = messages
    .filter((msg) => msg.text !== undefined && !msg.text.startsWith("/"))
    .map((msg) => {
        if (msg.from?.first_name === undefined) return `Anonymous: ${msg.text}`;
        else return `${msg.from.first_name}: ${msg.text}`;
    }).join("\n");

    sendMsg(recap);
});

tgBot.onText(/\/gptWithContext (.+) (\d+) (.+)/, (msg, match) => {
    const sendMsg = senderOf(tgBot, msg.chat.id);
    const sendErr = errfySender(sendMsg);

    if (match === null) { sendErr("Invalid match"); return; }

    const chatId = msg.chat.id;
    const modelName = match[1];
    const maxLen = parseInt(match[2]);
    const queryContent = match[3];

    if (!isGPTModel(modelName)) { sendErr(`Invalid model name ${modelName}.`); return; }

    const gptContext = new ChatGPTContext(modelName);
    const ctx = chatContexts
    .ctxOf(chatId)
    .slice(-maxLen)
    .filter((msg) => msg.text !== undefined && !msg.text.startsWith("/"))
    .map((msg) => {
        if (msg.from?.first_name === undefined) return `Anonymous: ${msg.text}`;
        else return `${msg.from.first_name}: ${msg.text}`;
    }).join("\n");

    gptContext.add({
        role: "user",
        content: ctx
    });

    const query = "According to the above conversation, answer the following question:\n" + queryContent;
    gptContext.add({
        role: "user",
        content: query
    });

    queryGPTAndResp(gptContext, sendMsg);

});
