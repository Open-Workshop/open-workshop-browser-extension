import {
    // URL_INFO,
    // URL_DOWNLOAD,
    // RETRY_TIMEOUT_MS,
    // INFO_CONDITION_NOT_REGISTERED,
    // INFO_CONDITION_READY_TO_DOWNLOAD,
    // DOWNLOAD_ERROR_NOT_FOUND,
    DOWNLOAD_BUTTON_STATE_DEFAULT,
    DOWNLOAD_BUTTON_STATE_BUSY,
    DOWNLOAD_BUTTON_STATE_ERROR,
    DOWNLOAD_BUTTON_STRING_DEFAULT,
    DOWNLOAD_BUTTON_STRING_BUSY,
    DOWNLOAD_BUTTON_STRING_ERROR,
    // DOWNLOAD_ALERT_NOT_FOUND,
    // DOWNLOAD_ALERT_ERROR,
    COMMAND_CHECK_RESPONSE,
    HINT_SERVER_ERROR,
    HINT_FILE_NOT_READY,
    HINT_FILE_READY,
} from './constants.js'

import { htmlToElement } from './helpers.js'

let btnTemplate = `
    <button id="DownloadItemBtn" class="btn_green_white_innerfade btn_border_2px btn_medium" disabled>
        <div class="subscribeIcon" style="background-image: none">
            <span class="loader"></span>
        </div>
        <span class="subscribeText">
            <div class="subscribeOption subscribe selected">${DOWNLOAD_BUTTON_STRING_DEFAULT}</div>
        </span>
    </button>
`

// let appid = document.querySelector(".apphub_sectionTab").href.split("/")[4]
let searchParams = new URLSearchParams(location.search)
let id = searchParams.get('id')
let btnDownload

export function main () {
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        //console.log(request, sender, sendResponse)

        if (request.command && request.command == COMMAND_CHECK_RESPONSE) {
            if (request.status === undefined) {
                setDownloadButtonState(DOWNLOAD_BUTTON_STATE_ERROR)
                setDownloadButtonIcon('warning.png', HINT_SERVER_ERROR)
            } else if (request.status === false) {
                setDownloadButtonState(DOWNLOAD_BUTTON_STATE_DEFAULT)
                setDownloadButtonIcon('turtle.png', HINT_FILE_NOT_READY)
            } else if (request.status === true) {
                setDownloadButtonState(DOWNLOAD_BUTTON_STATE_DEFAULT)
                setDownloadButtonIcon('rabbit.png', HINT_FILE_READY)
            }
        }
    })
}

export function domLoad () {
    let btnSubscribe = document.getElementById('SubscribeItemBtn')
    let container = btnSubscribe.parentElement

    container.style.display = 'flex'
    container.style.flexDirection = 'column'

    btnDownload = container.appendChild(htmlToElement(btnTemplate))

    btnDownload.style.position = 'relative'
    btnDownload.style.marginTop = '10px'

    chrome.runtime.sendMessage({
        command: 'check',
        mod: id,
    })

    btnDownload.addEventListener('click', async () => {
        let name = document.querySelector('.workshopItemTitle').innerText

        chrome.runtime.sendMessage({
            command: 'download',
            mods: [{ id, name }],
        })

        setDownloadButtonState(DOWNLOAD_BUTTON_STATE_BUSY)
        setDownloadButtonIcon('loading')
    })
}

// async function requestUntilDonwload (id) {
//     setDownloadButtonState(DOWNLOAD_BUTTON_STATE_BUSY)

//     try {
//         let response = await fetch(URL_INFO + id)
//         let out = await response.json()

//         if (
//             parseInt(out.condition) == INFO_CONDITION_READY_TO_DOWNLOAD ||
//             parseInt(out.condition) == INFO_CONDITION_NOT_REGISTERED
//         ) {
//             let downloadResponse = await fetch(URL_DOWNLOAD + id)
//             let contentType = downloadResponse.headers.get('content-type')

//             if (contentType == 'application/zip') {
//                 let mod = await downloadResponse.blob()
//                 let filename = getFilename(downloadResponse.headers.get('content-disposition'))

//                 downloadBlob(mod, filename)
//                 setDownloadButtonState(DOWNLOAD_BUTTON_STATE_DEFAULT)
//             } else if (contentType == 'application/json') {
//                 let downloadOut = await downloadResponse.json()

//                 if (parseInt(downloadOut.error_id) == DOWNLOAD_ERROR_NOT_FOUND) {
//                     alert(DOWNLOAD_ALERT_NOT_FOUND)
//                     btnDownload.remove()
//                 } else {
//                     retry()
//                 }
//             }
//         } else {
//             retry()
//         }
//     } catch (e) {
//         alert(DOWNLOAD_ALERT_ERROR)
//         setDownloadButtonState(DOWNLOAD_BUTTON_STATE_DEFAULT)
//     }

//     function retry () {
//         setTimeout(() => {
//             requestUntilDonwload(id)
//         }, RETRY_TIMEOUT_MS)
//     }
// }


function getFilename (contentDisposition) {
    let filename = ''
    let filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
    let matches = filenameRegex.exec(contentDisposition)

    if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '')
    }

    return filename
}

function downloadBlob (blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = filename || 'download'

    const clickHandler = () => {
        setTimeout(() => {
            URL.revokeObjectURL(url)
            removeEventListener('click', clickHandler)
        }, 150)
    }

    a.addEventListener('click', clickHandler, false)
    a.click()
}

function setDownloadButtonIcon (icon, title = '') {
    let iconNode = btnDownload.querySelector('.subscribeIcon')

    if (icon === 'loading') {
        iconNode.style.backgroundImage = 'none'
        btnDownload.querySelector('.loader').style.display = 'block'
    } else {
        iconNode.style.backgroundImage = `url(${chrome.runtime.getURL(icon)})`
        iconNode.style.backgroundSize = 'contain'
        iconNode.style.backgroundPosition = 'center center'

        btnDownload.querySelector('.loader').style.display = 'none'
    }

    if (title == '') {
        btnDownload.removeAttribute('title')
    } else {
        btnDownload.setAttribute('title', title)
    }
}

function setDownloadButtonState (state) {
    if (state == DOWNLOAD_BUTTON_STATE_BUSY) {
        btnDownload.setAttribute('disabled', 'true')
        btnDownload.querySelector('.subscribeOption').innerHTML = DOWNLOAD_BUTTON_STRING_BUSY
    } else if (state == DOWNLOAD_BUTTON_STATE_DEFAULT) {
        btnDownload.removeAttribute('disabled')
        btnDownload.querySelector('.subscribeOption').innerHTML = DOWNLOAD_BUTTON_STRING_DEFAULT
    } else if (state == DOWNLOAD_BUTTON_STATE_ERROR) {
        btnDownload.setAttribute('disabled', 'true')
        btnDownload.querySelector('.subscribeOption').innerHTML = DOWNLOAD_BUTTON_STRING_ERROR
    }
}
