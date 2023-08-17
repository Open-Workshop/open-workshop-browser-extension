import {
    DOWNLOAD_BUTTON_STATE_DEFAULT,
    DOWNLOAD_BUTTON_STATE_BUSY,
    DOWNLOAD_BUTTON_STATE_ERROR,
    COMMAND_CHECK_RESPONSE,
    COMMAND_CHECK,
    COMMAND_DOWNLOAD,
    BATCH_LIMIT
} from './constants.js'

import { htmlToElement, timeout } from './helpers.js'

let ids = []

export function main () {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.command && request.command == COMMAND_CHECK_RESPONSE) {
            for (let id of ids) {
                let res = request.status_list[id]
                let button = getButtonById(id)

                if (!button) {
                    continue
                }

                if (res === undefined) {
                    setDownloadButtonState(button, DOWNLOAD_BUTTON_STATE_ERROR)
                    setDownloadButtonIcon(button, 'warning.png', chrome.i18n.getMessage('steampageHintError'))
                } else if (res === false) {
                    setDownloadButtonState(button, DOWNLOAD_BUTTON_STATE_DEFAULT)
                    setDownloadButtonIcon(button, 'turtle.png', chrome.i18n.getMessage('steampageHintNotReady'))
                } else if (res === true) {
                    setDownloadButtonState(button, DOWNLOAD_BUTTON_STATE_DEFAULT)
                    setDownloadButtonIcon(button, 'rabbit.png', chrome.i18n.getMessage('steampageHintReady'))
                } else if (res === 'busy') {
                    setDownloadButtonState(button, DOWNLOAD_BUTTON_STATE_BUSY)
                    setDownloadButtonIcon(button, 'loading')
                }
            }
        }
    })
}

export async function domLoad () {
    let btnSubscribe = document.querySelector('.game_area_purchase_game #SubscribeItemBtn')

    // single item
    if (btnSubscribe) {
        let searchParams = new URLSearchParams(location.search)
        let id = searchParams.get('id')
        let container = btnSubscribe.parentElement
        let name = document.querySelector('.workshopItemTitle').innerText

        container.style.display = 'flex'
        container.style.flexDirection = 'column'

        let btn = renderSingleButton(id, name)
        container.appendChild(btn)

        ids.push(id)
    }

    let collectionItems = document.querySelectorAll('.collectionItem')

    if (collectionItems.length > 0) {
        let bulkButton = renderBulkButton()
        let node = document.querySelector('.subscribeCollection >:last-child')

        if (!node) {
            return
        }

        node.parentElement.insertBefore(bulkButton, node)

        bulkButton.addEventListener('click', () => {
            let mods = []

            for (let id of ids) {
                let button = getButtonById(id)

                if (!button.getAttribute('disabled')) {
                    mods.push({
                        id,
                        name: button.getAttribute('data-openws-name'),
                    })

                    setDownloadButtonState(button, DOWNLOAD_BUTTON_STATE_BUSY)
                    setDownloadButtonIcon(button, 'loading')
                }
            }

            chrome.runtime.sendMessage({
                command: COMMAND_DOWNLOAD,
                mods,
            })

            bulkButton.setAttribute("disabled", "true")

            setTimeout(() => {
                bulkButton.removeAttribute("disabled")
            }, 5000)
        })
    }

    let flush = 0
    for (let cItem of collectionItems) {
        flush += 1

        let id = cItem.getAttribute('id').replace('sharedfile_', '')
        let name = cItem.querySelector('.workshopItemTitle').innerText
        ids.push(id)

        let btn = renderCollectionButton(id, name)
        cItem.querySelector('.subscriptionControls').appendChild(btn)

        if (flush >= 25) {
            await timeout(25)
            flush = 0
        }
    }

    chrome.runtime.sendMessage({
        command: COMMAND_CHECK,
        mods: ids,
    })

    for (let id of ids) {
        let button = getButtonById(id)
        button.addEventListener('click', async () => {
            let name = button.getAttribute('data-openws-name')

            chrome.runtime.sendMessage({
                command: COMMAND_DOWNLOAD,
                mods: [{ id, name }],
            })

            setDownloadButtonState(button, DOWNLOAD_BUTTON_STATE_BUSY)
            setDownloadButtonIcon(button, 'loading')
        })
    }
}

function setDownloadButtonIcon (button, icon, title = '') {
    let iconNode = button.querySelector('.subscribeIcon')

    if (icon === 'loading') {
        iconNode.style.backgroundImage = 'none'
        button.querySelector('.loader').style.display = 'block'
    } else {
        iconNode.style.backgroundImage = `url(${chrome.runtime.getURL(icon)})`
        iconNode.style.backgroundSize = 'contain'
        iconNode.style.backgroundPosition = 'center center'

        button.querySelector('.loader').style.display = 'none'
    }

    if (title == '') {
        button.removeAttribute('title')
    } else {
        button.setAttribute('title', title)
    }
}

function setDownloadButtonState (button, state) {
    if (state == DOWNLOAD_BUTTON_STATE_BUSY) {
        button.setAttribute('disabled', 'true')
        button.querySelector('.subscribeOption').innerHTML = chrome.i18n.getMessage('steampageButtonBusy')
    } else if (state == DOWNLOAD_BUTTON_STATE_DEFAULT) {
        button.removeAttribute('disabled')
        button.querySelector('.subscribeOption').innerHTML = chrome.i18n.getMessage('steampageButtonDownload')
    } else if (state == DOWNLOAD_BUTTON_STATE_ERROR) {
        button.setAttribute('disabled', 'true')
        button.querySelector('.subscribeOption').innerHTML = chrome.i18n.getMessage('steampageButtonError')
    }
}

function renderSingleButton (id, name) {
    let template = /*html*/ `
        <button id="openws-${id}" data-openws-name="${name}" class="btn_green_white_innerfade btn_border_2px btn_medium" disabled>
            <div class="subscribeIcon" style="background-image: none">
                <span class="loader"></span>
            </div>
            <span class="subscribeText">
                <div class="subscribeOption subscribe selected">${chrome.i18n.getMessage(
                    'steampageButtonDownload'
                )}</div>
            </span>
        </button>
    `
    let element = htmlToElement(template)

    element.style.position = 'relative'
    element.style.marginTop = '10px'

    return element
}

function renderCollectionButton (id, name) {
    let template = /*html*/ `
        <button id="openws-${id}" data-openws-name="${name}" class="general_btn subscribe " disabled>
            <div class="subscribeIcon" style="background-image: none">
                <span class="loader"></span>
            </div>
            <span class="subscribeText">
                <div class="subscribeOption subscribe selected">${chrome.i18n.getMessage(
                    'steampageButtonDownload'
                )}</div>
            </span>
        </button>
    `
    let element = htmlToElement(template)

    element.style.marginTop = '5px'
    element.style.border = '0'
    element.style.clear = 'both'

    return element
}

function renderBulkButton () {
    let template = /*html*/ `
    <a id="openws-bulk" class="general_btn subscribe">
        <div class="subscribeIcon"></div>
        <div class="subscribeText">${chrome.i18n.getMessage('steampageButtonBulk')}</div>
    </a>
    `

    return htmlToElement(template)
}

function getButtonById (id) {
    return document.getElementById(`openws-${id}`)
}
