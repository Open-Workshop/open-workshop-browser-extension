import {
    COMMAND_DONWLOAD_PROGRESS_UPDATE,
    COMMAND_REMOVE_DOWNLOAD,
    COMMAND_REPEAT_DOWNLOAD,
    COMMAND_UPDATE_DATA_REQUEST,
    COMMAND_UPDATE_DATA_RESPONSE,
    DOWNLOAD_PROCESS_STEP_INFO,
    DOWNLOAD_PROCESS_STEP_MANUALLY,
    DOWNLOAD_PROCESS_STEP_NEW,
    DOWNLOAD_PROCESS_STEP_READY,
    DOWNLOAD_PROCESS_STEP_WAIT,
    STORE_DOWNLOAD_KEY,
    STORE_HISTORY_KEY,
} from './constants.js'
import { formatBytes, htmlToElement, localizeHtmlPage } from './helpers.js'

localizeHtmlPage()
initCommonButtons()

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    //console.log('Страница загрузки получила сообщение: ' + request.command + ' ' + JSON.stringify(request))

    if (request.command && request.command == COMMAND_UPDATE_DATA_RESPONSE) {
        for (let item of document.querySelectorAll('[data-itemid]')) {
            item.setAttribute('data-invalidate', '')
        }

        let dTable = document.querySelector('#download')

        if (request.data[STORE_DOWNLOAD_KEY].length > 0) {
            dTable.style.display = 'block'

            for (let item of request.data[STORE_DOWNLOAD_KEY]) {
                let row = renderRow(item)
                let existedDom = dTable.querySelector(`[data-itemid="${item.id}"]`)
                row.bsTooltip = new bootstrap.Tooltip(row.querySelector('[data-bs-toggle="tooltip"]'))

                if (existedDom) {
                    if (existedDom.bsTooltip._isShown()) {
                        row.bsTooltip.show()
                    }

                    existedDom.bsTooltip.dispose()
                    existedDom.replaceWith(row)
                } else {
                    dTable.querySelector('#download-table__body').appendChild(row)
                }

                let buttonRepeat = row.querySelector('.js-button-repeat')

                if (buttonRepeat) {
                    buttonRepeat.addEventListener('click', () => {
                        disableButton(buttonRepeat)
                        chrome.runtime.sendMessage({
                            command: COMMAND_REPEAT_DOWNLOAD,
                            mods: [item.id],
                        })
                    })
                }

                let buttonRemove = row.querySelector('.js-button-remove')

                if (buttonRemove) {
                    buttonRemove.addEventListener('click', () => {
                        disableButton(buttonRemove)
                        chrome.runtime.sendMessage({
                            command: COMMAND_REMOVE_DOWNLOAD,
                            mods: [item.id],
                        })
                    })
                }
            }
        } else {
            dTable.style.display = 'none'
        }

        let hTable = document.querySelector('#history')

        if (hTable) {
            if (request.data[STORE_HISTORY_KEY].length > 0) {
                let validHistoryItem = []

                for (let hItem of request.data[STORE_HISTORY_KEY]) {
                    if (!request.data[STORE_DOWNLOAD_KEY].find(dItem => dItem.id == hItem.id)) {
                        validHistoryItem.push(hItem)
                    }
                }

                if (validHistoryItem.length > 0) {
                    hTable.style.display = 'block'

                    for (let item of validHistoryItem) {
                        let row = renderHistoryRow(item)
                        let existedDom = hTable.querySelector(`[data-itemid="${item.id}"]`)

                        if (existedDom) {
                            existedDom.replaceWith(row)
                        } else {
                            hTable.querySelector('#history-table__body').appendChild(row)
                        }

                        let buttonRepeat = row.querySelector('.js-button-repeat')

                        if (buttonRepeat) {
                            buttonRepeat.addEventListener('click', () => {
                                disableButton(buttonRepeat)
                                chrome.runtime.sendMessage({
                                    command: COMMAND_REPEAT_DOWNLOAD,
                                    mods: [item.id],
                                })
                            })
                        }
                    }
                } else {
                    hTable.style.display = 'none'
                }
            }
        }

        let helpBlock = document.querySelector('#help-block')

        if (helpBlock) {
            if (request.data[STORE_DOWNLOAD_KEY].length > 0) {
                helpBlock.style.display = 'none'
            } else {
                helpBlock.style.display = 'block'
            }
        }

        for (let item of document.querySelectorAll('[data-invalidate]')) {
            if (item.bsTooltip) {
                item.bsTooltip.dispose()
            }
            item.remove()
        }

        let event = new CustomEvent(COMMAND_UPDATE_DATA_RESPONSE, { detail: request })
        document.body.dispatchEvent(event)
    } else if (request.command && request.command == COMMAND_DONWLOAD_PROGRESS_UPDATE) {
        let progressText = document.querySelector('.progress-' + request.id)

        if (progressText) {
            let format = formatBytes(request.data.progress) + '/' + formatBytes(request.data.total)
            let percent = (request.data.progress / request.data.total) * 100
            let progressBar = progressText.parentElement.parentElement
            let progressRoot = progressBar.parentElement

            progressText.innerText = format
            progressBar.style.width = percent + '%'
            progressRoot.setAttribute('aria-valuenow', percent)
        }
    }
})

chrome.runtime.sendMessage({
    command: COMMAND_UPDATE_DATA_REQUEST
})

function initCommonButtons () {
    let repeatAll = document.querySelector('.js-button-repeat-all')

    if (repeatAll) {
        addListener(repeatAll, COMMAND_REPEAT_DOWNLOAD)
    }

    let removeAll = document.querySelector('.js-button-remove-all')

    if (removeAll) {
        addListener(removeAll, COMMAND_REMOVE_DOWNLOAD)
    }

    function getIds () {
        let ids = []
        let items = document.querySelectorAll('#download-table [data-itemid]')

        for (let item of items) {
            ids.push(item.getAttribute('data-itemid'))
        }

        return ids
    }

    function shortLock (btn) {
        btn.setAttribute('disabled', 'true')

        setTimeout(() => {
            btn.removeAttribute('disabled')
        }, 1000)
    }

    function addListener (btn, command) {
        btn.addEventListener('click', () => {
            shortLock(btn)
            let ids = getIds()
            chrome.runtime.sendMessage({
                command: command,
                mods: ids,
            })
        })
    }
}

function disableButton (button) {
    button.setAttribute('disabled', true)
}

function renderHistoryRow (item) {
    let template = /*html*/ `
        <tr data-itemid="${item.id}">
            <td>${item.name}</td>
            <td>
                <div class="w-auto text-end">
                    <button type="button" class="btn btn-primary js-button-repeat btn-sm">
                        <i class="bi bi-arrow-clockwise"></i> ${chrome.i18n.getMessage('buttonRepeat')}
                    </button>
                </div>
            </td>
        </tr>
    `

    return htmlToElement(template)
}

function renderRow (item) {
    let template = /*html*/ `
        <tr data-itemid="${item.id}">
            <td>${item.name}</td>
            <td>${getStatusTemplate(item)}</th>
            <td>
                <div class="w-auto text-end text-nowrap">
                    ${getControlsTemplate(item)}
                </div>
            </td>
        </tr>
    `

    return htmlToElement(template)
}

function getControlsTemplate (item) {
    let result = ''

    switch (item.step) {
        case DOWNLOAD_PROCESS_STEP_NEW:
            break
        case DOWNLOAD_PROCESS_STEP_INFO:
            break
        case DOWNLOAD_PROCESS_STEP_WAIT:
            break
        case DOWNLOAD_PROCESS_STEP_READY:
            break
        case DOWNLOAD_PROCESS_STEP_MANUALLY:
            result += /*html*/ `
                <button type="button" class="btn btn-primary btn-sm js-button-repeat">
                    <i class="bi bi-arrow-clockwise"></i> <span class="btn-text">${chrome.i18n.getMessage(
                        'buttonRepeat'
                    )}</span>
                </button>
            `
            break
    }

    result += /*html*/ `
        <button type="button" class="btn btn-danger btn-sm js-button-remove">
            <i class="bi bi-x-octagon"></i> <span class="btn-text">${chrome.i18n.getMessage('buttonRemove')}</span>
        </button>
    `

    return result
}

function getStatusTemplate (item) {
    let stepString = ''
    let tooltipString = ''
    let tooltip = ''
    let info = ''

    function getTooltip (ts, i) {
        return /*html*/ `
            <i class="bi bi-info-square"  data-bs-toggle="tooltip" data-bs-title="${ts + i}"></i>
        `
    }

    switch (item.step) {
        case DOWNLOAD_PROCESS_STEP_NEW:
            stepString = chrome.i18n.getMessage('downloadTableStatusNew')
            tooltipString = chrome.i18n.getMessage('downloadTableStatusNewDescription')
            break
        case DOWNLOAD_PROCESS_STEP_INFO:
            stepString = chrome.i18n.getMessage('downloadTableStatusInfo')
            tooltipString = chrome.i18n.getMessage('downloadTableStatusInfoDescription')
            break
        case DOWNLOAD_PROCESS_STEP_WAIT:
            stepString = chrome.i18n.getMessage('downloadTableStatusWait')
            tooltipString = chrome.i18n.getMessage('downloadTableStatusWaitDescription')
            break
        case DOWNLOAD_PROCESS_STEP_READY:
            tooltipString = chrome.i18n.getMessage('downloadTableStatusReadyDescription')
            info = item.info

            stepString = /*html*/ `
                <div class="progress" role="progressbar" aria-label="Download process" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                    <div class="progress-bar bg-info progress-bar-striped progress-bar-animated overflow-visible" style="width: 0%">
                        <span>
                            ${chrome.i18n.getMessage('downloadTableStatusReady')}
                            ${getTooltip(tooltipString)}: 
                            <span class="progress-${item.id}">${formatBytes(item.progress)}/${formatBytes(
                item.total
            )}</span>
                        </span>
                    </div>
                </div>
            `

            break
        case DOWNLOAD_PROCESS_STEP_MANUALLY:
            stepString = chrome.i18n.getMessage('downloadTableStatusManually')
            tooltipString = chrome.i18n.getMessage('downloadTableStatusManuallyDescription')
            break
    }

    if (item.step != DOWNLOAD_PROCESS_STEP_READY) {
        info = item.info ? item.info : ''
        tooltip = getTooltip(tooltipString, info)
    }

    return /*html*/ `<div class="table-sizer">${stepString + tooltip}</div>`
}
