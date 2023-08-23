import {
    URL_DOWNLOAD,
    URL_DIRECT_DOWNLOAD,
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
    COMMAND_DONWLOAD_PROGRESS_UPDATE,
    OFFSCREEN_BLOB_PATH,
    COMMAND_BLOB_REQUEST,
    COMMAND_BLOB_RESPONSE,
    STORE_API_URL_KEY,
    COMMAND_UPDATE_API_URL,
    STORE_QUEUE_SIZE_KEY,
    URL_QUEUE_SIZE,
    COMMAND_UPDATE_QUEUE_SIZE_RESPONSE,
    COMMAND_UPDATE_QUEUE_SIZE_REQUEST,
    INFO_CONDITION_QUEUE,
} from './constants.js'
import {
    extractContentDispositionFilename,
    isValidDownloadMime,
    keepAlive,
    throttleCreate,
    timeout,
} from './helpers.js'

const downloadPageUrl = chrome.runtime.getURL('download.html')
let rootDomain = ''

/**
 * Хранилище chrome.storage.local асинхронное, паралельная работа с ним
 * может вызвать нежелательные артефакты. storage нужен для того что бы
 * сделать работу с хранилищем синхронной а перенос в chrome.storage безопасным.
 * Пока storage.ready == false использовать методы storage нельзя
 */
let storage = {
    syncRunned: false,
    ready: new Promise(resolve => null),
    resolver: false,
    data: {
        [STORE_DOWNLOAD_KEY]: {},
        [STORE_HISTORY_KEY]: {},
    },
    static: {
        [STORE_API_URL_KEY]: '',
    },
    dynamic: {
        [STORE_QUEUE_SIZE_KEY]: 0,
    },
    readyResolver (resolve) {
        resolve()
    },
    addItemToStorage (key, item) {
        this.data[key][item.id] = item
        this.runSync()
    },
    addItemsToStorage (key, items) {
        for (let item of items) {
            this.addItemToStorage(key, item)
        }
    },
    getItemFromStorage (key, id) {
        return this.data[key][id]
    },
    getItemsFromStorage (key) {
        return Object.values(this.data[key])
    },
    updateItemInStorage (key, item) {
        if (this.data[key][item.id]) {
            this.data[key][item.id] = item
            this.runSync()
        }
    },
    updateItemsInStorage (key, items) {
        for (let item of items) {
            this.updateItemInStorage(key, item)
        }
    },
    removeItemFromStorage (key, item) {
        delete this.data[key][item.id]
        this.runSync()
    },
    removeItemsFromStorage (key, items) {
        for (let item of items) {
            delete this.data[key][item.id]
        }
    },
    getStatic (key) {
        return this.static[key]
    },
    setStatic (key, value) {
        this.static[key] = value
        this.runSync()
    },
    getDynamic (key) {
        return this.dynamic[key]
    },
    setDynamic (key, value) {
        this.dynamic[key] = value
    },
    async runSync () {
        if (this.syncRunned) {
            return
        }

        this.syncRunned = true
        await timeout(250)
        await this.sync()
        this.syncRunned = false
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

        for (let key in this.static) {
            let storage = await chrome.storage.local.get(key)

            if (!storage[key]) {
                storage = {
                    [key]: '',
                }
            }

            this.static[key] = storage[key]
        }

        this.resolver()
    },
    async sync () {
        for (let key in this.data) {
            await chrome.storage.local.set({
                [key]: this.getItemsFromStorage(key),
            })
        }

        for (let key in this.static) {
            await chrome.storage.local.set({
                [key]: this.static[key],
            })
        }
    },
}

storage.ready = new Promise(resolve => {
    storage.resolver = resolve
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

        let response = fetch(rootDomain + url, { ...config, ...{ signal: abortController.signal } })

        let clean = () => {
            for (let marker of abortMarker) {
                this.requestList[marker] = this.requestList[marker].filter(controller => controller != abortController)
            }
        }

        return { response, clean }
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
                this.requestList[marker] = []
            }
        }
    },
}

let offscreenController = {
    async sendMessage (data, docpath = OFFSCREEN_BLOB_PATH) {
        if (!(await this.hasDocument(docpath))) {
            try {
                await chrome.offscreen.createDocument({
                    url: docpath,
                    reasons: [chrome.offscreen.Reason.BLOBS],
                    justification: 'Create URL',
                })
            } catch (e) {
                console.warn(e)
            }
        }

        await chrome.runtime.sendMessage(data)
    },

    async hasDocument (path) {
        const matchedClients = await clients.matchAll()
        for (const client of matchedClients) {
            if (client.url.endsWith(path)) {
                return true
            }
        }
        return false
    },

    async closeOffscreenDocument () {
        if (!(await this.hasDocument())) {
            return
        }
        await chrome.offscreen.closeDocument()
    },
}

/**
 * Очередь.
 * Основная структура реализующая последовательно/паралельную
 * обработку загрузки модификаций.
 */
let queue = {
    workers: {},
    steps: {},
    removeItem: function (item) {
        let fixedItem
        if (item.id === undefined) {
            fixedItem = queue.getItemFromSteps(item)

            if (!fixedItem) {
                return
            }
        } else {
            fixedItem = item
        }

        queue.removeItemFromSteps(fixedItem)
        storage.removeItemFromStorage(STORE_DOWNLOAD_KEY, fixedItem)
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
            let cfResponse = controlledFetch.fetch(
                URL_BATCH_STATUS + encodeURIComponent('[' + ids.join(',') + ']'),
                {},
                ids
            )

            try {
                let response = await cfResponse.response

                out = await response.json()
            } catch (e) {
                if (e.name == 'AbortError') {
                    items = items.filter(item => e.ids.indexOf(item.id) == -1)
                    return await queue.getBatchStatus(stepName, items)
                } else {
                    console.warn(e)
                }
            }

            cfResponse.clean()
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
        item.step = stepName
        queue.addItemToStep(item)
        storage.updateItemInStorage(STORE_DOWNLOAD_KEY, item)
        updateTabs()
    },
    partialDownload: async function (response, item) {
        let contentLength = parseInt(response.headers.get('content-length'), 10)
        let receivedLength = 0
        let contentName = extractContentDispositionFilename(response.headers.get('content-disposition'))
        let filename =
            item.name
                .toLowerCase()
                .trim()
                .replaceAll(' ', '-')
                .replaceAll(/([^a-z0-9 ]+)/g, '') +
            '.' +
            contentName.split('.').pop()
        let reader = response.body.getReader()

        item.total = contentLength
        while (true) {
            const { done, value } = await reader.read()

            if (done) {
                offscreenController.sendMessage({
                    command: COMMAND_BLOB_REQUEST,
                    data: 'done',
                    filename,
                })
                break
            }

            offscreenController.sendMessage({
                command: COMMAND_BLOB_REQUEST,
                data: [...value],
                filename,
            })
            receivedLength += value.length

            sendMessageToTabs(
                downloadPageUrl,
                {
                    command: COMMAND_DONWLOAD_PROGRESS_UPDATE,
                    data: {
                        progress: receivedLength,
                        total: contentLength,
                    },
                    id: item.id,
                },
                true
            )

            item.progress = receivedLength
            storage.updateItemInStorage(STORE_DOWNLOAD_KEY, item)
        }
    },
    [DOWNLOAD_PROCESS_STEP_NEW]: async function () {
        let execute = () => {
            let item = queue.steps[DOWNLOAD_PROCESS_STEP_NEW].shift()

            if (!queue.checkExists(item)) {
                item.info = ''
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
                    let cfResponse = controlledFetch.fetch(URL_DOWNLOAD + item.id, {}, item.id)

                    try {
                        let response = await cfResponse.response

                        switch (response.status) {
                            case 200:
                                // zip recieved ?
                                let contentType = response.headers.get('content-type')

                                if (isValidDownloadMime(contentType)) {
                                    await queue.partialDownload(response, item)
                                    queue.removeItem(item)
                                } else {
                                    throw new Error('wrong content type')
                                }
                                break
                            case 202: // success to download
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
                            console.warn(e)
                            item.info = chrome.i18n.getMessage('downloadTableStatusManuallyServerErrorInfo')
                            queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_MANUALLY)
                        }
                    }

                    cfResponse.clean()
                } else if (status == INFO_CONDITION_READY_TO_DOWNLOAD || status == INFO_CONDITION_PARTIAL) {
                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_READY)
                } else if (status == INFO_CONDITION_DOWNLOADING || status == INFO_CONDITION_QUEUE) {
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
                } else if (status == INFO_CONDITION_DOWNLOADING || status == INFO_CONDITION_QUEUE) {
                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_WAIT)
                }
            }
        }

        while (queue.steps[DOWNLOAD_PROCESS_STEP_WAIT] && queue.steps[DOWNLOAD_PROCESS_STEP_WAIT].length > 0) {
            await execute()
            await timeout(RETRY_TIMEOUT_MS)
        }

        queue.removeWorker(DOWNLOAD_PROCESS_STEP_WAIT)
    },
    [DOWNLOAD_PROCESS_STEP_READY]: async function () {
        let execute = async () => {
            let item = queue.steps[DOWNLOAD_PROCESS_STEP_READY].shift()
            let cfResponse = controlledFetch.fetch(URL_DIRECT_DOWNLOAD + item.id, {}, item.id)
            
            try {
                let response = await cfResponse.response

                let contentType = response.headers.get('content-type')

                if (isValidDownloadMime(contentType)) {
                    await queue.partialDownload(response, item)
                    queue.removeItem(item)
                } else {
                    throw new Error('wrong content type')
                }
            } catch (e) {
                if (e.name != 'AbortError') {
                    item.info = chrome.i18n.getMessage('downloadTableStatusManuallyServerErrorDownload')
                    queue.moveItemToStep(item, DOWNLOAD_PROCESS_STEP_MANUALLY)
                }

                console.warn(e)
            }

            cfResponse.clean()
        }

        while (queue.steps[DOWNLOAD_PROCESS_STEP_READY].length != 0) {
            await execute()
        }

        queue.removeWorker(DOWNLOAD_PROCESS_STEP_READY)
    },
    [DOWNLOAD_PROCESS_STEP_MANUALLY]: function () {},
}

let updateTabProcess = false

let monitorQueueThrottle

init()

async function init () {
    console.log('startup')

    keepAlive()

    chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
        await storage.ready

        if (request.command) {
            //console.log('Сервис воркер получил сообщение: ' + request.command + ' ' + JSON.stringify(request))
            runCommand(request, sender, sendResponse)
        }
    })

    chrome.tabs.onActivated.addListener(async activeInfo => {
        await storage.ready

        updateTabs()
    })

    storage.init()

    await storage.ready

    rootDomain = storage.getStatic(STORE_API_URL_KEY)

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
                addNewItemToDownloadList(mod.id, mod.name)
            }
            await updateTabs()
            break
        case COMMAND_CHECK:
            ;(async () => {
                sendMessageToTabs(sender.url, {
                    command: COMMAND_CHECK_RESPONSE,
                    status_list: await checkModificationsServerStatus(request.mods),
                })
            })()
            break
        case COMMAND_UPDATE_DATA_REQUEST:
            updateTabs()
            break
        case COMMAND_REPEAT_DOWNLOAD:
            for (let mod of request.mods) {
                let qItem = queue.getItemFromSteps(mod)

                if (qItem) {
                    if (qItem.step == DOWNLOAD_PROCESS_STEP_MANUALLY) {
                        queue.moveItemToStep(qItem, DOWNLOAD_PROCESS_STEP_NEW)
                    }
                } else {
                    let historyItem = storage.getItemFromStorage(STORE_HISTORY_KEY, mod)

                    if (historyItem) {
                        addNewItemToDownloadList(historyItem.id, historyItem.name)
                    }
                }
            }
            break
        case COMMAND_REMOVE_DOWNLOAD:
            for (let mod of request.mods) {
                controlledFetch.abort(mod)
                timeout(5).then(() => {
                    let item = queue.getItemFromSteps(mod)
                    if (item) {
                        queue.removeItem(item)
                    }
                    updateTabs()
                })
                storage.removeItemFromStorage(STORE_DOWNLOAD_KEY, {id: mod})
            }

            break
        case COMMAND_BLOB_RESPONSE:
            chrome.downloads.download({
                filename: request.filename,
                url: request.data,
                saveAs: false,
            })
            updateTabs()
            break
        case COMMAND_UPDATE_API_URL:
            storage.setStatic(STORE_API_URL_KEY, request.val)
            rootDomain = request.val
            break
        case COMMAND_UPDATE_QUEUE_SIZE_REQUEST:
            monitorQueue(true)
            break
    }
}

function addNewItemToDownloadList (id, name) {
    let obj = {
        id,
        name,
        progress: 0,
        total: 0,
        step: DOWNLOAD_PROCESS_STEP_NEW,
        info: '',
    }

    if (storage.getItemFromStorage(STORE_DOWNLOAD_KEY, id)) {
        return
    }

    storage.addItemToStorage(STORE_DOWNLOAD_KEY, obj)
    storage.addItemToStorage(STORE_HISTORY_KEY, {
        id: obj.id,
        name: obj.name,
    })

    let history = storage.getItemsFromStorage(STORE_HISTORY_KEY)

    if (history.length > STORE_ITEMS_LIMIT) {
        storage.removeItemsFromStorage(STORE_HISTORY_KEY, history.slice(0, history.length - STORE_ITEMS_LIMIT))
    }

    queue.addItemToStep(obj)
}

// true - доступен на сервере
// false - не доступен на сервере
// undefined - ошибка сервера
// 'busy' - уже в работе
async function checkModificationsServerStatus (ids) {
    let result = {}

    let notInQueue = []
    for (let id of ids) {
        let queueItem = queue.getItemFromSteps(id)

        if (queueItem) {
            result[id] = 'busy'
            continue
        } else {
            notInQueue.push(id)
        }
    }

    while (notInQueue.length > 0) {
        let niqIds = notInQueue.splice(0, BATCH_LIMIT)

        try {
            let response = await fetch(rootDomain + URL_BATCH_STATUS + encodeURIComponent('[' + niqIds.join(',') + ']'))

            if (response.status == 200) {
                let out = await response.json()

                for (let niqId of niqIds) {
                    let cond = out[niqId]

                    if (cond == undefined) {
                        result[niqId] = false
                    } else {
                        result[niqId] = parseInt(cond) == INFO_CONDITION_READY_TO_DOWNLOAD || INFO_CONDITION_PARTIAL
                    }
                }
            }
        } catch (e) {
            console.warn(e)
        }
    }

    return result
}

async function updateTabs () {
    if (updateTabProcess) {
        return
    } else {
        updateTabProcess = true
    }

    await timeout(45)
    updateBadge(storage.getItemsFromStorage(STORE_DOWNLOAD_KEY).length)

    let message = {
        command: COMMAND_UPDATE_DATA_RESPONSE,
        data: {
            [STORE_DOWNLOAD_KEY]: storage.getItemsFromStorage(STORE_DOWNLOAD_KEY),
            [STORE_HISTORY_KEY]: storage.getItemsFromStorage(STORE_HISTORY_KEY),
        },
        apiUrl: storage.getStatic(STORE_API_URL_KEY),
        queue: storage.getDynamic(STORE_QUEUE_SIZE_KEY),
    }

    let urls = [downloadPageUrl]

    sendMessageToTabs(urls, message, true)

    updateTabProcess = false
}

async function updateBadge (downloadCounter = 0) {
    if (downloadCounter == 0) {
        downloadCounter = ''
    }

    await chrome.action.setBadgeText({ text: downloadCounter.toString() })
}

async function sendMessageToTabs (urls = [], message = {}, withRuntime = false) {
    let tabs
    if (!Array.isArray(urls)) {
        urls = [urls]
    }

    try {
        tabs = await chrome.tabs.query({
            url: [
                'https://steamcommunity.com/sharedfiles/filedetails/*',
                'https://steamcommunity.com/workshop/filedetails/*',
                ...urls,
            ],
        })

        let promises = []

        for (let tab of tabs) {
            if (tab.active) {
                promises.push(chrome.tabs.sendMessage(tab.id, message))
            }
        }

        if (withRuntime) {
            promises.push(chrome.runtime.sendMessage(message))
        }

        await Promise.all(promises)
    } catch (e) {
        console.warn(e, tabs)
    }
}

async function monitorQueue (force) {
    if (force) {
        let queueSize = storage.getDynamic(STORE_QUEUE_SIZE_KEY)
        send(queueSize)
    }

    if (!monitorQueueThrottle) {
        monitorQueueThrottle = throttleCreate(f, 1000)
    } else {
        monitorQueueThrottle()
    }

    async function f () {
        let isAction = await chrome.action.isEnabled()

        if (isAction) {
            try {
                let response = await fetch(rootDomain + URL_QUEUE_SIZE)
                let count = await response.json()

                if (storage.getDynamic(STORE_QUEUE_SIZE_KEY) != count) {
                    storage.setDynamic(STORE_QUEUE_SIZE_KEY, count)

                    send(count)
                }
            } catch (e) {
                console.warn(e)
            }
        }
    }

    function send (val) {
        sendMessageToTabs([], {
            command: COMMAND_UPDATE_QUEUE_SIZE_RESPONSE,
            val,
        })
    }
}
