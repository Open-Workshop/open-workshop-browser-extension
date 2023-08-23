import {
    COMMAND_UPDATE_API_URL,
    COMMAND_UPDATE_DATA_RESPONSE,
    COMMAND_UPDATE_QUEUE_SIZE_REQUEST,
    COMMAND_UPDATE_QUEUE_SIZE_RESPONSE,
} from './constants.js'
import { isValidUrl, localizeHtmlPage } from './helpers.js'

localizeHtmlPage()

let updateT
let clearT

let input = document.querySelector(`input[data-toggle="popover"]`)
let inputPopover = new bootstrap.Popover(input, {
    container: 'body',
    placement: 'bottom',
    trigger: 'manual',
    content: chrome.i18n.getMessage('apiUrlSendedPopoverMessage'),
})

input.addEventListener('keyup', () => {
    updateApiUrl(input)
})

setInterval(() => {
    chrome.runtime.sendMessage({
        command: COMMAND_UPDATE_QUEUE_SIZE_REQUEST,
    })
}, 2000)

document.body.addEventListener(COMMAND_UPDATE_QUEUE_SIZE_RESPONSE, event => {
    updateQueueSize(event.detail.val)
})

document.body.addEventListener(COMMAND_UPDATE_DATA_RESPONSE, updateInputValue)

let hardReloadButtons = document.querySelectorAll('.js-hard-reload')

if (hardReloadButtons.length) {
    for (let hardReloadButton of hardReloadButtons) {
        hardReloadButton.addEventListener('click', () => {
            chrome.runtime.reload()
        });
    }
}

let storageCleanButtons = document.querySelectorAll('.js-clean-storage')

if (storageCleanButtons.length) {
    for (let storageCleanButton of storageCleanButtons) {
        storageCleanButton.addEventListener('click', async () => {
            await chrome.storage.local.clear()
            chrome.runtime.reload()
        });
    }
}

function updateInputValue (event) {
    if (input.value != event.detail.apiUrl) {
        input.value = event.detail.apiUrl
    }

    updateQueueSize(event.detail.queue)
}

function updateApiUrl (input) {
    clearTimeout(updateT)
    clearTimeout(clearT)

    if (!isValidUrl(input.value)) {
        return
    }

    updateT = setTimeout(() => {
        let val = input.value
        input.value = val.endsWith('/') ? val.slice(0, -1) : val

        if (!inputPopover._isShown()) {
            inputPopover.show()
        }

        chrome.runtime.sendMessage({
            command: COMMAND_UPDATE_API_URL,
            val,
        })

        clearT = setTimeout(() => {
            inputPopover.hide()
        }, 1000)
    }, 200)
}

function updateQueueSize (value) {
    let valueContainer = document.querySelector('#queue-size')

    valueContainer.innerHTML = value.toString()
}
