import { COMMAND_UPDATE_API_URL, COMMAND_UPDATE_DATA_RESPONSE } from './constants.js'
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

document.body.addEventListener(COMMAND_UPDATE_DATA_RESPONSE, updateInputValue)

function updateInputValue (event) {
    input.value = event.detail.apiUrl

    document.body.removeEventListener(COMMAND_UPDATE_DATA_RESPONSE, updateInputValue)
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
