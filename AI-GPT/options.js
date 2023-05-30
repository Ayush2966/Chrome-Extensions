(() => {
    function getOptions(data, flag) {
        let options = null;
        if (flag === 'default') {
            if (data.defaultOptions) {
                options = data.defaultOptions;
            }
        }
        if (flag === 'current') {
            if (data.currentOptions) {
                options = data.currentOptions;
            }
        }
        if (!options) {
            options = {
                summaryPrompt: chrome.i18n.getMessage("summaryPrompt").trim(),
                translationTo: {
                    bEnable: false,
                    languageName: ""
                },
                continuePrompt: {
                    bEnable: true,
                    prompt: chrome.i18n.getMessage("continuePrompt").trim()
                }
            };
        }
        return options;
    }
    const textarea_s = document.getElementById("summaryPromptInput");
    textarea_s.addEventListener('input', (e) => {
        textarea_s.style.height = 'calc(2.4em + 5px)'; 
        textarea_s.style.height = e.target.scrollHeight + 'px';
    });
    const textarea_c = document.getElementById("continuePromptInput");
    textarea_c.addEventListener('input', (e) => {
        textarea_c.style.height = 'calc(1.2em + 5px)'; 
        textarea_c.style.height = e.target.scrollHeight + 'px';
    });
    const resetContinuePrompt = document.getElementById("resetContinuePrompt");
    resetContinuePrompt.addEventListener('click', () => {
        chrome.storage.sync.get().then((data) => {
            const options = getOptions(data, 'default');
            document.getElementById('continueCheckbox').checked = options.continuePrompt.bEnable;
            document.getElementById('continuePromptInput').value = options.continuePrompt.prompt;
        });
    });
    const resetSummaryPrompt = document.getElementById("resetSummaryPrompt");
    resetSummaryPrompt.addEventListener('click', () => {
        chrome.storage.sync.get().then((data) => {
            const options = getOptions(data, 'default');
            document.getElementById('summaryPromptInput').value = options.summaryPrompt;
        });
    });
    const saveButton = document.getElementById("saveButton");
    saveButton.addEventListener('click', async () => {
        const options = {
            summaryPrompt: document.getElementById('summaryPromptInput').value.trim(),
            translationTo: {
                bEnable: document.getElementById('translationCheckbox').checked,
                languageName: document.getElementById('languageNameInput').value.trim()
            },
            continuePrompt: {
                bEnable: document.getElementById('continueCheckbox').checked,
                prompt: document.getElementById('continuePromptInput').value.trim()
            }
        };
        try {
            await chrome.storage.sync.set({ currentOptions: options });
            const notice = document.createElement("div");
            notice.textContent = "Your changes have been saved!";
            saveButton.parentElement.appendChild(notice);
            setTimeout(function () {
                saveButton.parentElement.removeChild(notice);
            }, 2000);
        } catch (error) {
            console.error(error);
            const notice = document.createElement("div");
            notice.textContent = "Something wrong...";
            saveButton.parentElement.appendChild(notice);
        }
    });
    const restoreOptions = () => {
        chrome.storage.sync.get().then((data) => {
            const options = getOptions(data, 'current');
            document.getElementById('summaryPromptInput').value = options.summaryPrompt;
            document.getElementById('translationCheckbox').checked = options.translationTo.bEnable;
            document.getElementById('languageNameInput').value = options.translationTo.languageName;
            document.getElementById('continueCheckbox').checked = options.continuePrompt.bEnable;
            document.getElementById('continuePromptInput').value = options.continuePrompt.prompt;
        });
    };
    document.addEventListener('DOMContentLoaded', restoreOptions);
})();