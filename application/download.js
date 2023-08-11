import {
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
} from './constants.js'
import { htmlToElement, localizeHtmlPage } from './helpers.js'

// const a = document.createElement('a')

// a.href = "screenshot.png"
// a.download = "screenshot.png"

// const clickHandler = () => {
// setTimeout(() => {
//     URL.revokeObjectURL(url)
//     removeEventListener('click', clickHandler)
// }, 150)
// }

// a.addEventListener('click', clickHandler, false);
// a.click()
localizeHtmlPage()

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    console.log("Страница загрузки получила сообщение: "+ request.command + " " + JSON.stringify(request))

    if (request.command && request.command == COMMAND_UPDATE_DATA_RESPONSE) {
        // render/update new data

        for (let item of request.data[STORE_DOWNLOAD_KEY]) {
            let row = renderRow(item)
            let existedDom = document.querySelector(`[data-itemid="${item.id}"]`)

            if (existedDom) {
                existedDom.replaceWith(row)
            } else {
                document.querySelector('#download-table__body').appendChild(row)
            }

            new bootstrap.Tooltip(row.querySelector('[data-bs-toggle="tooltip"]'))
            let buttonRepeat = row.querySelector(".js-button-repeat")

            if (buttonRepeat) {
                buttonRepeat.addEventListener("click", () => {
                    disableButton(buttonRepeat)
                    chrome.runtime.sendMessage({
                        command: COMMAND_REPEAT_DOWNLOAD,
                        mods: [item.id]
                    })
                });
            }

            let buttonRemove = row.querySelector('.js-button-remove')

            if (buttonRemove) {
                buttonRemove.addEventListener("click", () => {
                    disableButton(buttonRepeat)
                    chrome.runtime.sendMessage({
                        command: COMMAND_REMOVE_DOWNLOAD,
                        mods: [item.id]
                    })
                });
            }
        }
    }
})

chrome.runtime.sendMessage({
    command: COMMAND_UPDATE_DATA_REQUEST,
})


function disableButton(button) {
    button.setAttribute("disabled", true)
}


function renderRow (item) {
    let template = /*html*/ `
        <tr data-itemid="${item.id}">
            <td>${item.name}</td>
            <td>${getStatusTemplate(item)}</th>
            <td>
                <div class="w-auto text-end">
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
            result += /*html*/`
                <button type="button" class="btn btn-primary js-button-repeat">
                    <i class="bi bi-arrow-clockwise"></i> Repeat
                </button>
            `
            break
    }

    result += /*html*/ `
        <button type="button" class="btn btn-danger js-button-remove">
            <i class="bi bi-x-octagon"></i> Remove
        </button>
    `

    return result
}

function getStatusTemplate (item) {
    let stepString = ''
    let tooltipString = ''

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
            stepString = chrome.i18n.getMessage('downloadTableStatusReady')
            tooltipString = chrome.i18n.getMessage('downloadTableStatusReadyDescription')
            break
        case DOWNLOAD_PROCESS_STEP_MANUALLY:
            stepString = chrome.i18n.getMessage('downloadTableStatusManually')
            tooltipString = chrome.i18n.getMessage('downloadTableStatusManuallyDescription')
            break
    }

    let info = item.info ? item.info : ''

    let tooltip = /*html*/ `
        <i class="bi bi-info-square"  data-bs-toggle="tooltip" data-bs-title="${tooltipString + info}"></i>
    `

    return stepString + tooltip
}
