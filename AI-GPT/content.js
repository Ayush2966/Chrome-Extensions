if (typeof myApp_SummChat === 'undefined') {
    console.log("SummChat Readability init...");
    var myApp_SummChat = {};
    myApp_SummChat.Readability = (function () {
        /*
         * Copyright (c) 2010 Arc90 Inc
         *
         * Licensed under the Apache License, Version 2.0 (the "License");
         * you may not use this file except in compliance with the License.
         * You may obtain a copy of the License at
         *
         *     http://www.apache.org/licenses/LICENSE-2.0
         *
         * Unless required by applicable law or agreed to in writing, software
         * distributed under the License is distributed on an "AS IS" BASIS,
         * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
         * See the License for the specific language governing permissions and
         * limitations under the License.
         */
        /*
         * This code is heavily based on Arc90's readability.js (1.7.1) script
         * available at: http://code.google.com/p/arc90labs-readability
         */
        /**
         * Public constructor.
         * @param {HTMLDocument} doc     The document to parse.
         * @param {Object}       options The options object.
         */
        function Readability(doc, options) {
            // In some older versions, people passed a URI as the first argument. Cope:
            if (options && options.documentElement) {
                doc = options;
                options = arguments[2];
            } else if (!doc || !doc.documentElement) {
                throw new Error("First argument to Readability constructor should be a document object.");
            }
            options = options || {};
            this._doc = doc;
            this._docJSDOMParser = this._doc.firstChild.__JSDOMParser__;
            this._articleTitle = null;
            this._articleByline = null;
            this._articleDir = null;
            this._articleSiteName = null;
            this._attempts = [];
            // Configurable options
            this._debug = !!options.debug;
            this._maxElemsToParse = options.maxElemsToParse || this.DEFAULT_MAX_ELEMS_TO_PARSE;
            this._nbTopCandidates = options.nbTopCandidates || this.DEFAULT_N_TOP_CANDIDATES;
            this._charThreshold = options.charThreshold || this.DEFAULT_CHAR_THRESHOLD;
            this._classesToPreserve = this.CLASSES_TO_PRESERVE.concat(options.classesToPreserve || []);
            this._keepClasses = !!options.keepClasses;
            this._serializer = options.serializer || function (el) {
                return el.innerHTML;
            };
            this._disableJSONLD = !!options.disableJSONLD;
            this._allowedVideoRegex = options.allowedVideoRegex || this.REGEXPS.videos;
            // Start with all flags set
            this._flags = this.FLAG_STRIP_UNLIKELYS |
                this.FLAG_WEIGHT_CLASSES |
                this.FLAG_CLEAN_CONDITIONALLY;
            // Control whether log messages are sent to the console
            if (this._debug) {
                let logNode = function (node) {
                    if (node.nodeType == node.TEXT_NODE) {
                        return `${node.nodeName} ("${node.textContent}")`;
                    }
                    let attrPairs = Array.from(node.attributes || [], function (attr) {
                        return `${attr.name}="${attr.value}"`;
                    }).join(" ");
                    return `<${node.localName} ${attrPairs}>`;
                };
                this.log = function () {
                    if (typeof dump !== "undefined") {
                        var msg = Array.prototype.map.call(arguments, function (x) {
                            return (x && x.nodeName) ? logNode(x) : x;
                        }).join(" ");
                        dump("Reader: (Readability) " + msg + "\n");
                    } else if (typeof console !== "undefined") {
                        let args = Array.from(arguments, arg => {
                            if (arg && arg.nodeType == this.ELEMENT_NODE) {
                                return logNode(arg);
                            }
                            return arg;
                        });
                        args.unshift("Reader: (Readability)");
                        console.log.apply(console, args);
                    }
                };
            } else {
                this.log = function () { };
            }
        }
        Readability.prototype = {
            FLAG_STRIP_UNLIKELYS: 0x1,
            FLAG_WEIGHT_CLASSES: 0x2,
            FLAG_CLEAN_CONDITIONALLY: 0x4,
            // https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeType
            ELEMENT_NODE: 1,
            TEXT_NODE: 3,
            // Max number of nodes supported by this parser. Default: 0 (no limit)
            DEFAULT_MAX_ELEMS_TO_PARSE: 0,
            // The number of top candidates to consider when analysing how
            // tight the competition is among candidates.
            DEFAULT_N_TOP_CANDIDATES: 5,
            // Element tags to score by default.
            DEFAULT_TAGS_TO_SCORE: "section,h2,h3,h4,h5,h6,p,td,pre".toUpperCase().split(","),
            // The default number of chars an article must have in order to return a result
            DEFAULT_CHAR_THRESHOLD: 500,
            // All of the regular expressions in use within readability.
            // Defined up here so we don't instantiate them repeatedly in loops.
            REGEXPS: {
                // NOTE: These two regular expressions are duplicated in
                // Readability-readerable.js. Please keep both copies in sync.
                unlikelyCandidates: /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,
                okMaybeItsACandidate: /and|article|body|column|content|main|shadow/i,
                positive: /article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i,
                negative: /-ad-|hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|foot|footer|footnote|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|tool|widget/i,
                extraneous: /print|archive|comment|discuss|e[\-]?mail|share|reply|all|login|sign|single|utility/i,
                byline: /byline|author|dateline|writtenby|p-author/i,
                replaceFonts: /<(\/?)font[^>]*>/gi,
                normalize: /\s{2,}/g,
                videos: /\/\/(www\.)?((dailymotion|youtube|youtube-nocookie|player\.vimeo|v\.qq)\.com|(archive|upload\.wikimedia)\.org|player\.twitch\.tv)/i,
                shareElements: /(\b|_)(share|sharedaddy)(\b|_)/i,
                nextLink: /(next|weiter|continue|>([^\|]|$)|»([^\|]|$))/i,
                prevLink: /(prev|earl|old|new|<|«)/i,
                tokenize: /\W+/g,
                whitespace: /^\s*$/,
                hasContent: /\S$/,
                hashUrl: /^#.+/,
                srcsetUrl: /(\S+)(\s+[\d.]+[xw])?(\s*(?:,|$))/g,
                b64DataUrl: /^data:\s*([^\s;,]+)\s*;\s*base64\s*,/i,
                // See: https://schema.org/Article
                jsonLdArticleTypes: /^Article|AdvertiserContentArticle|NewsArticle|AnalysisNewsArticle|AskPublicNewsArticle|BackgroundNewsArticle|OpinionNewsArticle|ReportageNewsArticle|ReviewNewsArticle|Report|SatiricalArticle|ScholarlyArticle|MedicalScholarlyArticle|SocialMediaPosting|BlogPosting|LiveBlogPosting|DiscussionForumPosting|TechArticle|APIReference$/
            },
            UNLIKELY_ROLES: ["menu", "menubar", "complementary", "navigation", "alert", "alertdialog", "dialog"],
            DIV_TO_P_ELEMS: new Set(["BLOCKQUOTE", "DL", "DIV", "IMG", "OL", "P", "PRE", "TABLE", "UL"]),
            ALTER_TO_DIV_EXCEPTIONS: ["DIV", "ARTICLE", "SECTION", "P"],
            PRESENTATIONAL_ATTRIBUTES: ["align", "background", "bgcolor", "border", "cellpadding", "cellspacing", "frame", "hspace", "rules", "style", "valign", "vspace"],
            DEPRECATED_SIZE_ATTRIBUTE_ELEMS: ["TABLE", "TH", "TD", "HR", "PRE"],
            // The commented out elements qualify as phrasing content but tend to be
            // removed by readability when put into paragraphs, so we ignore them here.
            PHRASING_ELEMS: [
                // "CANVAS", "IFRAME", "SVG", "VIDEO",
                "ABBR", "AUDIO", "B", "BDO", "BR", "BUTTON", "CITE", "CODE", "DATA",
                "DATALIST", "DFN", "EM", "EMBED", "I", "IMG", "INPUT", "KBD", "LABEL",
                "MARK", "MATH", "METER", "NOSCRIPT", "OBJECT", "OUTPUT", "PROGRESS", "Q",
                "RUBY", "SAMP", "SCRIPT", "SELECT", "SMALL", "SPAN", "STRONG", "SUB",
                "SUP", "TEXTAREA", "TIME", "VAR", "WBR"
            ],
            // These are the classes that readability sets itself.
            CLASSES_TO_PRESERVE: ["page"],
            // These are the list of HTML entities that need to be escaped.
            HTML_ESCAPE_MAP: {
                "lt": "<",
                "gt": ">",
                "amp": "&",
                "quot": '"',
                "apos": "'",
            },
            /**
             * Run any post-process modifications to article content as necessary.
             *
             * @param Element
             * @return void
            **/
            _postProcessContent: function (articleContent) {
                // Readability cannot open relative uris so we convert them to absolute uris.
                this._fixRelativeUris(articleContent);
                this._simplifyNestedElements(articleContent);
                if (!this._keepClasses) {
                    // Remove classes.
                    this._cleanClasses(articleContent);
                }
            },
            /**
             * Iterates over a NodeList, calls `filterFn` for each node and removes node
             * if function returned `true`.
             *
             * If function is not passed, removes all the nodes in node list.
             *
             * @param NodeList nodeList The nodes to operate on
             * @param Function filterFn the function to use as a filter
             * @return void
             */
            _removeNodes: function (nodeList, filterFn) {
                // Avoid ever operating on live node lists.
                if (this._docJSDOMParser && nodeList._isLiveNodeList) {
                    throw new Error("Do not pass live node lists to _removeNodes");
                }
                for (var i = nodeList.length - 1; i >= 0; i--) {
                    var node = nodeList[i];
                    var parentNode = node.parentNode;
                    if (parentNode) {
                        if (!filterFn || filterFn.call(this, node, i, nodeList)) {
                            parentNode.removeChild(node);
                        }
                    }
                }
            },
            /**
             * Iterates over a NodeList, and calls _setNodeTag for each node.
             *
             * @param NodeList nodeList The nodes to operate on
             * @param String newTagName the new tag name to use
             * @return void
             */
            _replaceNodeTags: function (nodeList, newTagName) {
                // Avoid ever operating on live node lists.
                if (this._docJSDOMParser && nodeList._isLiveNodeList) {
                    throw new Error("Do not pass live node lists to _replaceNodeTags");
                }
                for (const node of nodeList) {
                    this._setNodeTag(node, newTagName);
                }
            },
            /**
             * Iterate over a NodeList, which doesn't natively fully implement the Array
             * interface.
             *
             * For convenience, the current object context is applied to the provided
             * iterate function.
             *
             * @param  NodeList nodeList The NodeList.
             * @param  Function fn       The iterate function.
             * @return void
             */
            _forEachNode: function (nodeList, fn) {
                Array.prototype.forEach.call(nodeList, fn, this);
            },
            /**
             * Iterate over a NodeList, and return the first node that passes
             * the supplied test function
             *
             * For convenience, the current object context is applied to the provided
             * test function.
             *
             * @param  NodeList nodeList The NodeList.
             * @param  Function fn       The test function.
             * @return void
             */
            _findNode: function (nodeList, fn) {
                return Array.prototype.find.call(nodeList, fn, this);
            },
            /**
             * Iterate over a NodeList, return true if any of the provided iterate
             * function calls returns true, false otherwise.
             *
             * For convenience, the current object context is applied to the
             * provided iterate function.
             *
             * @param  NodeList nodeList The NodeList.
             * @param  Function fn       The iterate function.
             * @return Boolean
             */
            _someNode: function (nodeList, fn) {
                return Array.prototype.some.call(nodeList, fn, this);
            },
            /**
             * Iterate over a NodeList, return true if all of the provided iterate
             * function calls return true, false otherwise.
             *
             * For convenience, the current object context is applied to the
             * provided iterate function.
             *
             * @param  NodeList nodeList The NodeList.
             * @param  Function fn       The iterate function.
             * @return Boolean
             */
            _everyNode: function (nodeList, fn) {
                return Array.prototype.every.call(nodeList, fn, this);
            },
            /**
             * Concat all nodelists passed as arguments.
             *
             * @return ...NodeList
             * @return Array
             */
            _concatNodeLists: function () {
                var slice = Array.prototype.slice;
                var args = slice.call(arguments);
                var nodeLists = args.map(function (list) {
                    return slice.call(list);
                });
                return Array.prototype.concat.apply([], nodeLists);
            },
            _getAllNodesWithTag: function (node, tagNames) {
                if (node.querySelectorAll) {
                    return node.querySelectorAll(tagNames.join(","));
                }
                return [].concat.apply([], tagNames.map(function (tag) {
                    var collection = node.getElementsByTagName(tag);
                    return Array.isArray(collection) ? collection : Array.from(collection);
                }));
            },
            /**
             * Removes the class="" attribute from every element in the given
             * subtree, except those that match CLASSES_TO_PRESERVE and
             * the classesToPreserve array from the options object.
             *
             * @param Element
             * @return void
             */
            _cleanClasses: function (node) {
                var classesToPreserve = this._classesToPreserve;
                var className = (node.getAttribute("class") || "")
                    .split(/\s+/)
                    .filter(function (cls) {
                        return classesToPreserve.indexOf(cls) != -1;
                    })
                    .join(" ");
                if (className) {
                    node.setAttribute("class", className);
                } else {
                    node.removeAttribute("class");
                }
                for (node = node.firstElementChild; node; node = node.nextElementSibling) {
                    this._cleanClasses(node);
                }
            },
            /**
             * Converts each <a> and <img> uri in the given element to an absolute URI,
             * ignoring #ref URIs.
             *
             * @param Element
             * @return void
             */
            _fixRelativeUris: function (articleContent) {
                var baseURI = this._doc.baseURI;
                var documentURI = this._doc.documentURI;
                function toAbsoluteURI(uri) {
                    // Leave hash links alone if the base URI matches the document URI:
                    if (baseURI == documentURI && uri.charAt(0) == "#") {
                        return uri;
                    }
                    // Otherwise, resolve against base URI:
                    try {
                        return new URL(uri, baseURI).href;
                    } catch (ex) {
                        // Something went wrong, just return the original:
                    }
                    return uri;
                }
                var links = this._getAllNodesWithTag(articleContent, ["a"]);
                this._forEachNode(links, function (link) {
                    var href = link.getAttribute("href");
                    if (href) {
                        // Remove links with javascript: URIs, since
                        // they won't work after scripts have been removed from the page.
                        if (href.indexOf("javascript:") === 0) {
                            // if the link only contains simple text content, it can be converted to a text node
                            if (link.childNodes.length === 1 && link.childNodes[0].nodeType === this.TEXT_NODE) {
                                var text = this._doc.createTextNode(link.textContent);
                                link.parentNode.replaceChild(text, link);
                            } else {
                                // if the link has multiple children, they should all be preserved
                                var container = this._doc.createElement("span");
                                while (link.firstChild) {
                                    container.appendChild(link.firstChild);
                                }
                                link.parentNode.replaceChild(container, link);
                            }
                        } else {
                            link.setAttribute("href", toAbsoluteURI(href));
                        }
                    }
                });
                var medias = this._getAllNodesWithTag(articleContent, [
                    "img", "picture", "figure", "video", "audio", "source"
                ]);
                this._forEachNode(medias, function (media) {
                    var src = media.getAttribute("src");
                    var poster = media.getAttribute("poster");
                    var srcset = media.getAttribute("srcset");
                    if (src) {
                        media.setAttribute("src", toAbsoluteURI(src));
                    }
                    if (poster) {
                        media.setAttribute("poster", toAbsoluteURI(poster));
                    }
                    if (srcset) {
                        var newSrcset = srcset.replace(this.REGEXPS.srcsetUrl, function (_, p1, p2, p3) {
                            return toAbsoluteURI(p1) + (p2 || "") + p3;
                        });
                        media.setAttribute("srcset", newSrcset);
                    }
                });
            },
            _simplifyNestedElements: function (articleContent) {
                var node = articleContent;
                while (node) {
                    if (node.parentNode && ["DIV", "SECTION"].includes(node.tagName) && !(node.id && node.id.startsWith("readability"))) {
                        if (this._isElementWithoutContent(node)) {
                            node = this._removeAndGetNext(node);
                            continue;
                        } else if (this._hasSingleTagInsideElement(node, "DIV") || this._hasSingleTagInsideElement(node, "SECTION")) {
                            var child = node.children[0];
                            for (var i = 0; i < node.attributes.length; i++) {
                                child.setAttribute(node.attributes[i].name, node.attributes[i].value);
                            }
                            node.parentNode.replaceChild(child, node);
                            node = child;
                            continue;
                        }
                    }
                    node = this._getNextNode(node);
                }
            },
            /**
             * Get the article title as an H1.
             *
             * @return string
             **/
            _getArticleTitle: function () {
                var doc = this._doc;
                var curTitle = "";
                var origTitle = "";
                try {
                    curTitle = origTitle = doc.title.trim();
                    // If they had an element with id "title" in their HTML
                    if (typeof curTitle !== "string")
                        curTitle = origTitle = this._getInnerText(doc.getElementsByTagName("title")[0]);
                } catch (e) {/* ignore exceptions setting the title. */ }
                var titleHadHierarchicalSeparators = false;
                function wordCount(str) {
                    return str.split(/\s+/).length;
                }
                // If there's a separator in the title, first remove the final part
                if ((/ [\|\-\\\/>»] /).test(curTitle)) {
                    titleHadHierarchicalSeparators = / [\\\/>»] /.test(curTitle);
                    curTitle = origTitle.replace(/(.*)[\|\-\\\/>»] .*/gi, "$1");
                    // If the resulting title is too short (3 words or fewer), remove
                    // the first part instead:
                    if (wordCount(curTitle) < 3)
                        curTitle = origTitle.replace(/[^\|\-\\\/>»]*[\|\-\\\/>»](.*)/gi, "$1");
                } else if (curTitle.indexOf(": ") !== -1) {
                    // Check if we have an heading containing this exact string, so we
                    // could assume it's the full title.
                    var headings = this._concatNodeLists(
                        doc.getElementsByTagName("h1"),
                        doc.getElementsByTagName("h2")
                    );
                    var trimmedTitle = curTitle.trim();
                    var match = this._someNode(headings, function (heading) {
                        return heading.textContent.trim() === trimmedTitle;
                    });
                    // If we don't, let's extract the title out of the original title string.
                    if (!match) {
                        curTitle = origTitle.substring(origTitle.lastIndexOf(":") + 1);
                        // If the title is now too short, try the first colon instead:
                        if (wordCount(curTitle) < 3) {
                            curTitle = origTitle.substring(origTitle.indexOf(":") + 1);
                            // But if we have too many words before the colon there's something weird
                            // with the titles and the H tags so let's just use the original title instead
                        } else if (wordCount(origTitle.substr(0, origTitle.indexOf(":"))) > 5) {
                            curTitle = origTitle;
                        }
                    }
                } else if (curTitle.length > 150 || curTitle.length < 15) {
                    var hOnes = doc.getElementsByTagName("h1");
                    if (hOnes.length === 1)
                        curTitle = this._getInnerText(hOnes[0]);
                }
                curTitle = curTitle.trim().replace(this.REGEXPS.normalize, " ");
                // If we now have 4 words or fewer as our title, and either no
                // 'hierarchical' separators (\, /, > or ») were found in the original
                // title or we decreased the number of words by more than 1 word, use
                // the original title.
                var curTitleWordCount = wordCount(curTitle);
                if (curTitleWordCount <= 4 &&
                    (!titleHadHierarchicalSeparators ||
                        curTitleWordCount != wordCount(origTitle.replace(/[\|\-\\\/>»]+/g, "")) - 1)) {
                    curTitle = origTitle;
                }
                return curTitle;
            },
            /**
             * Prepare the HTML document for readability to scrape it.
             * This includes things like stripping javascript, CSS, and handling terrible markup.
             *
             * @return void
             **/
            _prepDocument: function () {
                var doc = this._doc;
                // Remove all style tags in head
                this._removeNodes(this._getAllNodesWithTag(doc, ["style"]));
                if (doc.body) {
                    this._replaceBrs(doc.body);
                }
                this._replaceNodeTags(this._getAllNodesWithTag(doc, ["font"]), "SPAN");
            },
            /**
             * Finds the next node, starting from the given node, and ignoring
             * whitespace in between. If the given node is an element, the same node is
             * returned.
             */
            _nextNode: function (node) {
                var next = node;
                while (next
                    && (next.nodeType != this.ELEMENT_NODE)
                    && this.REGEXPS.whitespace.test(next.textContent)) {
                    next = next.nextSibling;
                }
                return next;
            },
            /**
             * Replaces 2 or more successive <br> elements with a single <p>.
             * Whitespace between <br> elements are ignored. For example:
             *   <div>foo<br>bar<br> <br><br>abc</div>
             * will become:
             *   <div>foo<br>bar<p>abc</p></div>
             */
            _replaceBrs: function (elem) {
                this._forEachNode(this._getAllNodesWithTag(elem, ["br"]), function (br) {
                    var next = br.nextSibling;
                    // Whether 2 or more <br> elements have been found and replaced with a
                    // <p> block.
                    var replaced = false;
                    // If we find a <br> chain, remove the <br>s until we hit another node
                    // or non-whitespace. This leaves behind the first <br> in the chain
                    // (which will be replaced with a <p> later).
                    while ((next = this._nextNode(next)) && (next.tagName == "BR")) {
                        replaced = true;
                        var brSibling = next.nextSibling;
                        next.parentNode.removeChild(next);
                        next = brSibling;
                    }
                    // If we removed a <br> chain, replace the remaining <br> with a <p>. Add
                    // all sibling nodes as children of the <p> until we hit another <br>
                    // chain.
                    if (replaced) {
                        var p = this._doc.createElement("p");
                        br.parentNode.replaceChild(p, br);
                        next = p.nextSibling;
                        while (next) {
                            // If we've hit another <br><br>, we're done adding children to this <p>.
                            if (next.tagName == "BR") {
                                var nextElem = this._nextNode(next.nextSibling);
                                if (nextElem && nextElem.tagName == "BR")
                                    break;
                            }
                            if (!this._isPhrasingContent(next))
                                break;
                            // Otherwise, make this node a child of the new <p>.
                            var sibling = next.nextSibling;
                            p.appendChild(next);
                            next = sibling;
                        }
                        while (p.lastChild && this._isWhitespace(p.lastChild)) {
                            p.removeChild(p.lastChild);
                        }
                        if (p.parentNode.tagName === "P")
                            this._setNodeTag(p.parentNode, "DIV");
                    }
                });
            },
            _setNodeTag: function (node, tag) {
                this.log("_setNodeTag", node, tag);
                if (this._docJSDOMParser) {
                    node.localName = tag.toLowerCase();
                    node.tagName = tag.toUpperCase();
                    return node;
                }
                var replacement = node.ownerDocument.createElement(tag);
                while (node.firstChild) {
                    replacement.appendChild(node.firstChild);
                }
                node.parentNode.replaceChild(replacement, node);
                if (node.readability)
                    replacement.readability = node.readability;
                for (var i = 0; i < node.attributes.length; i++) {
                    try {
                        replacement.setAttribute(node.attributes[i].name, node.attributes[i].value);
                    } catch (ex) {
                        /* it's possible for setAttribute() to throw if the attribute name
                         * isn't a valid XML Name. Such attributes can however be parsed from
                         * source in HTML docs, see https://github.com/whatwg/html/issues/4275,
                         * so we can hit them here and then throw. We don't care about such
                         * attributes so we ignore them.
                         */
                    }
                }
                return replacement;
            },
            /**
             * Prepare the article node for display. Clean out any inline styles,
             * iframes, forms, strip extraneous <p> tags, etc.
             *
             * @param Element
             * @return void
             **/
            _prepArticle: function (articleContent) {
                this._cleanStyles(articleContent);
                // Check for data tables before we continue, to avoid removing items in
                // those tables, which will often be isolated even though they're
                // visually linked to other content-ful elements (text, images, etc.).
                this._markDataTables(articleContent);
                this._fixLazyImages(articleContent);
                // Clean out junk from the article content
                this._cleanConditionally(articleContent, "form");
                this._cleanConditionally(articleContent, "fieldset");
                this._clean(articleContent, "object");
                this._clean(articleContent, "embed");
                this._clean(articleContent, "footer");
                this._clean(articleContent, "link");
                this._clean(articleContent, "aside");
                // Clean out elements with little content that have "share" in their id/class combinations from final top candidates,
                // which means we don't remove the top candidates even they have "share".
                var shareElementThreshold = this.DEFAULT_CHAR_THRESHOLD;
                this._forEachNode(articleContent.children, function (topCandidate) {
                    this._cleanMatchedNodes(topCandidate, function (node, matchString) {
                        return this.REGEXPS.shareElements.test(matchString) && node.textContent.length < shareElementThreshold;
                    });
                });
                this._clean(articleContent, "iframe");
                this._clean(articleContent, "input");
                this._clean(articleContent, "textarea");
                this._clean(articleContent, "select");
                this._clean(articleContent, "button");
                this._cleanHeaders(articleContent);
                // Do these last as the previous stuff may have removed junk
                // that will affect these
                this._cleanConditionally(articleContent, "table");
                this._cleanConditionally(articleContent, "ul");
                this._cleanConditionally(articleContent, "div");
                // replace H1 with H2 as H1 should be only title that is displayed separately
                this._replaceNodeTags(this._getAllNodesWithTag(articleContent, ["h1"]), "h2");
                // Remove extra paragraphs
                this._removeNodes(this._getAllNodesWithTag(articleContent, ["p"]), function (paragraph) {
                    var imgCount = paragraph.getElementsByTagName("img").length;
                    var embedCount = paragraph.getElementsByTagName("embed").length;
                    var objectCount = paragraph.getElementsByTagName("object").length;
                    // At this point, nasty iframes have been removed, only remain embedded video ones.
                    var iframeCount = paragraph.getElementsByTagName("iframe").length;
                    var totalCount = imgCount + embedCount + objectCount + iframeCount;
                    return totalCount === 0 && !this._getInnerText(paragraph, false);
                });
                this._forEachNode(this._getAllNodesWithTag(articleContent, ["br"]), function (br) {
                    var next = this._nextNode(br.nextSibling);
                    if (next && next.tagName == "P")
                        br.parentNode.removeChild(br);
                });
                // Remove single-cell tables
                this._forEachNode(this._getAllNodesWithTag(articleContent, ["table"]), function (table) {
                    var tbody = this._hasSingleTagInsideElement(table, "TBODY") ? table.firstElementChild : table;
                    if (this._hasSingleTagInsideElement(tbody, "TR")) {
                        var row = tbody.firstElementChild;
                        if (this._hasSingleTagInsideElement(row, "TD")) {
                            var cell = row.firstElementChild;
                            cell = this._setNodeTag(cell, this._everyNode(cell.childNodes, this._isPhrasingContent) ? "P" : "DIV");
                            table.parentNode.replaceChild(cell, table);
                        }
                    }
                });
            },
            /**
             * Initialize a node with the readability object. Also checks the
             * className/id for special names to add to its score.
             *
             * @param Element
             * @return void
            **/
            _initializeNode: function (node) {
                node.readability = { "contentScore": 0 };
                switch (node.tagName) {
                    case "DIV":
                        node.readability.contentScore += 5;
                        break;
                    case "PRE":
                    case "TD":
                    case "BLOCKQUOTE":
                        node.readability.contentScore += 3;
                        break;
                    case "ADDRESS":
                    case "OL":
                    case "UL":
                    case "DL":
                    case "DD":
                    case "DT":
                    case "LI":
                    case "FORM":
                        node.readability.contentScore -= 3;
                        break;
                    case "H1":
                    case "H2":
                    case "H3":
                    case "H4":
                    case "H5":
                    case "H6":
                    case "TH":
                        node.readability.contentScore -= 5;
                        break;
                }
                node.readability.contentScore += this._getClassWeight(node);
            },
            _removeAndGetNext: function (node) {
                var nextNode = this._getNextNode(node, true);
                node.parentNode.removeChild(node);
                return nextNode;
            },
            /**
             * Traverse the DOM from node to node, starting at the node passed in.
             * Pass true for the second parameter to indicate this node itself
             * (and its kids) are going away, and we want the next node over.
             *
             * Calling this in a loop will traverse the DOM depth-first.
             */
            _getNextNode: function (node, ignoreSelfAndKids) {
                // First check for kids if those aren't being ignored
                if (!ignoreSelfAndKids && node.firstElementChild) {
                    return node.firstElementChild;
                }
                // Then for siblings...
                if (node.nextElementSibling) {
                    return node.nextElementSibling;
                }
                // And finally, move up the parent chain *and* find a sibling
                // (because this is depth-first traversal, we will have already
                // seen the parent nodes themselves).
                do {
                    node = node.parentNode;
                } while (node && !node.nextElementSibling);
                return node && node.nextElementSibling;
            },
            // compares second text to first one
            // 1 = same text, 0 = completely different text
            // works the way that it splits both texts into words and then finds words that are unique in second text
            // the result is given by the lower length of unique parts
            _textSimilarity: function (textA, textB) {
                var tokensA = textA.toLowerCase().split(this.REGEXPS.tokenize).filter(Boolean);
                var tokensB = textB.toLowerCase().split(this.REGEXPS.tokenize).filter(Boolean);
                if (!tokensA.length || !tokensB.length) {
                    return 0;
                }
                var uniqTokensB = tokensB.filter(token => !tokensA.includes(token));
                var distanceB = uniqTokensB.join(" ").length / tokensB.join(" ").length;
                return 1 - distanceB;
            },
            _checkByline: function (node, matchString) {
                if (this._articleByline) {
                    return false;
                }
                if (node.getAttribute !== undefined) {
                    var rel = node.getAttribute("rel");
                    var itemprop = node.getAttribute("itemprop");
                }
                if ((rel === "author" || (itemprop && itemprop.indexOf("author") !== -1) || this.REGEXPS.byline.test(matchString)) && this._isValidByline(node.textContent)) {
                    this._articleByline = node.textContent.trim();
                    return true;
                }
                return false;
            },
            _getNodeAncestors: function (node, maxDepth) {
                maxDepth = maxDepth || 0;
                var i = 0, ancestors = [];
                while (node.parentNode) {
                    ancestors.push(node.parentNode);
                    if (maxDepth && ++i === maxDepth)
                        break;
                    node = node.parentNode;
                }
                return ancestors;
            },
            /***
             * grabArticle - Using a variety of metrics (content score, classname, element types), find the content that is
             *         most likely to be the stuff a user wants to read. Then return it wrapped up in a div.
             *
             * @param page a document to run upon. Needs to be a full document, complete with body.
             * @return Element
            **/
            _grabArticle: function (page) {
                this.log("**** grabArticle ****");
                var doc = this._doc;
                var isPaging = page !== null;
                page = page ? page : this._doc.body;
                // We can't grab an article if we don't have a page!
                if (!page) {
                    this.log("No body found in document. Abort.");
                    return null;
                }
                var pageCacheHtml = page.innerHTML;
                while (true) {
                    this.log("Starting grabArticle loop");
                    var stripUnlikelyCandidates = this._flagIsActive(this.FLAG_STRIP_UNLIKELYS);
                    // First, node prepping. Trash nodes that look cruddy (like ones with the
                    // class name "comment", etc), and turn divs into P tags where they have been
                    // used inappropriately (as in, where they contain no other block level elements.)
                    var elementsToScore = [];
                    var node = this._doc.documentElement;
                    let shouldRemoveTitleHeader = true;
                    while (node) {
                        if (node.tagName === "HTML") {
                            this._articleLang = node.getAttribute("lang");
                        }
                        var matchString = node.className + " " + node.id;
                        if (!this._isProbablyVisible(node)) {
                            this.log("Removing hidden node - " + matchString);
                            node = this._removeAndGetNext(node);
                            continue;
                        }
                        // User is not able to see elements applied with both "aria-modal = true" and "role = dialog"
                        if (node.getAttribute("aria-modal") == "true" && node.getAttribute("role") == "dialog") {
                            node = this._removeAndGetNext(node);
                            continue;
                        }
                        // Check to see if this node is a byline, and remove it if it is.
                        if (this._checkByline(node, matchString)) {
                            node = this._removeAndGetNext(node);
                            continue;
                        }
                        if (shouldRemoveTitleHeader && this._headerDuplicatesTitle(node)) {
                            this.log("Removing header: ", node.textContent.trim(), this._articleTitle.trim());
                            shouldRemoveTitleHeader = false;
                            node = this._removeAndGetNext(node);
                            continue;
                        }
                        // Remove unlikely candidates
                        if (stripUnlikelyCandidates) {
                            if (this.REGEXPS.unlikelyCandidates.test(matchString) &&
                                !this.REGEXPS.okMaybeItsACandidate.test(matchString) &&
                                !this._hasAncestorTag(node, "table") &&
                                !this._hasAncestorTag(node, "code") &&
                                node.tagName !== "BODY" &&
                                node.tagName !== "A") {
                                this.log("Removing unlikely candidate - " + matchString);
                                node = this._removeAndGetNext(node);
                                continue;
                            }
                            if (this.UNLIKELY_ROLES.includes(node.getAttribute("role"))) {
                                this.log("Removing content with role " + node.getAttribute("role") + " - " + matchString);
                                node = this._removeAndGetNext(node);
                                continue;
                            }
                        }
                        // Remove DIV, SECTION, and HEADER nodes without any content(e.g. text, image, video, or iframe).
                        if ((node.tagName === "DIV" || node.tagName === "SECTION" || node.tagName === "HEADER" ||
                            node.tagName === "H1" || node.tagName === "H2" || node.tagName === "H3" ||
                            node.tagName === "H4" || node.tagName === "H5" || node.tagName === "H6") &&
                            this._isElementWithoutContent(node)) {
                            node = this._removeAndGetNext(node);
                            continue;
                        }
                        if (this.DEFAULT_TAGS_TO_SCORE.indexOf(node.tagName) !== -1) {
                            elementsToScore.push(node);
                        }
                        // Turn all divs that don't have children block level elements into p's
                        if (node.tagName === "DIV") {
                            // Put phrasing content into paragraphs.
                            var p = null;
                            var childNode = node.firstChild;
                            while (childNode) {
                                var nextSibling = childNode.nextSibling;
                                if (this._isPhrasingContent(childNode)) {
                                    if (p !== null) {
                                        p.appendChild(childNode);
                                    } else if (!this._isWhitespace(childNode)) {
                                        p = doc.createElement("p");
                                        node.replaceChild(p, childNode);
                                        p.appendChild(childNode);
                                    }
                                } else if (p !== null) {
                                    while (p.lastChild && this._isWhitespace(p.lastChild)) {
                                        p.removeChild(p.lastChild);
                                    }
                                    p = null;
                                }
                                childNode = nextSibling;
                            }
                            // Sites like http://mobile.slate.com encloses each paragraph with a DIV
                            // element. DIVs with only a P element inside and no text content can be
                            // safely converted into plain P elements to avoid confusing the scoring
                            // algorithm with DIVs with are, in practice, paragraphs.
                            if (this._hasSingleTagInsideElement(node, "P") && this._getLinkDensity(node) < 0.25) {
                                var newNode = node.children[0];
                                node.parentNode.replaceChild(newNode, node);
                                node = newNode;
                                elementsToScore.push(node);
                            } else if (!this._hasChildBlockElement(node)) {
                                node = this._setNodeTag(node, "P");
                                elementsToScore.push(node);
                            }
                        }
                        node = this._getNextNode(node);
                    }
                    /**
                     * Loop through all paragraphs, and assign a score to them based on how content-y they look.
                     * Then add their score to their parent node.
                     *
                     * A score is determined by things like number of commas, class names, etc. Maybe eventually link density.
                    **/
                    var candidates = [];
                    this._forEachNode(elementsToScore, function (elementToScore) {
                        if (!elementToScore.parentNode || typeof (elementToScore.parentNode.tagName) === "undefined")
                            return;
                        // If this paragraph is less than 25 characters, don't even count it.
                        var innerText = this._getInnerText(elementToScore);
                        if (innerText.length < 25)
                            return;
                        // Exclude nodes with no ancestor.
                        var ancestors = this._getNodeAncestors(elementToScore, 5);
                        if (ancestors.length === 0)
                            return;
                        var contentScore = 0;
                        // Add a point for the paragraph itself as a base.
                        contentScore += 1;
                        // Add points for any commas within this paragraph.
                        contentScore += innerText.split(",").length;
                        // For every 100 characters in this paragraph, add another point. Up to 3 points.
                        contentScore += Math.min(Math.floor(innerText.length / 100), 3);
                        // Initialize and score ancestors.
                        this._forEachNode(ancestors, function (ancestor, level) {
                            if (!ancestor.tagName || !ancestor.parentNode || typeof (ancestor.parentNode.tagName) === "undefined")
                                return;
                            if (typeof (ancestor.readability) === "undefined") {
                                this._initializeNode(ancestor);
                                candidates.push(ancestor);
                            }
                            // Node score divider:
                            // - parent:             1 (no division)
                            // - grandparent:        2
                            // - great grandparent+: ancestor level * 3
                            if (level === 0)
                                var scoreDivider = 1;
                            else if (level === 1)
                                scoreDivider = 2;
                            else
                                scoreDivider = level * 3;
                            ancestor.readability.contentScore += contentScore / scoreDivider;
                        });
                    });
                    // After we've calculated scores, loop through all of the possible
                    // candidate nodes we found and find the one with the highest score.
                    var topCandidates = [];
                    for (var c = 0, cl = candidates.length; c < cl; c += 1) {
                        var candidate = candidates[c];
                        // Scale the final candidates score based on link density. Good content
                        // should have a relatively small link density (5% or less) and be mostly
                        // unaffected by this operation.
                        var candidateScore = candidate.readability.contentScore * (1 - this._getLinkDensity(candidate));
                        candidate.readability.contentScore = candidateScore;
                        this.log("Candidate:", candidate, "with score " + candidateScore);
                        for (var t = 0; t < this._nbTopCandidates; t++) {
                            var aTopCandidate = topCandidates[t];
                            if (!aTopCandidate || candidateScore > aTopCandidate.readability.contentScore) {
                                topCandidates.splice(t, 0, candidate);
                                if (topCandidates.length > this._nbTopCandidates)
                                    topCandidates.pop();
                                break;
                            }
                        }
                    }
                    var topCandidate = topCandidates[0] || null;
                    var neededToCreateTopCandidate = false;
                    var parentOfTopCandidate;
                    // If we still have no top candidate, just use the body as a last resort.
                    // We also have to copy the body node so it is something we can modify.
                    if (topCandidate === null || topCandidate.tagName === "BODY") {
                        // Move all of the page's children into topCandidate
                        topCandidate = doc.createElement("DIV");
                        neededToCreateTopCandidate = true;
                        // Move everything (not just elements, also text nodes etc.) into the container
                        // so we even include text directly in the body:
                        while (page.firstChild) {
                            this.log("Moving child out:", page.firstChild);
                            topCandidate.appendChild(page.firstChild);
                        }
                        page.appendChild(topCandidate);
                        this._initializeNode(topCandidate);
                    } else if (topCandidate) {
                        // Find a better top candidate node if it contains (at least three) nodes which belong to `topCandidates` array
                        // and whose scores are quite closed with current `topCandidate` node.
                        var alternativeCandidateAncestors = [];
                        for (var i = 1; i < topCandidates.length; i++) {
                            if (topCandidates[i].readability.contentScore / topCandidate.readability.contentScore >= 0.75) {
                                alternativeCandidateAncestors.push(this._getNodeAncestors(topCandidates[i]));
                            }
                        }
                        var MINIMUM_TOPCANDIDATES = 3;
                        if (alternativeCandidateAncestors.length >= MINIMUM_TOPCANDIDATES) {
                            parentOfTopCandidate = topCandidate.parentNode;
                            while (parentOfTopCandidate.tagName !== "BODY") {
                                var listsContainingThisAncestor = 0;
                                for (var ancestorIndex = 0; ancestorIndex < alternativeCandidateAncestors.length && listsContainingThisAncestor < MINIMUM_TOPCANDIDATES; ancestorIndex++) {
                                    listsContainingThisAncestor += Number(alternativeCandidateAncestors[ancestorIndex].includes(parentOfTopCandidate));
                                }
                                if (listsContainingThisAncestor >= MINIMUM_TOPCANDIDATES) {
                                    topCandidate = parentOfTopCandidate;
                                    break;
                                }
                                parentOfTopCandidate = parentOfTopCandidate.parentNode;
                            }
                        }
                        if (!topCandidate.readability) {
                            this._initializeNode(topCandidate);
                        }
                        // Because of our bonus system, parents of candidates might have scores
                        // themselves. They get half of the node. There won't be nodes with higher
                        // scores than our topCandidate, but if we see the score going *up* in the first
                        // few steps up the tree, that's a decent sign that there might be more content
                        // lurking in other places that we want to unify in. The sibling stuff
                        // below does some of that - but only if we've looked high enough up the DOM
                        // tree.
                        parentOfTopCandidate = topCandidate.parentNode;
                        var lastScore = topCandidate.readability.contentScore;
                        // The scores shouldn't get too low.
                        var scoreThreshold = lastScore / 3;
                        while (parentOfTopCandidate.tagName !== "BODY") {
                            if (!parentOfTopCandidate.readability) {
                                parentOfTopCandidate = parentOfTopCandidate.parentNode;
                                continue;
                            }
                            var parentScore = parentOfTopCandidate.readability.contentScore;
                            if (parentScore < scoreThreshold)
                                break;
                            if (parentScore > lastScore) {
                                // Alright! We found a better parent to use.
                                topCandidate = parentOfTopCandidate;
                                break;
                            }
                            lastScore = parentOfTopCandidate.readability.contentScore;
                            parentOfTopCandidate = parentOfTopCandidate.parentNode;
                        }
                        // If the top candidate is the only child, use parent instead. This will help sibling
                        // joining logic when adjacent content is actually located in parent's sibling node.
                        parentOfTopCandidate = topCandidate.parentNode;
                        while (parentOfTopCandidate.tagName != "BODY" && parentOfTopCandidate.children.length == 1) {
                            topCandidate = parentOfTopCandidate;
                            parentOfTopCandidate = topCandidate.parentNode;
                        }
                        if (!topCandidate.readability) {
                            this._initializeNode(topCandidate);
                        }
                    }
                    // Now that we have the top candidate, look through its siblings for content
                    // that might also be related. Things like preambles, content split by ads
                    // that we removed, etc.
                    var articleContent = doc.createElement("DIV");
                    if (isPaging)
                        articleContent.id = "readability-content";
                    var siblingScoreThreshold = Math.max(10, topCandidate.readability.contentScore * 0.2);
                    // Keep potential top candidate's parent node to try to get text direction of it later.
                    parentOfTopCandidate = topCandidate.parentNode;
                    var siblings = parentOfTopCandidate.children;
                    for (var s = 0, sl = siblings.length; s < sl; s++) {
                        var sibling = siblings[s];
                        var append = false;
                        this.log("Looking at sibling node:", sibling, sibling.readability ? ("with score " + sibling.readability.contentScore) : "");
                        this.log("Sibling has score", sibling.readability ? sibling.readability.contentScore : "Unknown");
                        if (sibling === topCandidate) {
                            append = true;
                        } else {
                            var contentBonus = 0;
                            // Give a bonus if sibling nodes and top candidates have the example same classname
                            if (sibling.className === topCandidate.className && topCandidate.className !== "")
                                contentBonus += topCandidate.readability.contentScore * 0.2;
                            if (sibling.readability &&
                                ((sibling.readability.contentScore + contentBonus) >= siblingScoreThreshold)) {
                                append = true;
                            } else if (sibling.nodeName === "P") {
                                var linkDensity = this._getLinkDensity(sibling);
                                var nodeContent = this._getInnerText(sibling);
                                var nodeLength = nodeContent.length;
                                if (nodeLength > 80 && linkDensity < 0.25) {
                                    append = true;
                                } else if (nodeLength < 80 && nodeLength > 0 && linkDensity === 0 &&
                                    nodeContent.search(/\.( |$)/) !== -1) {
                                    append = true;
                                }
                            }
                        }
                        if (append) {
                            this.log("Appending node:", sibling);
                            if (this.ALTER_TO_DIV_EXCEPTIONS.indexOf(sibling.nodeName) === -1) {
                                // We have a node that isn't a common block level element, like a form or td tag.
                                // Turn it into a div so it doesn't get filtered out later by accident.
                                this.log("Altering sibling:", sibling, "to div.");
                                sibling = this._setNodeTag(sibling, "DIV");
                            }
                            articleContent.appendChild(sibling);
                            // Fetch children again to make it compatible
                            // with DOM parsers without live collection support.
                            siblings = parentOfTopCandidate.children;
                            // siblings is a reference to the children array, and
                            // sibling is removed from the array when we call appendChild().
                            // As a result, we must revisit this index since the nodes
                            // have been shifted.
                            s -= 1;
                            sl -= 1;
                        }
                    }
                    if (this._debug)
                        this.log("Article content pre-prep: " + articleContent.innerHTML);
                    // So we have all of the content that we need. Now we clean it up for presentation.
                    this._prepArticle(articleContent);
                    if (this._debug)
                        this.log("Article content post-prep: " + articleContent.innerHTML);
                    if (neededToCreateTopCandidate) {
                        // We already created a fake div thing, and there wouldn't have been any siblings left
                        // for the previous loop, so there's no point trying to create a new div, and then
                        // move all the children over. Just assign IDs and class names here. No need to append
                        // because that already happened anyway.
                        topCandidate.id = "readability-page-1";
                        topCandidate.className = "page";
                    } else {
                        var div = doc.createElement("DIV");
                        div.id = "readability-page-1";
                        div.className = "page";
                        while (articleContent.firstChild) {
                            div.appendChild(articleContent.firstChild);
                        }
                        articleContent.appendChild(div);
                    }
                    if (this._debug)
                        this.log("Article content after paging: " + articleContent.innerHTML);
                    var parseSuccessful = true;
                    // Now that we've gone through the full algorithm, check to see if
                    // we got any meaningful content. If we didn't, we may need to re-run
                    // grabArticle with different flags set. This gives us a higher likelihood of
                    // finding the content, and the sieve approach gives us a higher likelihood of
                    // finding the -right- content.
                    var textLength = this._getInnerText(articleContent, true).length;
                    if (textLength < this._charThreshold) {
                        parseSuccessful = false;
                        page.innerHTML = pageCacheHtml;
                        if (this._flagIsActive(this.FLAG_STRIP_UNLIKELYS)) {
                            this._removeFlag(this.FLAG_STRIP_UNLIKELYS);
                            this._attempts.push({ articleContent: articleContent, textLength: textLength });
                        } else if (this._flagIsActive(this.FLAG_WEIGHT_CLASSES)) {
                            this._removeFlag(this.FLAG_WEIGHT_CLASSES);
                            this._attempts.push({ articleContent: articleContent, textLength: textLength });
                        } else if (this._flagIsActive(this.FLAG_CLEAN_CONDITIONALLY)) {
                            this._removeFlag(this.FLAG_CLEAN_CONDITIONALLY);
                            this._attempts.push({ articleContent: articleContent, textLength: textLength });
                        } else {
                            this._attempts.push({ articleContent: articleContent, textLength: textLength });
                            // No luck after removing flags, just return the longest text we found during the different loops
                            this._attempts.sort(function (a, b) {
                                return b.textLength - a.textLength;
                            });
                            // But first check if we actually have something
                            if (!this._attempts[0].textLength) {
                                return null;
                            }
                            articleContent = this._attempts[0].articleContent;
                            parseSuccessful = true;
                        }
                    }
                    if (parseSuccessful) {
                        // Find out text direction from ancestors of final top candidate.
                        var ancestors = [parentOfTopCandidate, topCandidate].concat(this._getNodeAncestors(parentOfTopCandidate));
                        this._someNode(ancestors, function (ancestor) {
                            if (!ancestor.tagName)
                                return false;
                            var articleDir = ancestor.getAttribute("dir");
                            if (articleDir) {
                                this._articleDir = articleDir;
                                return true;
                            }
                            return false;
                        });
                        return articleContent;
                    }
                }
            },
            /**
             * Check whether the input string could be a byline.
             * This verifies that the input is a string, and that the length
             * is less than 100 chars.
             *
             * @param possibleByline {string} - a string to check whether its a byline.
             * @return Boolean - whether the input string is a byline.
             */
            _isValidByline: function (byline) {
                if (typeof byline == "string" || byline instanceof String) {
                    byline = byline.trim();
                    return (byline.length > 0) && (byline.length < 100);
                }
                return false;
            },
            /**
             * Converts some of the common HTML entities in string to their corresponding characters.
             *
             * @param str {string} - a string to unescape.
             * @return string without HTML entity.
             */
            _unescapeHtmlEntities: function (str) {
                if (!str) {
                    return str;
                }
                var htmlEscapeMap = this.HTML_ESCAPE_MAP;
                return str.replace(/&(quot|amp|apos|lt|gt);/g, function (_, tag) {
                    return htmlEscapeMap[tag];
                }).replace(/&#(?:x([0-9a-z]{1,4})|([0-9]{1,4}));/gi, function (_, hex, numStr) {
                    var num = parseInt(hex || numStr, hex ? 16 : 10);
                    return String.fromCharCode(num);
                });
            },
            /**
             * Try to extract metadata from JSON-LD object.
             * For now, only Schema.org objects of type Article or its subtypes are supported.
             * @return Object with any metadata that could be extracted (possibly none)
             */
            _getJSONLD: function (doc) {
                var scripts = this._getAllNodesWithTag(doc, ["script"]);
                var metadata;
                this._forEachNode(scripts, function (jsonLdElement) {
                    if (!metadata && jsonLdElement.getAttribute("type") === "application/ld+json") {
                        try {
                            // Strip CDATA markers if present
                            var content = jsonLdElement.textContent.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, "");
                            var parsed = JSON.parse(content);
                            if (
                                !parsed["@context"] ||
                                !parsed["@context"].match(/^https?\:\/\/schema\.org$/)
                            ) {
                                return;
                            }
                            if (!parsed["@type"] && Array.isArray(parsed["@graph"])) {
                                parsed = parsed["@graph"].find(function (it) {
                                    return (it["@type"] || "").match(
                                        this.REGEXPS.jsonLdArticleTypes
                                    );
                                });
                            }
                            if (
                                !parsed ||
                                !parsed["@type"] ||
                                !parsed["@type"].match(this.REGEXPS.jsonLdArticleTypes)
                            ) {
                                return;
                            }
                            metadata = {};
                            if (typeof parsed.name === "string" && typeof parsed.headline === "string" && parsed.name !== parsed.headline) {
                                // we have both name and headline element in the JSON-LD. They should both be the same but some websites like aktualne.cz
                                // put their own name into "name" and the article title to "headline" which confuses Readability. So we try to check if either
                                // "name" or "headline" closely matches the html title, and if so, use that one. If not, then we use "name" by default.
                                var title = this._getArticleTitle();
                                var nameMatches = this._textSimilarity(parsed.name, title) > 0.75;
                                var headlineMatches = this._textSimilarity(parsed.headline, title) > 0.75;
                                if (headlineMatches && !nameMatches) {
                                    metadata.title = parsed.headline;
                                } else {
                                    metadata.title = parsed.name;
                                }
                            } else if (typeof parsed.name === "string") {
                                metadata.title = parsed.name.trim();
                            } else if (typeof parsed.headline === "string") {
                                metadata.title = parsed.headline.trim();
                            }
                            if (parsed.author) {
                                if (typeof parsed.author.name === "string") {
                                    metadata.byline = parsed.author.name.trim();
                                } else if (Array.isArray(parsed.author) && parsed.author[0] && typeof parsed.author[0].name === "string") {
                                    metadata.byline = parsed.author
                                        .filter(function (author) {
                                            return author && typeof author.name === "string";
                                        })
                                        .map(function (author) {
                                            return author.name.trim();
                                        })
                                        .join(", ");
                                }
                            }
                            if (typeof parsed.description === "string") {
                                metadata.excerpt = parsed.description.trim();
                            }
                            if (
                                parsed.publisher &&
                                typeof parsed.publisher.name === "string"
                            ) {
                                metadata.siteName = parsed.publisher.name.trim();
                            }
                            return;
                        } catch (err) {
                            this.log(err.message);
                        }
                    }
                });
                return metadata ? metadata : {};
            },
            /**
             * Attempts to get excerpt and byline metadata for the article.
             *
             * @param {Object} jsonld — object containing any metadata that
             * could be extracted from JSON-LD object.
             *
             * @return Object with optional "excerpt" and "byline" properties
             */
            _getArticleMetadata: function (jsonld) {
                var metadata = {};
                var values = {};
                var metaElements = this._doc.getElementsByTagName("meta");
                // property is a space-separated list of values
                var propertyPattern = /\s*(dc|dcterm|og|twitter)\s*:\s*(author|creator|description|title|site_name)\s*/gi;
                // name is a single value
                var namePattern = /^\s*(?:(dc|dcterm|og|twitter|weibo:(article|webpage))\s*[\.:]\s*)?(author|creator|description|title|site_name)\s*$/i;
                // Find description tags.
                this._forEachNode(metaElements, function (element) {
                    var elementName = element.getAttribute("name");
                    var elementProperty = element.getAttribute("property");
                    var content = element.getAttribute("content");
                    if (!content) {
                        return;
                    }
                    var matches = null;
                    var name = null;
                    if (elementProperty) {
                        matches = elementProperty.match(propertyPattern);
                        if (matches) {
                            // Convert to lowercase, and remove any whitespace
                            // so we can match below.
                            name = matches[0].toLowerCase().replace(/\s/g, "");
                            // multiple authors
                            values[name] = content.trim();
                        }
                    }
                    if (!matches && elementName && namePattern.test(elementName)) {
                        name = elementName;
                        if (content) {
                            // Convert to lowercase, remove any whitespace, and convert dots
                            // to colons so we can match below.
                            name = name.toLowerCase().replace(/\s/g, "").replace(/\./g, ":");
                            values[name] = content.trim();
                        }
                    }
                });
                // get title
                metadata.title = jsonld.title ||
                    values["dc:title"] ||
                    values["dcterm:title"] ||
                    values["og:title"] ||
                    values["weibo:article:title"] ||
                    values["weibo:webpage:title"] ||
                    values["title"] ||
                    values["twitter:title"];
                if (!metadata.title) {
                    metadata.title = this._getArticleTitle();
                }
                // get author
                metadata.byline = jsonld.byline ||
                    values["dc:creator"] ||
                    values["dcterm:creator"] ||
                    values["author"];
                // get description
                metadata.excerpt = jsonld.excerpt ||
                    values["dc:description"] ||
                    values["dcterm:description"] ||
                    values["og:description"] ||
                    values["weibo:article:description"] ||
                    values["weibo:webpage:description"] ||
                    values["description"] ||
                    values["twitter:description"];
                // get site name
                metadata.siteName = jsonld.siteName ||
                    values["og:site_name"];
                // in many sites the meta value is escaped with HTML entities,
                // so here we need to unescape it
                metadata.title = this._unescapeHtmlEntities(metadata.title);
                metadata.byline = this._unescapeHtmlEntities(metadata.byline);
                metadata.excerpt = this._unescapeHtmlEntities(metadata.excerpt);
                metadata.siteName = this._unescapeHtmlEntities(metadata.siteName);
                return metadata;
            },
            /**
             * Check if node is image, or if node contains exactly only one image
             * whether as a direct child or as its descendants.
             *
             * @param Element
            **/
            _isSingleImage: function (node) {
                if (node.tagName === "IMG") {
                    return true;
                }
                if (node.children.length !== 1 || node.textContent.trim() !== "") {
                    return false;
                }
                return this._isSingleImage(node.children[0]);
            },
            /**
             * Find all <noscript> that are located after <img> nodes, and which contain only one
             * <img> element. Replace the first image with the image from inside the <noscript> tag,
             * and remove the <noscript> tag. This improves the quality of the images we use on
             * some sites (e.g. Medium).
             *
             * @param Element
            **/
            _unwrapNoscriptImages: function (doc) {
                // Find img without source or attributes that might contains image, and remove it.
                // This is done to prevent a placeholder img is replaced by img from noscript in next step.
                var imgs = Array.from(doc.getElementsByTagName("img"));
                this._forEachNode(imgs, function (img) {
                    for (var i = 0; i < img.attributes.length; i++) {
                        var attr = img.attributes[i];
                        switch (attr.name) {
                            case "src":
                            case "srcset":
                            case "data-src":
                            case "data-srcset":
                                return;
                        }
                        if (/\.(jpg|jpeg|png|webp)/i.test(attr.value)) {
                            return;
                        }
                    }
                    img.parentNode.removeChild(img);
                });
                // Next find noscript and try to extract its image
                var noscripts = Array.from(doc.getElementsByTagName("noscript"));
                this._forEachNode(noscripts, function (noscript) {
                    // Parse content of noscript and make sure it only contains image
                    var tmp = doc.createElement("div");
                    tmp.innerHTML = noscript.innerHTML;
                    if (!this._isSingleImage(tmp)) {
                        return;
                    }
                    // If noscript has previous sibling and it only contains image,
                    // replace it with noscript content. However we also keep old
                    // attributes that might contains image.
                    var prevElement = noscript.previousElementSibling;
                    if (prevElement && this._isSingleImage(prevElement)) {
                        var prevImg = prevElement;
                        if (prevImg.tagName !== "IMG") {
                            prevImg = prevElement.getElementsByTagName("img")[0];
                        }
                        var newImg = tmp.getElementsByTagName("img")[0];
                        for (var i = 0; i < prevImg.attributes.length; i++) {
                            var attr = prevImg.attributes[i];
                            if (attr.value === "") {
                                continue;
                            }
                            if (attr.name === "src" || attr.name === "srcset" || /\.(jpg|jpeg|png|webp)/i.test(attr.value)) {
                                if (newImg.getAttribute(attr.name) === attr.value) {
                                    continue;
                                }
                                var attrName = attr.name;
                                if (newImg.hasAttribute(attrName)) {
                                    attrName = "data-old-" + attrName;
                                }
                                newImg.setAttribute(attrName, attr.value);
                            }
                        }
                        noscript.parentNode.replaceChild(tmp.firstElementChild, prevElement);
                    }
                });
            },
            /**
             * Removes script tags from the document.
             *
             * @param Element
            **/
            _removeScripts: function (doc) {
                this._removeNodes(this._getAllNodesWithTag(doc, ["script", "noscript"]));
            },
            /**
             * Check if this node has only whitespace and a single element with given tag
             * Returns false if the DIV node contains non-empty text nodes
             * or if it contains no element with given tag or more than 1 element.
             *
             * @param Element
             * @param string tag of child element
            **/
            _hasSingleTagInsideElement: function (element, tag) {
                // There should be exactly 1 element child with given tag
                if (element.children.length != 1 || element.children[0].tagName !== tag) {
                    return false;
                }
                // And there should be no text nodes with real content
                return !this._someNode(element.childNodes, function (node) {
                    return node.nodeType === this.TEXT_NODE &&
                        this.REGEXPS.hasContent.test(node.textContent);
                });
            },
            _isElementWithoutContent: function (node) {
                return node.nodeType === this.ELEMENT_NODE &&
                    node.textContent.trim().length == 0 &&
                    (node.children.length == 0 ||
                        node.children.length == node.getElementsByTagName("br").length + node.getElementsByTagName("hr").length);
            },
            /**
             * Determine whether element has any children block level elements.
             *
             * @param Element
             */
            _hasChildBlockElement: function (element) {
                return this._someNode(element.childNodes, function (node) {
                    return this.DIV_TO_P_ELEMS.has(node.tagName) ||
                        this._hasChildBlockElement(node);
                });
            },
            /***
             * Determine if a node qualifies as phrasing content.
             * https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Content_categories#Phrasing_content
            **/
            _isPhrasingContent: function (node) {
                return node.nodeType === this.TEXT_NODE || this.PHRASING_ELEMS.indexOf(node.tagName) !== -1 ||
                    ((node.tagName === "A" || node.tagName === "DEL" || node.tagName === "INS") &&
                        this._everyNode(node.childNodes, this._isPhrasingContent));
            },
            _isWhitespace: function (node) {
                return (node.nodeType === this.TEXT_NODE && node.textContent.trim().length === 0) ||
                    (node.nodeType === this.ELEMENT_NODE && node.tagName === "BR");
            },
            /**
             * Get the inner text of a node - cross browser compatibly.
             * This also strips out any excess whitespace to be found.
             *
             * @param Element
             * @param Boolean normalizeSpaces (default: true)
             * @return string
            **/
            _getInnerText: function (e, normalizeSpaces) {
                normalizeSpaces = (typeof normalizeSpaces === "undefined") ? true : normalizeSpaces;
                var textContent = e.textContent.trim();
                if (normalizeSpaces) {
                    return textContent.replace(this.REGEXPS.normalize, " ");
                }
                return textContent;
            },
            /**
             * Get the number of times a string s appears in the node e.
             *
             * @param Element
             * @param string - what to split on. Default is ","
             * @return number (integer)
            **/
            _getCharCount: function (e, s) {
                s = s || ",";
                return this._getInnerText(e).split(s).length - 1;
            },
            /**
             * Remove the style attribute on every e and under.
             * TODO: Test if getElementsByTagName(*) is faster.
             *
             * @param Element
             * @return void
            **/
            _cleanStyles: function (e) {
                if (!e || e.tagName.toLowerCase() === "svg")
                    return;
                // Remove `style` and deprecated presentational attributes
                for (var i = 0; i < this.PRESENTATIONAL_ATTRIBUTES.length; i++) {
                    e.removeAttribute(this.PRESENTATIONAL_ATTRIBUTES[i]);
                }
                if (this.DEPRECATED_SIZE_ATTRIBUTE_ELEMS.indexOf(e.tagName) !== -1) {
                    e.removeAttribute("width");
                    e.removeAttribute("height");
                }
                var cur = e.firstElementChild;
                while (cur !== null) {
                    this._cleanStyles(cur);
                    cur = cur.nextElementSibling;
                }
            },
            /**
             * Get the density of links as a percentage of the content
             * This is the amount of text that is inside a link divided by the total text in the node.
             *
             * @param Element
             * @return number (float)
            **/
            _getLinkDensity: function (element) {
                var textLength = this._getInnerText(element).length;
                if (textLength === 0)
                    return 0;
                var linkLength = 0;
                // XXX implement _reduceNodeList?
                this._forEachNode(element.getElementsByTagName("a"), function (linkNode) {
                    var href = linkNode.getAttribute("href");
                    var coefficient = href && this.REGEXPS.hashUrl.test(href) ? 0.3 : 1;
                    linkLength += this._getInnerText(linkNode).length * coefficient;
                });
                return linkLength / textLength;
            },
            /**
             * Get an elements class/id weight. Uses regular expressions to tell if this
             * element looks good or bad.
             *
             * @param Element
             * @return number (Integer)
            **/
            _getClassWeight: function (e) {
                if (!this._flagIsActive(this.FLAG_WEIGHT_CLASSES))
                    return 0;
                var weight = 0;
                // Look for a special classname
                if (typeof (e.className) === "string" && e.className !== "") {
                    if (this.REGEXPS.negative.test(e.className))
                        weight -= 25;
                    if (this.REGEXPS.positive.test(e.className))
                        weight += 25;
                }
                // Look for a special ID
                if (typeof (e.id) === "string" && e.id !== "") {
                    if (this.REGEXPS.negative.test(e.id))
                        weight -= 25;
                    if (this.REGEXPS.positive.test(e.id))
                        weight += 25;
                }
                return weight;
            },
            /**
             * Clean a node of all elements of type "tag".
             * (Unless it's a youtube/vimeo video. People love movies.)
             *
             * @param Element
             * @param string tag to clean
             * @return void
             **/
            _clean: function (e, tag) {
                var isEmbed = ["object", "embed", "iframe"].indexOf(tag) !== -1;
                this._removeNodes(this._getAllNodesWithTag(e, [tag]), function (element) {
                    // Allow youtube and vimeo videos through as people usually want to see those.
                    if (isEmbed) {
                        // First, check the elements attributes to see if any of them contain youtube or vimeo
                        for (var i = 0; i < element.attributes.length; i++) {
                            if (this._allowedVideoRegex.test(element.attributes[i].value)) {
                                return false;
                            }
                        }
                        // For embed with <object> tag, check inner HTML as well.
                        if (element.tagName === "object" && this._allowedVideoRegex.test(element.innerHTML)) {
                            return false;
                        }
                    }
                    return true;
                });
            },
            /**
             * Check if a given node has one of its ancestor tag name matching the
             * provided one.
             * @param  HTMLElement node
             * @param  String      tagName
             * @param  Number      maxDepth
             * @param  Function    filterFn a filter to invoke to determine whether this node 'counts'
             * @return Boolean
             */
            _hasAncestorTag: function (node, tagName, maxDepth, filterFn) {
                maxDepth = maxDepth || 3;
                tagName = tagName.toUpperCase();
                var depth = 0;
                while (node.parentNode) {
                    if (maxDepth > 0 && depth > maxDepth)
                        return false;
                    if (node.parentNode.tagName === tagName && (!filterFn || filterFn(node.parentNode)))
                        return true;
                    node = node.parentNode;
                    depth++;
                }
                return false;
            },
            /**
             * Return an object indicating how many rows and columns this table has.
             */
            _getRowAndColumnCount: function (table) {
                var rows = 0;
                var columns = 0;
                var trs = table.getElementsByTagName("tr");
                for (var i = 0; i < trs.length; i++) {
                    var rowspan = trs[i].getAttribute("rowspan") || 0;
                    if (rowspan) {
                        rowspan = parseInt(rowspan, 10);
                    }
                    rows += (rowspan || 1);
                    // Now look for column-related info
                    var columnsInThisRow = 0;
                    var cells = trs[i].getElementsByTagName("td");
                    for (var j = 0; j < cells.length; j++) {
                        var colspan = cells[j].getAttribute("colspan") || 0;
                        if (colspan) {
                            colspan = parseInt(colspan, 10);
                        }
                        columnsInThisRow += (colspan || 1);
                    }
                    columns = Math.max(columns, columnsInThisRow);
                }
                return { rows: rows, columns: columns };
            },
            /**
             * Look for 'data' (as opposed to 'layout') tables, for which we use
             * similar checks as
             * https://searchfox.org/mozilla-central/rev/f82d5c549f046cb64ce5602bfd894b7ae807c8f8/accessible/generic/TableAccessible.cpp#19
             */
            _markDataTables: function (root) {
                var tables = root.getElementsByTagName("table");
                for (var i = 0; i < tables.length; i++) {
                    var table = tables[i];
                    var role = table.getAttribute("role");
                    if (role == "presentation") {
                        table._readabilityDataTable = false;
                        continue;
                    }
                    var datatable = table.getAttribute("datatable");
                    if (datatable == "0") {
                        table._readabilityDataTable = false;
                        continue;
                    }
                    var summary = table.getAttribute("summary");
                    if (summary) {
                        table._readabilityDataTable = true;
                        continue;
                    }
                    var caption = table.getElementsByTagName("caption")[0];
                    if (caption && caption.childNodes.length > 0) {
                        table._readabilityDataTable = true;
                        continue;
                    }
                    // If the table has a descendant with any of these tags, consider a data table:
                    var dataTableDescendants = ["col", "colgroup", "tfoot", "thead", "th"];
                    var descendantExists = function (tag) {
                        return !!table.getElementsByTagName(tag)[0];
                    };
                    if (dataTableDescendants.some(descendantExists)) {
                        this.log("Data table because found data-y descendant");
                        table._readabilityDataTable = true;
                        continue;
                    }
                    // Nested tables indicate a layout table:
                    if (table.getElementsByTagName("table")[0]) {
                        table._readabilityDataTable = false;
                        continue;
                    }
                    var sizeInfo = this._getRowAndColumnCount(table);
                    if (sizeInfo.rows >= 10 || sizeInfo.columns > 4) {
                        table._readabilityDataTable = true;
                        continue;
                    }
                    // Now just go by size entirely:
                    table._readabilityDataTable = sizeInfo.rows * sizeInfo.columns > 10;
                }
            },
            /* convert images and figures that have properties like data-src into images that can be loaded without JS */
            _fixLazyImages: function (root) {
                this._forEachNode(this._getAllNodesWithTag(root, ["img", "picture", "figure"]), function (elem) {
                    // In some sites (e.g. Kotaku), they put 1px square image as base64 data uri in the src attribute.
                    // So, here we check if the data uri is too short, just might as well remove it.
                    if (elem.src && this.REGEXPS.b64DataUrl.test(elem.src)) {
                        // Make sure it's not SVG, because SVG can have a meaningful image in under 133 bytes.
                        var parts = this.REGEXPS.b64DataUrl.exec(elem.src);
                        if (parts[1] === "image/svg+xml") {
                            return;
                        }
                        // Make sure this element has other attributes which contains image.
                        // If it doesn't, then this src is important and shouldn't be removed.
                        var srcCouldBeRemoved = false;
                        for (var i = 0; i < elem.attributes.length; i++) {
                            var attr = elem.attributes[i];
                            if (attr.name === "src") {
                                continue;
                            }
                            if (/\.(jpg|jpeg|png|webp)/i.test(attr.value)) {
                                srcCouldBeRemoved = true;
                                break;
                            }
                        }
                        // Here we assume if image is less than 100 bytes (or 133B after encoded to base64)
                        // it will be too small, therefore it might be placeholder image.
                        if (srcCouldBeRemoved) {
                            var b64starts = elem.src.search(/base64\s*/i) + 7;
                            var b64length = elem.src.length - b64starts;
                            if (b64length < 133) {
                                elem.removeAttribute("src");
                            }
                        }
                    }
                    // also check for "null" to work around https://github.com/jsdom/jsdom/issues/2580
                    if ((elem.src || (elem.srcset && elem.srcset != "null")) && elem.className.toLowerCase().indexOf("lazy") === -1) {
                        return;
                    }
                    for (var j = 0; j < elem.attributes.length; j++) {
                        attr = elem.attributes[j];
                        if (attr.name === "src" || attr.name === "srcset" || attr.name === "alt") {
                            continue;
                        }
                        var copyTo = null;
                        if (/\.(jpg|jpeg|png|webp)\s+\d/.test(attr.value)) {
                            copyTo = "srcset";
                        } else if (/^\s*\S+\.(jpg|jpeg|png|webp)\S*\s*$/.test(attr.value)) {
                            copyTo = "src";
                        }
                        if (copyTo) {
                            //if this is an img or picture, set the attribute directly
                            if (elem.tagName === "IMG" || elem.tagName === "PICTURE") {
                                elem.setAttribute(copyTo, attr.value);
                            } else if (elem.tagName === "FIGURE" && !this._getAllNodesWithTag(elem, ["img", "picture"]).length) {
                                //if the item is a <figure> that does not contain an image or picture, create one and place it inside the figure
                                //see the nytimes-3 testcase for an example
                                var img = this._doc.createElement("img");
                                img.setAttribute(copyTo, attr.value);
                                elem.appendChild(img);
                            }
                        }
                    }
                });
            },
            _getTextDensity: function (e, tags) {
                var textLength = this._getInnerText(e, true).length;
                if (textLength === 0) {
                    return 0;
                }
                var childrenLength = 0;
                var children = this._getAllNodesWithTag(e, tags);
                this._forEachNode(children, (child) => childrenLength += this._getInnerText(child, true).length);
                return childrenLength / textLength;
            },
            /**
             * Clean an element of all tags of type "tag" if they look fishy.
             * "Fishy" is an algorithm based on content length, classnames, link density, number of images & embeds, etc.
             *
             * @return void
             **/
            _cleanConditionally: function (e, tag) {
                if (!this._flagIsActive(this.FLAG_CLEAN_CONDITIONALLY))
                    return;
                // Gather counts for other typical elements embedded within.
                // Traverse backwards so we can remove nodes at the same time
                // without effecting the traversal.
                //
                // TODO: Consider taking into account original contentScore here.
                this._removeNodes(this._getAllNodesWithTag(e, [tag]), function (node) {
                    // First check if this node IS data table, in which case don't remove it.
                    var isDataTable = function (t) {
                        return t._readabilityDataTable;
                    };
                    var isList = tag === "ul" || tag === "ol";
                    if (!isList) {
                        var listLength = 0;
                        var listNodes = this._getAllNodesWithTag(node, ["ul", "ol"]);
                        this._forEachNode(listNodes, (list) => listLength += this._getInnerText(list).length);
                        isList = listLength / this._getInnerText(node).length > 0.9;
                    }
                    if (tag === "table" && isDataTable(node)) {
                        return false;
                    }
                    // Next check if we're inside a data table, in which case don't remove it as well.
                    if (this._hasAncestorTag(node, "table", -1, isDataTable)) {
                        return false;
                    }
                    if (this._hasAncestorTag(node, "code")) {
                        return false;
                    }
                    var weight = this._getClassWeight(node);
                    this.log("Cleaning Conditionally", node);
                    var contentScore = 0;
                    if (weight + contentScore < 0) {
                        return true;
                    }
                    if (this._getCharCount(node, ",") < 10) {
                        // If there are not very many commas, and the number of
                        // non-paragraph elements is more than paragraphs or other
                        // ominous signs, remove the element.
                        var p = node.getElementsByTagName("p").length;
                        var img = node.getElementsByTagName("img").length;
                        var li = node.getElementsByTagName("li").length - 100;
                        var input = node.getElementsByTagName("input").length;
                        var headingDensity = this._getTextDensity(node, ["h1", "h2", "h3", "h4", "h5", "h6"]);
                        var embedCount = 0;
                        var embeds = this._getAllNodesWithTag(node, ["object", "embed", "iframe"]);
                        for (var i = 0; i < embeds.length; i++) {
                            // If this embed has attribute that matches video regex, don't delete it.
                            for (var j = 0; j < embeds[i].attributes.length; j++) {
                                if (this._allowedVideoRegex.test(embeds[i].attributes[j].value)) {
                                    return false;
                                }
                            }
                            // For embed with <object> tag, check inner HTML as well.
                            if (embeds[i].tagName === "object" && this._allowedVideoRegex.test(embeds[i].innerHTML)) {
                                return false;
                            }
                            embedCount++;
                        }
                        var linkDensity = this._getLinkDensity(node);
                        var contentLength = this._getInnerText(node).length;
                        var haveToRemove =
                            (img > 1 && p / img < 0.5 && !this._hasAncestorTag(node, "figure")) ||
                            (!isList && li > p) ||
                            (input > Math.floor(p / 3)) ||
                            (!isList && headingDensity < 0.9 && contentLength < 25 && (img === 0 || img > 2) && !this._hasAncestorTag(node, "figure")) ||
                            (!isList && weight < 25 && linkDensity > 0.2) ||
                            (weight >= 25 && linkDensity > 0.5) ||
                            ((embedCount === 1 && contentLength < 75) || embedCount > 1);
                        // Allow simple lists of images to remain in pages
                        if (isList && haveToRemove) {
                            for (var x = 0; x < node.children.length; x++) {
                                let child = node.children[x];
                                // Don't filter in lists with li's that contain more than one child
                                if (child.children.length > 1) {
                                    return haveToRemove;
                                }
                            }
                            li_count = node.getElementsByTagName("li").length;
                            // Only allow the list to remain if every li contains an image
                            if (img == li_count) {
                                return false;
                            }
                        }
                        return haveToRemove;
                    }
                    return false;
                });
            },
            /**
             * Clean out elements that match the specified conditions
             *
             * @param Element
             * @param Function determines whether a node should be removed
             * @return void
             **/
            _cleanMatchedNodes: function (e, filter) {
                var endOfSearchMarkerNode = this._getNextNode(e, true);
                var next = this._getNextNode(e);
                while (next && next != endOfSearchMarkerNode) {
                    if (filter.call(this, next, next.className + " " + next.id)) {
                        next = this._removeAndGetNext(next);
                    } else {
                        next = this._getNextNode(next);
                    }
                }
            },
            /**
             * Clean out spurious headers from an Element.
             *
             * @param Element
             * @return void
            **/
            _cleanHeaders: function (e) {
                let headingNodes = this._getAllNodesWithTag(e, ["h1", "h2"]);
                this._removeNodes(headingNodes, function (node) {
                    let shouldRemove = this._getClassWeight(node) < 0;
                    if (shouldRemove) {
                        this.log("Removing header with low class weight:", node);
                    }
                    return shouldRemove;
                });
            },
            /**
             * Check if this node is an H1 or H2 element whose content is mostly
             * the same as the article title.
             *
             * @param Element  the node to check.
             * @return boolean indicating whether this is a title-like header.
             */
            _headerDuplicatesTitle: function (node) {
                if (node.tagName != "H1" && node.tagName != "H2") {
                    return false;
                }
                var heading = this._getInnerText(node, false);
                this.log("Evaluating similarity of header:", heading, this._articleTitle);
                return this._textSimilarity(this._articleTitle, heading) > 0.75;
            },
            _flagIsActive: function (flag) {
                return (this._flags & flag) > 0;
            },
            _removeFlag: function (flag) {
                this._flags = this._flags & ~flag;
            },
            _isProbablyVisible: function (node) {
                // Have to null-check node.style and node.className.indexOf to deal with SVG and MathML nodes.
                return (!node.style || node.style.display != "none")
                    && !node.hasAttribute("hidden")
                    //check for "fallback-image" so that wikimedia math images are displayed
                    && (!node.hasAttribute("aria-hidden") || node.getAttribute("aria-hidden") != "true" || (node.className && node.className.indexOf && node.className.indexOf("fallback-image") !== -1));
            },
            /**
             * Runs readability.
             *
             * Workflow:
             *  1. Prep the document by removing script tags, css, etc.
             *  2. Build readability's DOM tree.
             *  3. Grab the article content from the current dom tree.
             *  4. Replace the current DOM tree with the new one.
             *  5. Read peacefully.
             *
             * @return void
             **/
            parse: function () {
                // Avoid parsing too large documents, as per configuration option
                if (this._maxElemsToParse > 0) {
                    var numTags = this._doc.getElementsByTagName("*").length;
                    if (numTags > this._maxElemsToParse) {
                        throw new Error("Aborting parsing document; " + numTags + " elements found");
                    }
                }
                // Unwrap image from noscript
                this._unwrapNoscriptImages(this._doc);
                // Extract JSON-LD metadata before removing scripts
                var jsonLd = this._disableJSONLD ? {} : this._getJSONLD(this._doc);
                // Remove script tags from the document.
                this._removeScripts(this._doc);
                this._prepDocument();
                var metadata = this._getArticleMetadata(jsonLd);
                this._articleTitle = metadata.title;
                var articleContent = this._grabArticle();
                if (!articleContent)
                    return null;
                this.log("Grabbed: " + articleContent.innerHTML);
                this._postProcessContent(articleContent);
                // If we haven't found an excerpt in the article's metadata, use the article's
                // first paragraph as the excerpt. This is used for displaying a preview of
                // the article's content.
                if (!metadata.excerpt) {
                    var paragraphs = articleContent.getElementsByTagName("p");
                    if (paragraphs.length > 0) {
                        metadata.excerpt = paragraphs[0].textContent.trim();
                    }
                }
                var textContent = articleContent.textContent;
                return {
                    title: this._articleTitle,
                    byline: metadata.byline || this._articleByline,
                    dir: this._articleDir,
                    lang: this._articleLang,
                    content: this._serializer(articleContent),
                    textContent: textContent,
                    length: textContent.length,
                    excerpt: metadata.excerpt,
                    siteName: metadata.siteName || this._articleSiteName
                };
            }
        };
        return Readability;
    })();
}
((myApp_SummChat) => {
    const OPTIONSICON_URL = chrome.runtime.getURL("images/settings.png");
    const OPTIONSPAGE_URL = chrome.runtime.getURL('options.html');
    const OPTIONSPAGEBUTTON_ID = 'optionPageButton';
    const GIFSPINNER_ID = 'gifSpinner';
    const LOGIN_ID = 'loginContainer';
    const CONVERSATION_ID = 'conversationContainer';
    const WARN_ID = 'warnContainer';
    const WARN_MESSAGE_ID = 'warnMessage';
    const INPUTBUTTON_ID = 'inputButton';
    const TRANSLATEBUTTON_ID = 'translateButton';
    const CONTINUEBUTTON_ID = 'continueButton';
    const CLOSEBUTTON_ID = 'closeButton';
    class ContentBase {
        constructor(config) {
            this.cssCommonFile = 'content.css';
            this.config = config;
            this.port = chrome.runtime.connect({ name: this.config.portName });
            this.popupContentWindow();
            this.showElement(GIFSPINNER_ID);
        }
        createCssLink(fileName) {
            const url = chrome.runtime.getURL(fileName);
            const link = document.createElement('link');
            link.setAttribute('rel', 'stylesheet');
            link.setAttribute("type", "text/css");
            link.setAttribute('href', url);
            return link;
        }
        elementById(id) {
            const shadowRoot = document.getElementById(this.config.windowId).shadowRoot;
            if (shadowRoot) {
                return shadowRoot.getElementById(id);
            }
            return undefined;
        }
        showElement(id) {
            const el = this.elementById(id);
            if (el) {
                el.classList.remove('d-none');
            }
        }
        hideElement(id) {
            const el = this.elementById(id);
            if (el) {
                el.classList.add('d-none');
            }
        }
        closeContentWindow() {
            const contentWindow = document.getElementById(this.config.windowId);
            if (contentWindow && contentWindow.parentNode) {
                contentWindow.parentNode.removeChild(contentWindow);
                try {
                    this.port.postMessage({ close: this.config.contentType });
                    this.port.disconnect();
                }
                catch {
                }
            }
        }
        popupContentWindow() {
            if (!!document.getElementById(this.config.windowId)) {
                console.log('SummBeyond: content window(' + this.config.windowId + ') already present.');
                return;
            }
            const contentWindow = document.createElement("div");
            contentWindow.id = this.config.windowId;
            contentWindow.style.fontSize = "16px";
            contentWindow.attachShadow({ mode: "open" });
            contentWindow.shadowRoot.appendChild(this.createCssLink(this.cssCommonFile));
            contentWindow.shadowRoot.appendChild(this.createCssLink(this.config.cssFile));
            const container = document.createElement('div');
            container.id = this.config.containerId;
            container.className = this.config.containerClassName;
            container.innerHTML = this.config.innerHTML;
            contentWindow.shadowRoot.appendChild(container);
            const body = document.getElementsByTagName('body')[0];
            if (body) {
                body.append(contentWindow);
            }
            else {
                console.log("获取body失败");
            }
            setTimeout(() => { 
                const closeButton = this.elementById(CLOSEBUTTON_ID);
                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        this.closeContentWindow();
                    });
                }
                const opButton = this.elementById(OPTIONSPAGEBUTTON_ID);
                if (opButton) {
                    opButton.addEventListener('click', () => {
                        if (chrome.runtime.openOptionsPage) {
                            chrome.runtime.openOptionsPage();
                        } else {
                            window.open(OPTIONSPAGE_URL);
                        }
                    });
                }
            }, 500);
        }
    }
    class ConfigMain {
        constructor() {
            this.contentType = 'mainWindow';
            this.windowId = 'summarymaster_content_window';
            this.containerId = 'summarymaster_container';
            this.containerClassName = 'summarymaster_container';
            this.portName = 'port_main';
            this.cssFile = 'content_main.css';
            this.innerHTML = `
            <nav class="navbar">
                <div id="navContainer">
                    <div id="${OPTIONSPAGEBUTTON_ID}">
                        <img src="${OPTIONSICON_URL}" style="height: auto; width: 100%; object-fit: contain; margin-top: 4px; margin-bottom: 4px;" title="settings">
                    </div>
                    <span id="${GIFSPINNER_ID}" role="status"></span>
                    <button id="${CLOSEBUTTON_ID}">X</button>
                </div>
            </nav>
            <div class="d-none" id="${LOGIN_ID}">
                <p>Please <a href="https://chat.openai.com" target="_blank" rel="noreferrer" id="loginButton" class="card-link">Login</a> to OpenAI, then try again.</p>
            </div>
            <div class="d-none" id="${WARN_ID}">
                <div id="${WARN_MESSAGE_ID}">
                    <p></p>
                </div>
            </div>
            <div id="${CONVERSATION_ID}" class="d-none">
            </div>
            <div class="input-container">               
                <textarea id="conversationInput" placeholder="Type your message here"></textarea>
                <button id="${INPUTBUTTON_ID}" class="my-button" disabled="">
                    <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 mr-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        `;
        }
    }
    /*
    class ConfigB {
        constructor() {
            this.contentType = 'B';
            this.portName = PORT_SUMMARY;
        }
    }*/
    class ContentMain extends ContentBase {
        constructor() {
            super(new ConfigMain());
            window.addEventListener("beforeunload", () => {
                try {
                    this.port.disconnect();
                }
                catch (error) {
                    console.log('An error occurred while disconnecting the port:', error);
                }
            });
            this.ongoingState = false;
            this.scrolledToBottom = true;
            const conversationContainer = this.elementById(CONVERSATION_ID);
            conversationContainer.addEventListener("scroll", () => {
                if (conversationContainer.scrollTop + conversationContainer.clientHeight >= conversationContainer.scrollHeight - 10) {
                    this.scrolledToBottom = true;
                } else {
                    this.scrolledToBottom = false;
                }
            });
            const textarea = this.elementById("conversationInput");
            textarea.addEventListener('input', (e) => {
                textarea.style.height = 'calc(1.2em + 5px)'; 
                textarea.style.height = e.target.scrollHeight + 'px';
                const inputButton = this.elementById(INPUTBUTTON_ID);
                if (textarea.value.length > 0 && !this.ongoingState) {
                    inputButton.disabled = false;
                } else {
                    inputButton.disabled = true;
                }
            });
            textarea.addEventListener('keydown', (event) => {
                if (event.keyCode === 13) {
                    if (!event.shiftKey) {
                        event.preventDefault(); 
                        const message = textarea.value;
                        this.showMessage('sent', message);
                        this.sendToBackground('sendText', message);
                        textarea.value = ''; 
                    }
                }
            });
            const inputButton = this.elementById(INPUTBUTTON_ID);
            inputButton.addEventListener('click', () => {
                const message = textarea.value;
                this.showMessage('sent', message);
                this.sendToBackground('sendText', message);
                textarea.value = ''; 
            });
            this.currentUrl = document.URL;
            this.port.onMessage.addListener((response) => {
                if (response.hasOwnProperty("ongoingState")) {
                    this.ongoingState = response.ongoingState;
                }
                if (response.event === 'DONE') {
                    this.hideElement(GIFSPINNER_ID);
                    console.log('Completed the summary');
                    const textarea = this.elementById("conversationInput");
                    const inputButton = this.elementById(INPUTBUTTON_ID);
                    if (textarea.value.length > 0 && !this.ongoingState) {
                        inputButton.disabled = false;
                    }
                    chrome.storage.sync.get().then((data) => {
                        const options = data.currentOptions;
                        if (!!options) {
                            if (options.translationTo.bEnable && options.translationTo.languageName.trim() !== '') {
                                this.addToolButton(
                                    TRANSLATEBUTTON_ID,
                                    `translate to ${options.translationTo.languageName.trim()}`,
                                    `<svg viewBox="0 0 24 24" fill="none" stroke="#f5f5f5" stroke-width="0.2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 mr-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M14.1663 4.02879C14.4267 4.12094 14.563 4.40666 14.4709 4.66698C14.3501 5.008 14.2182 5.47722 14.1178 5.8606C14.6877 5.77599 15.2665 5.65666 15.8867 5.51301C16.1557 5.4507 16.4243 5.61827 16.4866 5.88729C16.5489 6.15631 16.3814 6.42491 16.1123 6.48722C15.339 6.66633 14.6101 6.81302 13.8717 6.90296C13.7759 7.35666 13.7014 7.77096 13.6451 8.15033C14.1202 8.04612 14.5738 8.00566 14.9996 8.02087L14.9996 8.00012C14.9996 7.72398 15.2235 7.50012 15.4996 7.50012C15.7758 7.50012 15.9996 7.72398 15.9996 8.00012C15.9996 8.0567 15.9991 8.11293 15.9979 8.16883C17.1392 8.47851 17.9781 9.23999 18.3435 10.2265C18.9579 11.8855 18.1287 13.8788 15.7027 14.957C15.4504 15.0692 15.1549 14.9555 15.0427 14.7032C14.9306 14.4508 15.0442 14.1554 15.2966 14.0432C17.3705 13.1215 17.7913 11.6148 17.4057 10.5738C17.1874 9.98412 16.6776 9.44929 15.9129 9.18645C15.6829 10.7238 15.021 11.9467 14.229 12.7927C14.3126 12.9657 14.3958 13.1437 14.4641 13.3153C14.5662 13.5718 14.441 13.8626 14.1844 13.9647C13.9278 14.0668 13.637 13.9416 13.5349 13.685C13.5066 13.6139 13.4777 13.5464 13.448 13.4803C13.028 13.7795 12.5905 13.987 12.1705 14.0836C11.5942 14.2162 10.963 14.1518 10.534 13.6943C9.88917 13.0054 9.84361 11.8612 10.2855 10.8413C10.6652 9.96491 11.4186 9.11794 12.5848 8.54046C12.6387 8.0735 12.7199 7.55906 12.8332 6.98903C12.3926 7.00767 11.9403 7.00338 11.4659 6.97139C11.1904 6.95281 10.9821 6.7144 11.0007 6.43889C11.0192 6.16337 11.2577 5.95508 11.5332 5.97366C12.0633 6.0094 12.5641 6.00784 13.0566 5.97565C13.1605 5.55456 13.3512 4.83322 13.5282 4.3333C13.6203 4.07298 13.906 3.93665 14.1663 4.02879ZM12.501 9.74121C11.8436 10.1822 11.427 10.7221 11.2031 11.2388C10.8542 12.044 10.9881 12.7161 11.2638 13.0106C11.2637 13.0105 11.2639 13.0107 11.2638 13.0106C11.3573 13.1101 11.5624 13.1974 11.9463 13.1091C12.2578 13.0374 12.6311 12.8572 13.0121 12.5578C12.8658 12.2201 12.7272 11.8325 12.6313 11.3532C12.5405 10.8997 12.4899 10.3744 12.501 9.74121ZM13.7808 11.7798C14.316 11.0957 14.759 10.1667 14.9271 9.01644C14.539 9.00693 14.1111 9.05613 13.6457 9.17867C13.605 9.19286 13.5647 9.20738 13.525 9.22221C13.4663 10.0546 13.5146 10.6711 13.6118 11.1569C13.6578 11.3869 13.7156 11.5914 13.7808 11.7798Z" fill="#212121"/><path d="M6.92028 5.21603C5.77942 4.8841 4.78409 5.00853 4.07616 5.21588C3.72264 5.31942 3.439 5.44405 3.24121 5.54442C3.14215 5.59469 3.0641 5.63913 3.00903 5.67224C2.98147 5.6888 2.95962 5.70256 2.9437 5.71283L2.92429 5.72554L2.91797 5.72979L2.91566 5.73135L2.91393 5.73254C2.91384 5.73261 2.91436 5.73337 2.94925 5.78409C3.23698 6.20238 3.1703 6.10561 2.91393 5.73254C2.68634 5.88893 2.62863 6.20021 2.78502 6.42779C2.94134 6.65527 3.25207 6.71325 3.47963 6.55715L3.4788 6.55772L3.48576 6.55317C3.49318 6.54838 3.50608 6.54022 3.52423 6.52931C3.56057 6.50747 3.6177 6.47475 3.69373 6.43617C3.84612 6.35884 4.07228 6.25902 4.35724 6.17556C4.92619 6.00892 5.72242 5.9091 6.64043 6.17607C7.35305 6.38529 7.66747 6.76931 7.82692 7.16124C7.98173 7.54175 8.0026 7.95764 8.00531 8.33256C7.46199 8.1842 6.79336 8.03694 6.08385 8.00757C5.04808 7.96468 3.8874 8.17108 2.87738 9.01115C1.98877 9.75023 1.78345 10.8819 2.07014 11.8531C2.35713 12.8253 3.14925 13.6921 4.31803 13.9349C5.22351 14.1231 6.18016 13.864 6.9599 13.5213C7.3403 13.3541 7.69572 13.1595 8.0057 12.9666V13.5001C8.0057 13.7762 8.22956 14.0001 8.5057 14.0001C8.78184 14.0001 9.0057 13.7755 9.0057 13.4994L9.0057 8.44598C9.0058 8.05416 9.00595 7.40566 8.7532 6.7844C8.48142 6.11637 7.93342 5.51326 6.92136 5.21634L6.92028 5.21603ZM6.04249 9.00671C6.76366 9.03657 7.44769 9.20912 8.0057 9.37217V11.7571C7.65814 12.0183 7.13927 12.3502 6.55757 12.6058C5.85264 12.9156 5.12729 13.0817 4.52148 12.9559C3.75127 12.7958 3.22322 12.2272 3.02922 11.57C2.83491 10.9118 2.98777 10.22 3.51683 9.77997C4.27958 9.14557 5.16917 8.97055 6.04249 9.00671Z" fill="#212121"/>
                                    </svg> `,
                                    options
                                );
                            }
                            if (options.continuePrompt.bEnable && options.continuePrompt.prompt.trim() !== '') {
                                this.addToolButton(
                                    CONTINUEBUTTON_ID,
                                    "continue",
                                    `<svg stroke="grey" fill="none" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 mr-1" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M5 12h14M12 5l7 7-7 7"></path>
                                    </svg>`,
                                    options
                                );
                            }
                        }
                    });
                    return;
                }
                if (!!response.messageContent) {
                    this.hideElement(LOGIN_ID);
                    this.hideElement(WARN_ID);
                    this.showElement(GIFSPINNER_ID);
                    this.showElement(CONVERSATION_ID);
                    const rText = response.messageContent.replace(/\n\s*\n/g, '\n'); 
                    this.showMessage('received', rText);
                    this.scrollToBottomIfScrolledToBottom();
                    return;
                }
                if (!!response.cloudflarehtml) {
                    console.log("显示cloudflare验证页面");
                    return;
                }
                if (response.error === 'UNAUTHORIZED') {
                    this.hideElement(GIFSPINNER_ID);
                    this.hideElement(CONVERSATION_ID);
                    this.hideElement(WARN_ID);
                    this.showElement(LOGIN_ID);
                    return;
                }
                if (!!response.error) {
                    this.hideElement(GIFSPINNER_ID);
                    this.hideElement(LOGIN_ID);
                    this.hideElement(CONVERSATION_ID);
                    this.showElement(WARN_ID);
                    try {
                        let errorObject = JSON.parse(response.error);
                        let code = errorObject.detail && errorObject.detail.code ? errorObject.detail.code : null;
                        let message = null;
                        if (errorObject.detail) {
                            if (typeof errorObject.detail == "string") {
                                message = errorObject.detail;
                            }
                            else if (errorObject.detail.message) {
                                message = errorObject.detail.message;
                            }
                        }
                        console.log("error message:", message);
                        if (code === 'message_length_exceeds_limit') {
                            this.showWarningText('Article is too long and not supported by ChatGPT yet.');
                            return;
                        }
                        if (code === 'token_expired') {
                            this.hideElement(WARN_ID);
                            this.showElement(LOGIN_ID);
                            return;
                        }
                        if (!!message) {
                            this.showWarningText(message);
                            return;
                        }
                    }
                    catch (ex) {
                        console.log('Error parsing failed: ' + response.error);
                    }
                    this.showWarningText('Something went wrong, please refresh the page.');
                }
            });
            let article = new myApp_SummChat.Readability(document.cloneNode(true)).parse();
            this.sendToBackground('documentText', article.textContent);
        }
        sendToBackground(textKeyName, text) {
            this.removeToolButton(TRANSLATEBUTTON_ID);
            this.removeToolButton(CONTINUEBUTTON_ID);
            this.showElement(GIFSPINNER_ID);
            this.showMessage("received", ""); 
            let sendText = text.replace(/\n\s*\n/g, '\n'); 
            sendText = sendText.replace(/^[ \t]+|[ \t]+$/gm, ''); 
            this.port.postMessage({
                [textKeyName]: sendText,
            });
        }
        scrollToBottomIfScrolledToBottom() {
            if (this.scrolledToBottom) {
                const conversationContainer = this.elementById(CONVERSATION_ID);
                conversationContainer.scrollTop = conversationContainer.scrollHeight;
            }
        }
        showWarningText(warning) {
            const warn_message = this.elementById(WARN_MESSAGE_ID);
            const pElement = warn_message.querySelector('p');
            pElement.innerText = warning;
        }
        showMessage(type, message) {
            const conversationContainer = this.elementById(CONVERSATION_ID);
            const chatMessages = conversationContainer.getElementsByClassName('chat-message');
            const lastMessage = chatMessages.length > 0 ? chatMessages[chatMessages.length - 1] : null;
            if (this.ongoingState && type === 'received' && lastMessage && lastMessage.classList.contains(type)) {
                const messageContent = lastMessage.querySelector('.message-text p');
                messageContent.innerText = message;
            }
            else {
                const messageElement = document.createElement('div');
                messageElement.classList.add('chat-message', type);
                const messageText = document.createElement('div');
                messageText.classList.add('message-text');
                const messageContent = document.createElement('p');
                messageContent.innerText = message;
                messageText.appendChild(messageContent);
                messageElement.appendChild(messageText);
                conversationContainer.appendChild(messageElement);
            }
        }
        addToolButton(buttonID, buttonTitle, buttonSVG, options) {
            const conversationContainer = this.elementById(CONVERSATION_ID);
            const button = document.createElement("button");
            button.id = buttonID;
            button.className = "my-button";
            button.title = buttonTitle;
            button.innerHTML = buttonSVG;
            const lastReceivedElement = conversationContainer.querySelector(".chat-message.received:last-child");
            if (lastReceivedElement) {
                lastReceivedElement.appendChild(button);
                const buttonLis = this.elementById(buttonID);
                buttonLis.addEventListener('click', () => {
                    const messageText = lastReceivedElement.querySelector(".message-text").textContent;
                    if (buttonID === TRANSLATEBUTTON_ID) {
                        const lan = options.translationTo.languageName.trim();
                        const prompt = `Translate to ${lan}: `;
                        this.sendToBackground('sendText', prompt + "```" + messageText + "```");
                    }
                    if (buttonID === CONTINUEBUTTON_ID) {
                        const prompt = options.continuePrompt.prompt;
                        this.sendToBackground('sendText', prompt);
                    }
                });
            }
        }
        removeToolButton(buttonID) {
            const button = this.elementById(buttonID);
            if (button) {
                const parentElement = button.parentElement;
                if (parentElement) {
                    parentElement.removeChild(button);
                }
            }
        }
    }
    function messageListener(message, sender, sendResponse) {
        if (message.type === "content_main") {
            console.log("收到消息：content_main");
            const content_main = new ContentMain();
        }
        else if (message.type === "content_popup") {
            console.log("收到消息：content_popup");
        }
        chrome.runtime.onMessage.removeListener(messageListener);
    }
    chrome.runtime.onMessage.addListener(messageListener);
})(myApp_SummChat);
