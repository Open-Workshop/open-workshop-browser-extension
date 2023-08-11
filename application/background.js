import {
    URL_DOWNLOAD,
    URL_DIRECT_DOWNLOAD,
    URL_INFO,
    URL_BATCH_STATUS,
    BATCH_LIMIT,
    COMMAND_DOWNLOAD,
    COMMAND_CHECK,
    COMMAND_CHECK_RESPONSE,
    STORE_ITEMS_LIMIT,
    STORE_DOWNLOAD_KEY,
    DOWNLOAD_PROCESS_STEP_NEW,
    DOWNLOAD_PROCESS_STEP_INFO,
    DOWNLOAD_PROCESS_STEP_WAIT,
    DOWNLOAD_PROCESS_STEP_READY,
    DOWNLOAD_PROCESS_STEP_MANUALLY,
    INFO_CONDITION_PARTIAL,
    INFO_CONDITION_READY_TO_DOWNLOAD,
    INFO_CONDITION_DOWNLOADING,
    RETRY_TIMEOUT_MS,
    COMMAND_UPDATE_DATA_REQUEST,
    COMMAND_UPDATE_DATA_RESPONSE,
    STORE_HISTORY_KEY,
    COMMAND_REPEAT_DOWNLOAD,
    COMMAND_REMOVE_DOWNLOAD,
} from './constants.js'

const downloadPageUrl = chrome.runtime.getURL('download.html')

/**
 * Хранилище chrome.storage.local асинхронное, паралельная работа с ним
 * может вызвать нежелательные артефакты. storage нужен для того что бы
 * сделать работу с хранилищем синхронной а перенос в chrome.storage безопасным.
 * Пока storage.ready == false использовать методы storage нельзя
 */
let storage = {
    sync: false,
    ready: new Promise(resolve => null),
    resolver: false,
    data: {
        [STORE_DOWNLOAD_KEY]: {},
        [STORE_HISTORY_KEY]: {},
    },
    readyResolver (resolve) {
        resolve()
    },
    getItemFromStorage (key, id) {
        return this.data[key][id]
    },
    getItemsFromStorage (key) {
        return Object.values(this.data[key])
    },
    setItemToStorage (key, item) {
        this.data[key][item.id] = item
        this.runSync()
    },
    setItemsToStorage (key, items) {
        for (let item of items) {
            this.setItemToStorage(key, item)
        }
    },
    async runSync () {
        if (this.sync) {
            return
        }

        this.sync = true
        await timeout(250)
        await this.sync()
        this.sync = false
    },
    async init () {
        for (let key in this.data) {
            let storage = await chrome.storage.local.get(key)

            if (!storage[key]) {
                storage = {
                    [key]: [],
                }
            }

            for (let item of storage[key]) {
                this.data[key][item.id] = item
            }
        }

        this.resolver()
    },
    async sync () {
        for (let key in this.data) {
            let data = {
                [key]: this.getItemsFromStorage(key),
            }

            await chrome.storage.local.set(data)
        }
    },
}

storage.ready = new Promise(resolve => {
    storage.resolver = resolve
})

storage.ready.catch(() => {
    console.log('promise failed')
})

/**
 * Констролируемые запросы.
 * Структура реализующая возможность контроля протекания fetch запросов
 */
let controlledFetch = {
    requestList: {},
    fetch (url, config, abortMarker) {
        if (!Array.isArray(abortMarker)) {
            abortMarker = [abortMarker]
        }

        let abortController = new AbortController()
        for (let marker of abortMarker) {
            if (!Array.isArray(this.requestList[marker])) {
                this.requestList[marker] = []
            }

            this.requestList[marker].push(abortController)
        }

        let response = fetch(url, { ...config, ...{ signal: abortController.signal } })

        response.finally(() => {
            for (let marker of abortMarker) {
                this.requestList[marker] = this.requestList[marker].filter(controller != abortController)
            }
        })

        return response
    },
    abort (abortMarker) {
        if (!Array.isArray(abortMarker)) {
            abortMarker = [abortMarker]
        }

        for (let marker of abortMarker) {
            if (this.requestList[marker]) {
                for (let controller of this.requestList[marker]) {
                    controller.abort({
                        name: 'AbortError',
                        ids: abortMarker,
                    })
                }
            }
        }
    },
}

/**
 * Очередь.
 * Основная структура реализующая последовательно/паралельную
 * обработку загрузки модификаций.
 */
let queue = {
    removed: [],
    workers: {},
    steps: {},
    removeItem: function (item) {
        let fixedItem
        if (item.id === undefined) {
            fixedItem = queue.getItemFromSteps(item)
        } else {
            fixedItem = item
        }

        if (!queue.removed.find(_item => _item.id == fixedItem.id)) {
            queue.removed.push(fixedItem)
        }

        queue.removeItemFromSteps(fixedItem)

        let items = storage.getItemsFromStorage(STORE_DOWNLOAD_KEY)

        items = items.filter(i => i.id != fixedItem.id)

        storage.setItemsToStorage(STORE_DOWNLOAD_KEY, items)
    },
    getItemFromSteps: function (id) {
        for (let stepName in this.steps) {
            for (let stepItem of this.steps[stepName]) {
                if (stepItem.id == id) {
                    return stepItem
                }
            }
        }
    },
    addItemToStep: function (item) {
        if (!this.steps[item.step]) {
            this.steps[item.step] = []
        }

        if (this.steps[item.step].find(value => value.id === item.id)) {
            return
        }

        this.removeItemFromSteps(item)
        this.steps[item.step].push(item)
        this.addWorker(item.step)
    },
    addWorker: function (stepKey) {
        if (!this.workers[stepKey]) {
            this.workers[stepKey] = this[stepKey]
            this.workers[stepKey]()
        }
    },
    removeWorker: function (stepKey) {
        this.workers[stepKey] = undefined
    },
    checkExists: function (item) {
        for (let stepName in this.steps) {
            for (let stepItem of this.steps[stepName]) {
                if (stepItem.id == item.id) {
                    return true
                }
            }
        }

        return false
    },
    removeItemFromSteps: function (item) {
        for (let stepName in this.steps) {
            this.steps[stepName] = this.steps[stepName].filter(fitem => fitem.id != item.id)
        }
    },
    getBatchStatus: async function (stepName, retryItems) {
        let items

        if (!retryItems) {
            let end = queue.steps[stepName].splice(BATCH_LIMIT)
            items = queue.steps[stepName]
            queue.steps[stepName] = end
        } else {
            items = retryItems
        }

        let ids = items.map(i => i.id)
        let out

        if (items && items.length > 0) {
            try {
                let response = controlledFetch.fetch(
                    URL_BATCH_STATUS + encodeURIComponent('[' + ids.join(',') + ']'),
                    {},
                    ids
                )
                out = await response.json()
            } catch (e) {
                if (e.name == 'AbortError') {
                    items = items.filter(item => e.ids.indexOf(item.id) == -1)
                    return await queue.getBatchStatus(stepName, items)
                } else {
                    console.warn(e)
                }
            }
        }

        return {
            out,
            items,
        }
    },
    moveItemsToStep: function (items, stepName) {
        for (let item of items) {
            let fixedItem
            if (item.id === undefined) {
                fixedItem = queue.getItemFromSteps(item)
            } else {
                fixedItem = item
            }

            this.moveItemToStep(fixedItem, stepName)
        }
    },
    moveItemToStep: function (item, stepName) {
        if (queue.removed.find(_item => _item.id == item.id)) {
            return
        }

        item.step = stepName
        queue.addItemToStep(item)

        let items = storage.getItemsFromStorage(STORE_DOWNLOAD_KEY)

        for (let i of items) {
            if (i.id == item.id) {
                for (let key in i) {
                    i[key] = item[key]
                }

                break
            }
        }

        storage.setItemsToStorage(STORE_DOWNLOAD_KEY, items)
        updateTabs()
    },
    downloadWithProgress: async function (item, progressCb) {
        return new Promise((resolve, reject) => {
            controlledFetch
                .fetch(URL_DIRECT_DOWNLOAD + item.id, {}, item.id)
                .then(response => {
                    var reader = response.body.getReader()
                    var bytesReceived = 0
                    var total = parseInt(response.headers.get('content-length'), 10) / 1024

                    return reader.read().then(function processResult (result) {
                        if (result.done) {
                            resolve(response)
                            return
                        }

                        bytesReceived += result.value.length

                        progressCb({
                            progress: bytesReceived / 1024,
                            total,
                        })

                        return reader.read().then(processResult)
                    })
                })
                .catch(reject)
        })
    },
    [DOWNLOAD_PROCESS_STEP_NEW]: async function () {
        let execute = () => {
            let item = queue.steps[DOWNLOAD_PROCESS_STEP_NEW].shift()

            if (!queue.checkExists(item)) {
                queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_INFO)
            }
        }

        while (queue.steps[DOWNLOAD_PROCESS_STEP_NEW].length != 0) {
            execute()
            await timeout(250)
        }

        queue.workers[DOWNLOAD_PROCESS_STEP_NEW] = undefined
    },
    [DOWNLOAD_PROCESS_STEP_INFO]: async function () {
        let execute = async () => {
            let { out, items } = await queue.getBatchStatus(DOWNLOAD_PROCESS_STEP_INFO)

            if (out == undefined) {
                if (items && items.length > 0) {
                    for (let item of items) {
                        item.info = chrome.i18n.getMessage('downloadTableStatusManuallyServerErrorBatch')
                    }

                    queue.moveItemsToStep(items, DOWNLOAD_PROCESS_STEP_MANUALLY)
                }
                return
            }

            for (let item of items) {
                let status = out[item.id]

                if (status === undefined) {
                    ;(async () => {
                        try {
                            let response = controlledFetch.fetch(URL_DOWNLOAD + item.id, {}, item.id)

                            switch (response.status) {
                                case 200:
                                    // zip recieved ?

                                    break
                                case 202: // success to download
                                    let out = await out.json()

                                    if (out.unsuccessful_attempts == true) {
                                        // item.step = DOWNLOAD_PROCESS_STEP_MANUALLY
                                        // queue.addItemToStep(item)
                                    }

                                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_WAIT)
                                    break
                                case 103: // retry
                                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_INFO)
                                    break
                                case 404: // not found - to manually
                                    item.info = chrome.i18n.getMessage('downloadTableStatusManuallyServerError404')
                                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_MANUALLY)
                                    break
                                case 102: // being processed
                                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_WAIT)
                                    break
                            }
                        } catch (e) {
                            if (e.name != 'AbortError') {
                                item.info = chrome.i18n.getMessage('downloadTableStatusManuallyServerErrorInfo')
                                queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_MANUALLY)
                            }
                        }
                    })()
                } else if (status == INFO_CONDITION_READY_TO_DOWNLOAD || status == INFO_CONDITION_PARTIAL) {
                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_READY)
                } else if (status == INFO_CONDITION_DOWNLOADING) {
                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_WAIT)
                }
            }
        }

        while (queue.steps[DOWNLOAD_PROCESS_STEP_INFO] && queue.steps[DOWNLOAD_PROCESS_STEP_INFO].length > 0) {
            await execute()
            await timeout(150)
        }

        queue.removeWorker(DOWNLOAD_PROCESS_STEP_INFO)
    },
    [DOWNLOAD_PROCESS_STEP_WAIT]: async function () {
        let execute = async () => {
            let { out, items } = await queue.getBatchStatus(DOWNLOAD_PROCESS_STEP_WAIT)

            if (out == undefined) {
                if (items && items.length > 0) {
                    for (let item of items) {
                        item.info = chrome.i18n.getMessage('downloadTableStatusManuallyServerErrorBatch')
                    }
                    queue.moveItemsToStep(items, DOWNLOAD_PROCESS_STEP_MANUALLY)
                }
                return
            }

            for (let item of items) {
                let status = out[item.id]

                if (status === undefined) {
                    item.info = chrome.i18n.getMessage('downloadTableStatusManuallyServerErrorGone')
                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_MANUALLY)
                } else if (status == INFO_CONDITION_READY_TO_DOWNLOAD || status == INFO_CONDITION_PARTIAL) {
                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_READY)
                } else if (status == INFO_CONDITION_DOWNLOADING) {
                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_WAIT)
                }
            }
        }

        while (queue.steps[DOWNLOAD_PROCESS_STEP_WAIT] && queue.steps[DOWNLOAD_PROCESS_STEP_WAIT].length > 0) {
            await execute()
            await timeout(RETRY_TIMEOUT_MS)
        }

        queue.removeWorker(DOWNLOAD_PROCESS_STEP_INFO)
    },
    [DOWNLOAD_PROCESS_STEP_READY]: async function () {
        let execute = async () => {
            let item = queue.steps[DOWNLOAD_PROCESS_STEP_READY].shift()

            try {
                let response = await queue.downloadWithProgress(item, data => {
                    let { progress, total } = data
                })
            } catch (e) {
                if (e.name != 'AbortError') {
                    item.info = chrome.i18n.getMessage('downloadTableStatusManuallyServerErrorDownload')
                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_MANUALLY)
                }
            }
        }

        while (queue.steps[DOWNLOAD_PROCESS_STEP_READY].length != 0) {
            await execute()
        }
    },
    [DOWNLOAD_PROCESS_STEP_MANUALLY]: function () {},
}

let updateTabProcess = false

init()

chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
    await storage.ready

    if (request.command) {
        console.log('Сервис воркер получил сообщение: ' + request.command + ' ' + JSON.stringify(request))
        runCommand(request, sender, sendResponse)
    }
})

async function init () {
    console.log('init')
    storage.init()

    await storage.ready

    let items = storage.getItemsFromStorage(STORE_DOWNLOAD_KEY)
    for (let item of items) {
        queue.addItemToStep(item)
    }

    await updateBadge(items.length)
    await updateTabs()
}

async function runCommand (request, sender, sendResponse) {
    switch (request.command) {
        case COMMAND_DOWNLOAD:
            for (let mod of request.mods) {
                addNewItemToDownloadList(mod.id, mod.name, sender.url)
            }
            updateBadge(storage.getItemsFromStorage(STORE_DOWNLOAD_KEY).length)
            await updateTabs()
            break
        case COMMAND_CHECK:
            ;(async () => {
                let status = await checkModificationServerStatus(request.mod)
                let tabs = await chrome.tabs.query({ url: sender.url })
                let message = {
                    command: COMMAND_CHECK_RESPONSE,
                    mod: request.mod,
                    status,
                }

                for (let tab of tabs) {
                    chrome.tabs.sendMessage(tab.id, message)
                }
            })()
            break
        case COMMAND_UPDATE_DATA_REQUEST:
            updateTabs()
            break
        case COMMAND_REPEAT_DOWNLOAD:
            queue.moveItemsToStep(request.mods, DOWNLOAD_PROCESS_STEP_NEW)
            break
        case COMMAND_REMOVE_DOWNLOAD:
            break
    }
}

function addNewItemToDownloadList (id, name, taburl) {
    let obj = {
        id,
        name,
        taburl,
        timestamp: Date.now(),
        step: DOWNLOAD_PROCESS_STEP_NEW,
        info: '',
    }

    let download_storage = storage.getItemsFromStorage(STORE_DOWNLOAD_KEY)
    let has_item = false

    for (let item in download_storage) {
        if (item.id == obj.id) {
            has_item = true
            break
        }
    }

    if (!has_item) {
        download_storage.push(obj)
    }

    //download_storage = await truncateStorage(STORE_DOWNLOAD_KEY, download_storage)

    storage.setItemsToStorage(STORE_DOWNLOAD_KEY, download_storage)
    queue.addItemToStep(obj)
}

// true - доступен на сервере
// false - не доступен на сервере
// undefined - ошибка сервера
async function checkModificationServerStatus (id) {
    try {
        let response = await fetch(URL_INFO + id)
        let out = await response.json()

        if (out.result && out.result != null) {
            let cond = parseInt(out.result.condition)
            return cond == INFO_CONDITION_READY_TO_DOWNLOAD || INFO_CONDITION_PARTIAL
        } else {
            return false
        }
    } catch (e) {
        console.warn(e)
    }
}

async function truncateStorage (key, items = undefined, autosave = false) {
    if (items === undefined) {
        items = storage.getItemsFromStorage(key)
    }

    if (items.length > STORE_ITEMS_LIMIT) {
        items = items.slice(items.length - STORE_ITEMS_LIMIT, items.length)
    }

    if (autosave) {
        storage.setItemsToStorage(key, items)
    }

    return items
}

async function updateTabs () {
    if (updateTabProcess) {
        return
    } else {
        updateTabProcess = true
    }

    await timeout(45)

    let message = {
        command: COMMAND_UPDATE_DATA_RESPONSE,
        data: {
            [STORE_DOWNLOAD_KEY]: storage.getItemsFromStorage(STORE_DOWNLOAD_KEY),
            [STORE_HISTORY_KEY]: storage.getItemsFromStorage(STORE_HISTORY_KEY),
        },
    }

    let urls = [downloadPageUrl]

    for (let storeKey in message.data) {
        for (let item of message.data[storeKey]) {
            if (urls.indexOf(item.taburl) == -1) {
                urls.push(item.taburl)
            }
        }
    }

    let tabs
    try {
        tabs = await chrome.tabs.query({
            url: urls,
        })

        let promises = []

        for (let tab of tabs) {
            if (tab.active) {
                promises.push(chrome.tabs.sendMessage(tab.id, message))
            }
        }

        await Promise.all(promises)
    } catch (e) {
        console.warn(e, tabs)
    }

    updateTabProcess = false
}

async function updateBadge (downloadCounter = 0) {
    if (downloadCounter == 0) {
        downloadCounter = ''
    }

    await chrome.action.setBadgeText({ text: downloadCounter.toString() })
}

function timeout (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
