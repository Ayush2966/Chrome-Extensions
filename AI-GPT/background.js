(async () => {
    const MAX_CHUNCKS = 10; 
    const MAX_HOURS_ACCESS_TOKEN = 1; 
    const BASE_URL = "https://chat.openai.com/";
    const API_CONVERSATION = "backend-api/conversation";
    const GPT_MODEL = 'text-davinci-002-render-sha'; 
    const hasCrypto = typeof crypto !== 'undefined';
    const randomUUID = hasCrypto && crypto.randomUUID && crypto.randomUUID.bind(crypto);
    const FIRST_USER_MESSAGE_INDEX = 1;
    const ABSTRACT_MESSAGE_INDEX = 2;
    const OUTPUT_RECEIVE_DATA = false;
    /////////////////////////////////////////////////////////////
    const defaultLanguageName = 'English';
    function getLanguageName(languageCode) {
        const languageMap = {
            'ar': 'Arabic',
            'am': 'Amharic',
            'bg': 'Bulgarian',
            'bn': 'Bengali',
            'ca': 'Catalan',
            'cs': 'Czech',
            'da': 'Danish',
            'de': 'German',
            'el': 'Greek',
            'en': 'English',
            'en_GB': 'English',
            'en_US': 'English',
            'en-GB': 'English',
            'en-US': 'English',
            'es': 'Spanish',
            'es_419': 'Spanish',
            'et': 'Estonian',
            'fa': 'Persian',
            'fi': 'Finnish',
            'fil': 'Filipino',
            'fr': 'French',
            'gu': 'Gujarati',
            'he': 'Hebrew',
            'hi': 'Hindi',
            'hr': 'Croatian',
            'hu': 'Hungarian',
            'id': 'Indonesian',
            'it': 'Italian',
            'ja': 'Japanese',
            'kn': 'Kannada',
            'ko': 'Korean',
            'lt': 'Lithuanian',
            'lv': 'Latvian',
            'ml': 'Malayalam',
            'mr': 'Marathi',
            'ms': 'Malay',
            'nl': 'Dutch',
            'no': 'Norwegian',
            'pl': 'Polish',
            'pt_BR': 'Portuguese',
            'pt_PT': 'Portuguese',
            'pt-BR': 'Portuguese',
            'pt-PT': 'Portuguese',
            'ro': 'Romanian',
            'ru': 'Russian',
            'sk': 'Slovak',
            'sl': 'Slovenian',
            'sr': 'Serbian',
            'sv': 'Swedish',
            'sw': 'Swahili',
            'ta': 'Tamil',
            'te': 'Telugu',
            'th': 'Thai',
            'tr': 'Turkish',
            'uk': 'Ukrainian',
            'vi': 'Vietnamese',
            'zh_CN': 'Chinese',
            'zh_TW': 'Chinese',
            'zh-CN': 'Chinese',
            'zh-TW': 'Chinese',
            'zh': 'Chinese',
        };
        return languageMap[languageCode] || defaultLanguageName;
    }
    const browserLanguageCode = chrome.i18n.getUILanguage();
    const browserLanguageName = getLanguageName(browserLanguageCode);
    console.log('Default UI language:', browserLanguageCode, browserLanguageName);

    const defaultOptions = {
        summaryPrompt: chrome.i18n.getMessage("summaryPrompt").trim(),
        translationTo: {
            bEnable: browserLanguageName===defaultLanguageName?false:true,
            languageName: browserLanguageName===defaultLanguageName?"":browserLanguageName
        },
        continuePrompt: {
            bEnable: true,
            prompt: chrome.i18n.getMessage("continuePrompt").trim()
        }
    };
    let currentOptions;
    await (async () => {
        try {
            await chrome.storage.sync.set({ defaultOptions: defaultOptions });
            const data = await chrome.storage.sync.get();
            console.log("set Default options:", data.defaultOptions);
            if (data.currentOptions) {
                currentOptions = data.currentOptions;
                console.log("read Current options:", data.currentOptions);
            }
            else {
                currentOptions = defaultOptions;
                await chrome.storage.sync.set({ currentOptions: currentOptions });
                const data = await chrome.storage.sync.get();
                console.log("set Current options:", data.currentOptions);
            }
        } catch (error) {
            console.error(error);
        }
    })();
    let getRandomValues;
    const rnds8 = new Uint8Array(16);
    function generateRandomUint8Array() {
        if (!getRandomValues) {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                getRandomValues = crypto.getRandomValues.bind(crypto);
            } else {
                throw new Error('crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported');
            }
        }
        return getRandomValues(rnds8);
    }
    const byteToHex = [];
    for (let i = 0; i < 256; ++i) {
        byteToHex.push((i + 0x100).toString(16).slice(1));
    }
    function stringifyUUID(arr, offset = 0) {
        return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
    }
    function generateUUIDv4(options, buf, offset) {
        if (randomUUID && !buf && !options) {
            return randomUUID();
        }
        options = options || {};
        const rnds = options.random || (options.rng || generateRandomUint8Array)(); 
        rnds[6] = rnds[6] & 0x0f | 0x40;
        rnds[8] = rnds[8] & 0x3f | 0x80; 
        if (buf) {
            offset = offset || 0;
            for (let i = 0; i < 16; ++i) {
                buf[offset + i] = rnds[i];
            }
            return buf;
        }
        return stringifyUUID(rnds);
    }
    function isEmpty(obj) {
        if (obj == null) return true; 
        if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
        for (let key in obj) {
            if (hasOwnProperty.call(obj, key)) {
                return false;
            }
        }
        return true;
    }
    /*
    The MIT License (MIT)
    Copyright (c) 2012 Fabiën Tesselaar
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    https://github.com/Tessmore/sbd
    */
    (function (f) {
        if (typeof exports === "object" && typeof module !== "undefined") {
            module.exports = f()
        } else if (typeof define === "function" && define.amd) {
            define([], f)
        } else {
            var g;
            if (typeof window !== "undefined") {
                g = window
            } else if (typeof global !== "undefined") {
                g = global
            } else if (typeof self !== "undefined") {
                g = self
            } else {
                g = this
            }
            g.tokenizer = f()
        }
    })(function () {
        var define, module, exports;
        return function () {
            function r(e, n, t) {
                function o(i, f) {
                    if (!n[i]) {
                        if (!e[i]) {
                            var c = "function" == typeof require && require;
                            if (!f && c) return c(i, !0);
                            if (u) return u(i, !0);
                            var a = new Error("Cannot find module '" + i + "'");
                            throw a.code = "MODULE_NOT_FOUND", a
                        }
                        var p = n[i] = {
                            exports: {}
                        };
                        e[i][0].call(p.exports, function (r) {
                            var n = e[i][1][r];
                            return o(n || r)
                        }, p, p.exports, r, e, n, t)
                    }
                    return n[i].exports
                }
                for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
                return o
            }
            return r
        }()({
            1: [function (require, module, exports) {
                var abbreviations;
                var englishAbbreviations = ["al", "adj", "assn", "Ave", "BSc", "MSc", "Cell", "Ch", "Co", "cc", "Corp", "Dem", "Dept", "ed", "eg", "Eq", "Eqs", "est", "est", "etc", "Ex", "ext", "Fig", "fig", "Figs", "figs", "i.e", "ie", "Inc", "inc", "Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec", "jr", "mi", "Miss", "Mrs", "Mr", "Ms", "Mol", "mt", "mts", "no", "Nos", "PhD", "MD", "BA", "MA", "MM", "pl", "pop", "pp", "Prof", "Dr", "pt", "Ref", "Refs", "Rep", "repr", "rev", "Sec", "Secs", "Sgt", "Col", "Gen", "Rep", "Sen", "Gov", "Lt", "Maj", "Capt", "St", "Sr", "sr", "Jr", "jr", "Rev", "Sun", "Mon", "Tu", "Tue", "Tues", "Wed", "Th", "Thu", "Thur", "Thurs", "Fri", "Sat", "trans", "Univ", "Viz", "Vol", "vs", "v"];
                exports.setAbbreviations = function (abbr) {
                    if (abbr) {
                        abbreviations = abbr
                    } else {
                        abbreviations = englishAbbreviations
                    }
                };
                var isCapitalized = exports.isCapitalized = function (str) {
                    return /^[A-Z][a-z].*/.test(str) || isNumber(str)
                };
                exports.isSentenceStarter = function (str) {
                    return isCapitalized(str) || /``|"|'/.test(str.substring(0, 2))
                };
                exports.isCommonAbbreviation = function (str) {
                    var noSymbols = str.replace(/[-'`~!@#$%^&*()_|+=?;:'",.<>\{\}\[\]\\\/]/gi, "");
                    return ~abbreviations.indexOf(noSymbols)
                };
                exports.isTimeAbbreviation = function (word, next) {
                    if (word === "a.m." || word === "p.m.") {
                        var tmp = next.replace(/\W+/g, "").slice(-3).toLowerCase();
                        if (tmp === "day") {
                            return true
                        }
                    }
                    return false
                };
                exports.isDottedAbbreviation = function (word) {
                    var matches = word.replace(/[\(\)\[\]\{\}]/g, "").match(/(.\.)*/);
                    return matches && matches[0].length > 0
                };
                exports.isCustomAbbreviation = function (str) {
                    if (str.length <= 3) {
                        return true
                    }
                    return isCapitalized(str)
                };
                exports.isNameAbbreviation = function (wordCount, words) {
                    if (words.length > 0) {
                        if (wordCount < 5 && words[0].length < 6 && isCapitalized(words[0])) {
                            return true
                        }
                        var capitalized = words.filter(function (str) {
                            return /[A-Z]/.test(str.charAt(0))
                        });
                        return capitalized.length >= 3
                    }
                    return false
                };
                var isNumber = exports.isNumber = function (str, dotPos) {
                    if (dotPos) {
                        str = str.slice(dotPos - 1, dotPos + 2)
                    }
                    return !isNaN(str)
                };
                exports.isPhoneNr = function (str) {
                    return str.match(/^(?:(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?$/)
                };
                exports.isURL = function (str) {
                    return str.match(/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/)
                };
                exports.isConcatenated = function (word) {
                    var i = 0;
                    if ((i = word.indexOf(".")) > -1 || (i = word.indexOf("!")) > -1 || (i = word.indexOf("?")) > -1) {
                        var c = word.charAt(i + 1);
                        if (c.match(/[a-zA-Z].*/)) {
                            return [word.slice(0, i), word.slice(i + 1)]
                        }
                    }
                    return false
                };
                exports.isBoundaryChar = function (word) {
                    return word === "." || word === "!" || word === "?"
                }
            }, {}],
            2: [function (require, module, exports) {
                module.exports = function sanitizeHtml(text, opts) {
                    if ((typeof text == "string" || text instanceof String) && typeof document !== "undefined") {
                        var $div = document.createElement("DIV");
                        $div.innerHTML = text;
                        text = ($div.textContent || "").trim()
                    } else if (typeof text === "object" && text.textContent) {
                        text = (text.textContent || "").trim()
                    }
                    return text
                }
            }, {}],
            3: [function (require, module, exports) {
                exports.endsWithChar = function ends_with_char(word, c) {
                    if (c.length > 1) {
                        return c.indexOf(word.slice(-1)) > -1
                    }
                    return word.slice(-1) === c
                };
                exports.endsWith = function ends_with(word, end) {
                    return word.slice(word.length - end.length) === end
                }
            }, {}],
            4: [function (require, module, exports) {
                var sanitizeHtml = require("sanitize-html");
                var stringHelper = require("./stringHelper");
                var Match = require("./Match");
                var newline_placeholder = " @~@ ";
                var newline_placeholder_t = newline_placeholder.trim();
                var whiteSpaceCheck = new RegExp("\\S", "");
                var addNewLineBoundaries = new RegExp("\\n+|[-#=_+*]{4,}", "g");
                var splitIntoWords = new RegExp("\\S+|\\n", "g");
                exports.sentences = function (text, user_options) {
                    if (!text || typeof text !== "string" || !text.length) {
                        return []
                    }
                    if (!whiteSpaceCheck.test(text)) {
                        return []
                    }
                    var options = {
                        newline_boundaries: false,
                        html_boundaries: false,
                        html_boundaries_tags: ["p", "div", "ul", "ol"],
                        sanitize: false,
                        allowed_tags: false,
                        preserve_whitespace: false,
                        abbreviations: null
                    };
                    if (typeof user_options === "boolean") {
                        options.newline_boundaries = true
                    } else {
                        for (var k in user_options) {
                            options[k] = user_options[k]
                        }
                    }
                    Match.setAbbreviations(options.abbreviations);
                    if (options.newline_boundaries) {
                        text = text.replace(addNewLineBoundaries, newline_placeholder)
                    }
                    if (options.html_boundaries) {
                        var html_boundaries_regexp = "(<br\\s*\\/?>|<\\/(" + options.html_boundaries_tags.join("|") + ")>)";
                        var re = new RegExp(html_boundaries_regexp, "g");
                        text = text.replace(re, "$1" + newline_placeholder)
                    }
                    if (options.sanitize || options.allowed_tags) {
                        if (!options.allowed_tags) {
                            options.allowed_tags = [""]
                        }
                        text = sanitizeHtml(text, {
                            allowedTags: options.allowed_tags
                        })
                    }
                    var words;
                    var tokens;
                    if (options.preserve_whitespace) {
                        tokens = text.split(/(<br\s*\/?>|\S+|\n+)/);
                        words = tokens.filter(function (token, ii) {
                            return ii % 2
                        })
                    } else {
                        words = text.trim().match(splitIntoWords)
                    }
                    var wordCount = 0;
                    var index = 0;
                    var temp = [];
                    var sentences = [];
                    var current = [];
                    if (!words || !words.length) {
                        return []
                    }
                    for (var i = 0, L = words.length; i < L; i++) {
                        wordCount++;
                        current.push(words[i]);
                        if (~words[i].indexOf(",")) {
                            wordCount = 0
                        }
                        if (Match.isBoundaryChar(words[i]) || stringHelper.endsWithChar(words[i], "?!") || words[i] === newline_placeholder_t) {
                            if ((options.newline_boundaries || options.html_boundaries) && words[i] === newline_placeholder_t) {
                                current.pop()
                            }
                            sentences.push(current);
                            wordCount = 0;
                            current = [];
                            continue
                        }
                        if (stringHelper.endsWithChar(words[i], '"') || stringHelper.endsWithChar(words[i], "”")) {
                            words[i] = words[i].slice(0, -1)
                        }
                        if (stringHelper.endsWithChar(words[i], ".")) {
                            if (i + 1 < L) {
                                if (words[i].length === 2 && isNaN(words[i].charAt(0))) {
                                    continue
                                }
                                if (Match.isCommonAbbreviation(words[i])) {
                                    continue
                                }
                                if (Match.isSentenceStarter(words[i + 1])) {
                                    if (Match.isTimeAbbreviation(words[i], words[i + 1])) {
                                        continue
                                    }
                                    if (Match.isNameAbbreviation(wordCount, words.slice(i, 6))) {
                                        continue
                                    }
                                    if (Match.isNumber(words[i + 1])) {
                                        if (Match.isCustomAbbreviation(words[i])) {
                                            continue
                                        }
                                    }
                                } else {
                                    if (stringHelper.endsWith(words[i], "..")) {
                                        continue
                                    }
                                    if (Match.isDottedAbbreviation(words[i])) {
                                        continue
                                    }
                                    if (Match.isNameAbbreviation(wordCount, words.slice(i, 5))) {
                                        continue
                                    }
                                }
                            }
                            sentences.push(current);
                            current = [];
                            wordCount = 0;
                            continue
                        }
                        if ((index = words[i].indexOf(".")) > -1) {
                            if (Match.isNumber(words[i], index)) {
                                continue
                            }
                            if (Match.isDottedAbbreviation(words[i])) {
                                continue
                            }
                            if (Match.isURL(words[i]) || Match.isPhoneNr(words[i])) {
                                continue
                            }
                        }
                        if (temp = Match.isConcatenated(words[i])) {
                            current.pop();
                            current.push(temp[0]);
                            sentences.push(current);
                            current = [];
                            wordCount = 0;
                            current.push(temp[1])
                        }
                    }
                    if (current.length) {
                        sentences.push(current)
                    }
                    sentences = sentences.filter(function (s) {
                        return s.length > 0
                    });
                    var result = sentences.slice(1).reduce(function (out, sentence) {
                        var lastSentence = out[out.length - 1];
                        if (lastSentence.length === 1 && /^.{1,2}[.]$/.test(lastSentence[0])) {
                            if (!/[.]/.test(sentence[0])) {
                                out.pop();
                                out.push(lastSentence.concat(sentence));
                                return out
                            }
                        }
                        out.push(sentence);
                        return out
                    }, [sentences[0]]);
                    return result.map(function (sentence, ii) {
                        if (options.preserve_whitespace && !options.newline_boundaries && !options.html_boundaries) {
                            var tokenCount = sentence.length * 2;
                            if (ii === 0) {
                                tokenCount += 1
                            }
                            return tokens.splice(0, tokenCount).join("")
                        }
                        return sentence.join(" ")
                    })
                }
            }, {
                "./Match": 1,
                "./stringHelper": 3,
                "sanitize-html": 2
            }]
        }, {}, [4])(4)
    });
    async function deleteConversation(conversationId, token) {
        if (conversationId && conversationstate.isActive(conversationId)) {
            conversationstate.setActive(conversationId, false);
            const url = BASE_URL + API_CONVERSATION + `/${conversationId}`;
            try {
                const response = await fetch(url, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ is_visible: false })
                });
                if (response.ok) {
                    console.log(`Conversation deleted successfully. conversationId: ${conversationId}`);
                } else {
                    console.error("url: " + url);
                    console.error("response.status: " + response.status);
                    console.error(`Failed to delete conversation. conversationId: ${conversationId}`);
                    const contentType = response.headers.get("Content-Type");
                    console.error("contentType: " + contentType);
                    if (contentType.includes("application/json")) {
                        const data = await response.json();
                        console.error("data: " + data);
                    }
                }
            } catch (error) {
                console.error(error);
            }
        }
    }
    var cloudflareWindowId; 
    var globalAccessToken = null;
    var lastTokenTime = null;
    async function getAccessToken() {
        const now = new Date().getTime();
        if (globalAccessToken && lastTokenTime && (now - lastTokenTime < MAX_HOURS_ACCESS_TOKEN * 60 * 60 * 1000)) {
            console.log("使用缓存globalAccessToken");
            return globalAccessToken;
        }
        const url = BASE_URL + `api/auth/session`;
        let response = await fetch(url);
        const contentType = response.headers.get("Content-Type");
        console.log("getAccessToken() response.status: " + response.status);
        console.log("getAccessToken() response.headers contentType: " + contentType);
        if (response.status === 403 && contentType.includes("text/html")) {
            console.log('Cloudflare verification...');
            response = await waitForUserAuthentication(url);
            console.log("waitForUserAuthentication: ", response);
            if (response.statusCode === 200) {
                response = await fetch(url); 
            }
            else {
                lastTokenTime = null;
                throw new Error('UNAUTHORIZED');
            }
        }
        const data = await response.json().catch(() => ({}));
        if (!data.accessToken) {
            lastTokenTime = null;
            throw new Error('UNAUTHORIZED');
        }
        console.log("重新获取AccessToken");
        globalAccessToken = data.accessToken;
        lastTokenTime = now;
        return data.accessToken;
    }
    async function waitForUserAuthentication(url) {
        return new Promise((resolve, reject) => {
            chrome.windows.create({
                url: url,
                type: 'popup',
                focused: true,
                width: 500,
                height: 400,
            }, (veriwindow) => {
                let isProgrammaticClose = false;
                const filter = {
                    urls: [url],
                    windowId: veriwindow.id
                };
                chrome.webRequest.onCompleted.addListener((details) => {
                    console.log("chrome.webRequest.onCompleted: ", details);
                    if (details.tabId === veriwindow.tabs[0].id) {
                        chrome.windows.remove(veriwindow.id, () => {
                            isProgrammaticClose = true;
                        });
                        resolve(details);
                    }
                }, filter);
                chrome.windows.onRemoved.addListener((windowId) => {
                    if (isProgrammaticClose) {
                        console.log(`Window ${windowId} was closed programmatically using chrome.windows.remove().`);
                        isProgrammaticClose = false; 
                    } else {
                        if (windowId === veriwindow.id) {
                            console.log(`Verification window ${windowId} closed by the user before completion!`);
                            lastTokenTime = null;
                            reject(new Error('UNAUTHORIZED'));
                        }
                    }
                });
            });
        });
    }
    class Author {
        constructor({ role, name, metadata }) {
            this.role = role || ''; 
            this.name = name || null;
            this.metadata = metadata || {};
        }
    }
    class Content {
        constructor({ contentType, parts }) {
            this.content_type = contentType || "text";
            this.parts = parts || [""];
        }
    }
    class Message {
        constructor({ id, author, content }) {
            if (!(author instanceof Author)) {
                throw new Error('Error: author must be an instance of Author');
            }
            if (!(content instanceof Content)) {
                throw new Error('Error: content must be an instance of Content');
            }
            this.id = id || generateUUIDv4();
            this.author = author;
            this.content = content;
        }
    }
    class SendData {
        constructor({ action, messages, conversation_id, parent_message_id, model, timezone_offset_min }) {
            if (!messages.every(msg => msg instanceof Message)) {
                throw new Error('Error: The messages array contains invalid objects!');
            }
            this.action = action || "next"; 
            this.messages = messages || []; 
            this.conversation_id = conversation_id || null;
            this.parent_message_id = parent_message_id || generateUUIDv4();
            this.model = model || GPT_MODEL;
            this.timezone_offset_min = timezone_offset_min || new Date().getTimezoneOffset();
        }
    }
    class ReceiveMessage extends Message {
        constructor({ id, author, content, create_time, update_time, end_turn, weight, metadata, recipient }) {
            super({ id, author, content });
            this.create_time = create_time || null;
            this.update_time = update_time || null;
            this.end_turn = end_turn || null;
            this.weight = weight || null;
            this.metadata = metadata || {};
            this.recipient = recipient || null;
        }
    }
    class ReceiveData {
        constructor({ receivemessage, conversation_id, error }) {
            if (!(receivemessage instanceof ReceiveMessage)) {
                throw new Error('receivemessage must be an instance of ReceiveMessage');
            }
            this.message = receivemessage;
            this.conversation_id = conversation_id;
            this.error = error || null;
        }
    }
    class ConversationState {
        constructor() {
            this.currentTabId = null;
            this.tabConversation = {}; 
            this.conversations = {}; 
            this.returnTexts = ''; 
            this.longTextState = { 
                bOngoing: false,
                conversationId: null
            };
        }
        removeTab(tabId) {
            if (this.tabConversation.hasOwnProperty(tabId)) {
                delete this.tabConversation[tabId];
                console.log(`Removed key(tabId) ${tabId} from tabConversation`);
            }
        }
        setCurrentTab(tabId) {
            this.currentTabId = tabId;
            if (!this.tabConversation.hasOwnProperty(tabId)) { 
                this.setConversationId(null);
            }
        }
        updateCurrentTab(tabId) {
            this.removeTab(tabId); 
            this.setCurrentTab(tabId);
        }
        setConversationId(conversationId) {
            if (this.currentTabId) {
                this.tabConversation[this.currentTabId] = conversationId;
            }
        }
        getConversationIdInCurrentTab() {
            if (this.currentTabId && this.tabConversation[this.currentTabId]) {
                return this.tabConversation[this.currentTabId];
            }
            else {
                return null;
            }
        }
        toReceiveData(data) {
            const author = new Author({
                role: data.message.author.role,
                name: data.message.author.name,
                metadata: data.message.author.metadata
            });
            const content = new Content({
                content_type: data.message.content.content_type,
                parts: data.message.content.parts
            });
            const rmessage = new ReceiveMessage({
                id: data.message.id,
                author: author,
                content: content,
                create_time: data.message.create_time,
                update_time: data.message.update_time,
                end_turn: data.message.end_turn,
                weight: data.message.weight,
                metadata: data.message.metadata,
                recipient: data.message.recipient
            });
            const rdata = new ReceiveData({
                receivemessage: rmessage,
                conversation_id: data.conversation_id,
                error: data.error
            });
            return rdata;
        }
        addConversation(data) { 
            if (!(data instanceof ReceiveData)) {
                throw new Error('data must be an instance of ReceiveData');
            }
            const conversation = {
                ownerTabId: conversationstate.currentTabId,
                conversation_id: data.conversation_id,
                parent_message_id: data.message.id,
                dataQueue: [data],
                dataQueueIndex: { receive: [0], send: [] }, 
                ongoing: true, 
                active: true, 
            };
            if (conversationstate.longTextState.bOngoing) {
                conversationstate.longTextState.conversationId = data.conversation_id;
            }
            this.setConversationId(data.conversation_id);
            this.conversations[data.conversation_id] = conversation;
            return conversation;
        }
        addData(data) {
            if (!data) {
                console.log('No data !');
                return;
            }
            if (!data.conversation_id) {
                console.log('addData: No conversation_id !', data.conversation_id);
                return;
            }
            let conversation = this.getConversation(data.conversation_id);
            if (!conversation) {
                conversation = this.addConversation(data); 
            }
            else { 
                conversation.conversation_id = data.conversation_id;
                if (data instanceof ReceiveData) {
                    conversation.parent_message_id = data.message.id;
                    this.setOngoing(true);
                    const lastdata = conversation.dataQueue[conversation.dataQueue.length - 1];
                    if (lastdata instanceof ReceiveData &&
                        lastdata.message.id === data.message.id) {
                        conversation.dataQueue.pop();
                        conversation.dataQueueIndex.receive.pop();
                    }
                    conversation.dataQueue.push(data);
                    const idx = conversation.dataQueue.length - 1;
                    conversation.dataQueueIndex.receive.push(idx);
                }
                if (data instanceof SendData) {
                    conversation.dataQueue.push(data);
                    const idx = conversation.dataQueue.length - 1;
                    conversation.dataQueueIndex.send.push(idx);
                }
            }
        }
        deleteData(data) {
            if (!data) {
                console.log('No data to delete !');
                return;
            }
            if (!data.conversation_id) {
                console.log('deleteData: No conversation_id in deleting !', data.conversation_id);
                return;
            }
            let conversation = this.getConversation(data.conversation_id);
            if (conversation) {
                const index = conversation.dataQueue.indexOf(data);
                if (index > -1) {
                    conversation.dataQueue.splice(index, 1);
                }
                else {
                    console.log('Not found data in deleting !');
                }
            }
        }
        setOngoing(ongoing) { 
            const conversation = this.getConversation(this.getConversationIdInCurrentTab());
            if (conversation) {
                conversation.ongoing = ongoing;
            }
        }
        getOngoing() { 
            const conversation = this.getConversation(this.getConversationIdInCurrentTab());
            if (conversation) {
                return conversation.ongoing;
            }
            else {
                return false;
            }
        }
        setActive(conversation_id, active) { 
            const conversation = this.getConversation(conversation_id);
            if (conversation) {
                conversation.active = active;
            }
        }
        isActive(conversation_id) { 
            const conversation = this.getConversation(conversation_id);
            if (conversation) {
                return conversation.active;
            }
            else {
                return false;
            }
        }
        getConversation(conversation_id) {
            if (this.conversations[conversation_id]) {
                return this.conversations[conversation_id];
            }
            else {
                return null;
            }
        }
        getCurrentConversation() {
            return this.getConversation(this.getConversationIdInCurrentTab());
        }
    }
    let conversationstate = new ConversationState();
    var fetchController = null;
    let onUpdatedCtrlHoverListenerAdded = false;
    chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
        if (request.message === "CtrlHover") {
            console.log('CtrlHover');
        }
    });
    chrome.action.onClicked.addListener((tab) => {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
        }).then(() => { 
            console.log("点击工具栏图标：BEFORE chrome.tabs.sendMessage")
            chrome.tabs.sendMessage(tab.id, { type: "content_main" });
            console.log("点击工具栏图标：AFTER chrome.tabs.sendMessage")
        }).catch((error) => {
            console.log(`Error executing script: ${error.message}`);
        });
    });
    function listenCtrlHover(tabId) {
        /* need "host_permissions": ["<all_urls>"]
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                let hoveredLink = null;
                let isCtrlKeyDown = true;
                
                function onMouseOver(e) {
                    if (e.target.tagName === 'A') {
                        hoveredLink = e.target.href;
                    }
                }               
                function onMouseOut(e) {
                    if (e.target.tagName === 'A') {
                        hoveredLink = null;
                    }
                }
                function onKeyDown(e) {
                    if (e.key === 'Control') {
                        if (isCtrlKeyDown && hoveredLink !== null) {
                            console.log('Link hovered with Ctrl pressed: ' + hoveredLink);
                            isCtrlKeyDown = false;
                            chrome.runtime.sendMessage({ message: "CtrlHover", hoveredLink: hoveredLink });
                        }
                    }
                }
                function onKeyUp(e) { 
                    if (e.key === 'Control') {
                        isCtrlKeyDown = true;
                    }
                }
                
                if (!window.isListenerAdded) {
                    document.addEventListener('mouseover', onMouseOver);
                    document.addEventListener('mouseout', onMouseOut);
                    document.addEventListener('keyup', onKeyUp);
                    document.addEventListener('keydown', onKeyDown);
                    window.isListenerAdded = true;
                }
                else {
                    console.log("Listener already added ...");
                }
            }
        }).then(() => { 
        }).catch((error) => {
            console.log(error);
        });*/
    }
    chrome.tabs.onActivated.addListener(function (activeInfo) {
        chrome.tabs.get(activeInfo.tabId, function (tab) {
            if (tab.status === 'complete') { 
                conversationstate.setCurrentTab(tab.id);
                //listenCtrlHover(tab.id);
            }
        });
    });
    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        if (tab.active && tab.status === 'complete') {
            if (tab.url && /^http(s)?:\/\//.test(tab.url)) { 
                conversationstate.updateCurrentTab(tab.id); 
                //listenCtrlHover(tab.id);
            }
        }
    });
    chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
        console.log(`Tab ${tabId} was closed with windowId ${removeInfo.windowId}`);
        conversationstate.removeTab(tabId);
    });
    async function* streamAsyncIterable(stream) {
        const reader = stream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    return;
                }
                yield value;
            }
        }
        finally {
            reader.releaseLock();
        }
    }
    const BOM = [239, 187, 191];
    function hasBom(buffer) {
        return BOM.every((charCode, index) => buffer.charCodeAt(index) === charCode);
    }
    function createParser(onParse) {
        let isFirstChunk;
        let buffer;
        let startingPosition; 
        let startingFieldLength; 
        let eventId;
        let eventName;
        let data;
        reset();
        return {
            feed,
            reset
        };
        function reset() {
            isFirstChunk = true;
            buffer = "";
            startingPosition = 0; 
            startingFieldLength = -1;
            eventId = void 0;
            eventName = void 0; 
            data = "";
        }
        function feed(chunk) {
            buffer = buffer ? buffer + chunk : chunk;
            if (isFirstChunk && hasBom(buffer)) {
                buffer = buffer.slice(BOM.length);
            }
            isFirstChunk = false;
            const length = buffer.length;
            let position = 0; 
            let discardTrailingNewline = false; 
            while (position < length) {
                if (discardTrailingNewline) {
                    if (buffer[position] === "\n") {
                        ++position;
                    }
                    discardTrailingNewline = false;
                }
                let lineLength = -1; 
                let fieldLength = startingFieldLength; 
                let character;
                for (let index = startingPosition; lineLength < 0 && index < length; ++index) {
                    character = buffer[index];
                    if (character === ":" && fieldLength < 0) { 
                        fieldLength = index - position;
                    } else if (character === "\r") { 
                        discardTrailingNewline = true;
                        lineLength = index - position; 
                    } else if (character === "\n") {
                        lineLength = index - position;
                    }
                }
                if (lineLength < 0) { 
                    startingPosition = length - position; 
                    startingFieldLength = fieldLength;
                    break;
                } else {
                    startingPosition = 0;
                    startingFieldLength = -1;
                }
                parseEventStreamLine(buffer, position, fieldLength, lineLength);
                position += lineLength + 1;
            }
            if (position === length) { 
                buffer = "";
            } else if (position > 0) { 
                buffer = buffer.slice(position);
            }
        }
        function parseEventStreamLine(lineBuffer, index, fieldLength, lineLength) {
            if (lineLength === 0) {
                if (data.length > 0) { 
                    onParse({
                        type: "event",
                        id: eventId,
                        event: eventName || void 0,
                        data: data.slice(0, -1)
                    });
                    data = "";
                    eventId = void 0; 
                }
                eventName = void 0; 
                return;
            }
            const noValue = fieldLength < 0;
            const field = lineBuffer.slice(index, index + (noValue ? lineLength : fieldLength));
            let step = 0;
            if (noValue) {
                step = lineLength;
            } else if (lineBuffer[index + fieldLength + 1] === " ") { 
                step = fieldLength + 2;
            } else {
                step = fieldLength + 1;
            }
            const position = index + step;
            const valueLength = lineLength - step;
            const value = lineBuffer.slice(position, position + valueLength).toString();
            if (field === "data") {
                data += value ? "".concat(value, "\n") : "\n";
            } else if (field === "event") {
                eventName = value;
            } else if (field === "id" && !value.includes("\0")) { 
                eventId = value;
            } else if (field === "retry") {
                const retry = parseInt(value, 10); 
                if (!Number.isNaN(retry)) {
                    onParse({
                        type: "reconnect-interval",
                        value: retry
                    });
                }
            }
        }
    }
    async function fetchSSE(resource, options) {
        const { onMessage, ...fetchOptions } = options;
        const resp = await fetch(resource, fetchOptions);
        if (!resp.ok) {
            const error = await resp.json().catch(() => ({}));
            throw new Error(!isEmpty(error) ? JSON.stringify(error) : `${resp.status} ${resp.statusText}`);
        }
        const parser = createParser((event) => {
            if (event.type === 'event' && event.event !== 'ping') {
                onMessage(event.data);
            }
        });
        for await (const chunk of streamAsyncIterable(resp.body)) {
            const str = new TextDecoder().decode(chunk);
            parser.feed(str);
        }
    }
    function getRequestBody(role, prompt, parent_message_id_flag, including_message_flag) {
        const author = new Author({ role: role });
        const content = new Content({ parts: [prompt] });
        const message = new Message({
            author: author,
            content: content
        });
        let senddataobj = {};
        if (including_message_flag === 'ONLY_CURRENT_USER_PROMPT') {
            senddataobj['messages'] = [message];
        }
        let conversationId;
        if (conversationstate.longTextState.bOngoing) {
            conversationId = conversationstate.longTextState.conversationId;
        }
        else {
            conversationId = conversationstate.getConversationIdInCurrentTab();
        }
        if (conversationId && conversationstate.isActive(conversationId)) {
            senddataobj['conversation_id'] = conversationId;
            const currentconversation = conversationstate.getConversation(conversationId);
            if (parent_message_id_flag === 'LAST_RECEIVED_MESSAGE') {
                if (currentconversation && currentconversation.parent_message_id) {
                    senddataobj['parent_message_id'] = currentconversation.parent_message_id;
                }
            }
            else if (parent_message_id_flag === 'ABSTRACT_MESSAGE') {
                if (currentconversation && currentconversation.dataQueue.length > ABSTRACT_MESSAGE_INDEX) {
                    const rdata = currentconversation.dataQueue[ABSTRACT_MESSAGE_INDEX];
                    if (rdata instanceof ReceiveData) {
                        senddataobj['parent_message_id'] = rdata.message.id;
                    }
                }
            }
            else if (parent_message_id_flag === 'FIRST_USER_MESSAGE') {
                if (currentconversation && currentconversation.dataQueue.length > FIRST_USER_MESSAGE_INDEX) {
                    const rdata = currentconversation.dataQueue[FIRST_USER_MESSAGE_INDEX];
                    if (rdata instanceof ReceiveData) {
                        senddataobj['parent_message_id'] = rdata.message.id;
                    }
                }
            }
        }
        console.log('senddataobj', senddataobj);
        const requestBody = new SendData(senddataobj);
        return requestBody;
    }
    async function getResponses(port, requestBody, prompt_index, prompt_length) {
        const accessToken = await getAccessToken();
        let conversationId;
        fetchController = new AbortController();
        port.onDisconnect.addListener(() => { 
            if (fetchController) {
                fetchController.abort();
                fetchController = null;
            }
            deleteConversation(conversationId, accessToken); 
        });
        let lastReturnTexts = prompt_index === 0 ? '' : conversationstate.returnTexts; 
        lastReturnTexts = lastReturnTexts.length > 0 ? lastReturnTexts + '\n' : lastReturnTexts;
        await fetchSSE(BASE_URL + API_CONVERSATION, {
            method: 'POST',
            signal: fetchController.signal,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: requestBody,
            onMessage(message) {
                if (message === '[DONE]') {
                    console.log("单个消息：" + message);
                    conversationstate.setOngoing(false);
                    console.log(conversationstate.getCurrentConversation());
                    if (prompt_index === prompt_length - 1) { 
                        port.postMessage({
                            event: 'DONE',
                            ongoingState: conversationstate.getOngoing()
                        });
                    }
                    else { 
                    }
                    return;
                }
                let data;
                try {
                    data = JSON.parse(message);
                    if (OUTPUT_RECEIVE_DATA) {
                        console.log(data);
                    }
                    const rdata = conversationstate.toReceiveData(data);
                    conversationstate.addData(rdata); 
                }
                catch (jsonParsingException) {
                    conversationstate.setOngoing(false);
                    console.log('JSON parsing of response failed: ' + jsonParsingException.message);
                    console.log(message);
                    return;
                }
                let messageContent;
                if (data && data.message && data.message.content && data.message.content.parts) {
                    messageContent = data.message.content.parts[0];
                }
                conversationId = data.conversation_id;
                if (messageContent && data.message.author.role === 'assistant') {
                    conversationstate.returnTexts = lastReturnTexts + messageContent;
                    conversationstate.returnTexts = conversationstate.returnTexts.trim();
                    port.postMessage({
                        messageContent: conversationstate.returnTexts,
                        messageId: data.message.id,
                        conversationId: data.conversation_id,
                        ongoingState: true,
                    });
                }
            },
        });
    }
    async function sendToServer(port, prompt, prompt_index, prompt_length, isArticle) {
        let sdata;
        try {
            let parent_message_id_flag = 'ABSTRACT_MESSAGE';
            if (prompt_length > 1) {
                parent_message_id_flag = 'LAST_RECEIVED_MESSAGE'; 
            }
            sdata = getRequestBody(
                'user',
                prompt,
                parent_message_id_flag,
                'ONLY_CURRENT_USER_PROMPT' 
            );
            conversationstate.addData(sdata); 
            const requestBody = JSON.stringify(sdata, (key, value) => {
                if (isEmpty(value)) {
                    return undefined; 
                }
                return value;
            });
            await getResponses(port, requestBody, prompt_index, prompt_length);
        }
        catch (err) {
            conversationstate.deleteData(sdata); 
            try {
                const err_length = JSON.parse(err.message);
                console.log("err_length: ", err_length);
                if (isArticle) {
                    if (err_length.detail && err_length.detail.code
                        && err_length.detail.code === 'message_length_exceeds_limit') {
                        return false;
                    }
                    if (err_length.detail && err_length.detail === "Hmm...something seems to have gone wrong.") {
                        console.log(`${prompt_index + 1} / ${prompt_length}`, err_length.detail);
                        if (prompt_index === prompt_length - 1) { 
                            port.postMessage({
                                event: 'DONE',
                                ongoingState: false
                            });
                        }
                        return true;
                    }
                }
            }
            catch (_) {
            }
            conversationstate.setOngoing(false);
            if (err.message) {
                console.log("catch in getResponses(): " + err.message);
                let errMsg = err.message;
                if (errMsg === '504' || errMsg === 'network error') { 
                    errMsg = {
                        "detail": {
                            "message": "Network error, please try again."
                        }
                    };
                }
                port.postMessage({
                    error: errMsg,
                    ongoingState: false,
                }); 
            }
        }
        return true; 
    }
    async function sendDocToServer(port, text) {
        const data = await chrome.storage.sync.get();
        const prompt_single = data.currentOptions.summaryPrompt;
        let ok = await sendToServer(port, prompt_single + "```" + text + "```", 0, 1, true);
        if (ok) {
            return;
        }
        const sentences = tokenizer.sentences(
            text,
            true 
        );
        console.log("拆分长文本，句子数：" + sentences.length, sentences);
        let charCount = 0;
        for (let i = 0; i < sentences.length; i++) {
            sentences[i] = sentences[i].trim();
            charCount += sentences[i].length;
        }
        console.log("总字符数：", charCount);
        conversationstate.longTextState.bOngoing = true;
        for (let n = 2; n <= MAX_CHUNCKS; n++) {
            console.log("Chunks: " + n + ", in MAX " + MAX_CHUNCKS);
            let prompts = [];
            const CHUNK_MAX_CHARS = Math.ceil(charCount / n);
            console.log("CHUNK_MAX_CHARS: " + CHUNK_MAX_CHARS);
            let chunkCharsN = 0;
            let chunkText = '';
            for (let sentence of sentences) {
                const sn = sentence.length;
                chunkCharsN += sn;
                chunkText += sentence;
                if (chunkCharsN > CHUNK_MAX_CHARS) {
                    if (prompts.length === 0) { 
                        prompts.push(prompt_single + "```" + chunkText + "```");
                    }
                    else {
                        prompts.push(prompt_single + "```" + chunkText + "```");
                    }
                    console.log('块字符数：', chunkCharsN);
                    chunkCharsN = 0;
                    chunkText = '';
                }
            }
            console.log('块字符数：', chunkCharsN);
            prompts.push(prompt_single + "```" + chunkText + "```");
            let allOK = true;
            for (let i = 0; i < prompts.length; i++) {
                let prompt = prompts[i];
                let chunkOK = await sendToServer(port, prompt, i, prompts.length, true);
                if (!chunkOK) {
                    allOK = false;
                    console.log(`Chunk is too long: ${i + 1} / ${prompts.length}`);
                    break;
                }
            }
            if (allOK) {
                break;
            }
        }
        conversationstate.longTextState.bOngoing = false;
        conversationstate.longTextState.conversationId = null;
    }
    chrome.runtime.onConnect.addListener(function (port) {
        if (port.name === "port_popup") {
            port.onMessage.addListener(async (msg) => {
                console.log("port_popup: ", msg);
            });
        }
        if (port.name === "port_main") {
            port.onMessage.addListener(async (msg) => {
                if (msg.documentText !== undefined) {
                    conversationstate.updateCurrentTab(conversationstate.currentTabId); 
                    sendDocToServer(port, msg.documentText);
                }
                if (msg.sendText !== undefined) {
                    sendToServer(port, msg.sendText, 0, 1, false);
                }
                if (msg.close === 'mainWindow') {
                    console.log('closeContentWindow');
                    if (fetchController) {
                        fetchController.abort();
                        fetchController = null;
                    }
                    const conversationId = conversationstate.getConversationIdInCurrentTab();
                    if (conversationId && conversationstate.isActive(conversationId)) {
                        const accessToken = await getAccessToken();
                        deleteConversation(conversationId, accessToken);
                    }
                }
            });
        }
    });
})();
