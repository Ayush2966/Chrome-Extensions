chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        title: `Open with vscode.dev`,
        id: 'open-with-vscode-dev',
        documentUrlPatterns: ["https://github.com/*/*"],
    })
})

chrome.contextMenus.onClicked.addListener(() => {
    getCurrentTab()
        .then(tab => {
            openWithVScodeDev(tab.url)
        })
        .catch(err => console.error(err))
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return

    if (!isGithubPage(tab.url)) return

    chrome.scripting.executeScript({
        target: {
            tabId: tabId
        },
        files: [
            './clone-in-vscode.js'
        ],
    })
})

chrome.commands.onCommand.addListener((command) => {
    getCurrentTab()
        .then(tab => {
            if (!isGithubPage(tab.url)) return

            if (command === "open-with-vscodedev") {
                openWithVScodeDev(tab.url)
            }

            if (command === "clone-in-vscode") {
                let repoUrl = tab.url
                    .replace(/\/blob\/.{0,255}/g, '')
                    .replace(/\/tree\/.{0,255}/g, '')
                    .replace(/\/commit\/.{0,255}/g, '')

                repoUrl += '.git'

                cloneRepo(repoUrl)
            }
        })
        .catch(err => console.error(err))

})

const getCurrentTab = async () => {
    const queryOptions = { active: true, currentWindow: true }
    const [tab] = await chrome.tabs.query(queryOptions)

    return tab
}

const isGithubPage = (url) => {
    const githubPageRegex = new RegExp(/^(https?:\/\/[www.]*github\.com\/.{1,255})$/g)

    return githubPageRegex.test(url)
}

const openWithVScodeDev = (repoUrl) => {
    chrome.tabs.create({
        url: `https://vscode.dev/${repoUrl}`
    })
}

const cloneRepo = (repoUrl) => {
    chrome.tabs.create({
        url: `vscode://vscode.git/clone?url=${repoUrl}`
    })
}