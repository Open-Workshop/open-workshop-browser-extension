import { htmlToElement } from "./helpers.js"

export function renderSingleButton (id, name) {
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

export function renderCollectionButton (id, name) {
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

export function renderBulkButton () {
    let template = /*html*/ `
    <a id="openws-bulk" class="general_btn subscribe">
        <div class="subscribeIcon"></div>
        <div class="subscribeText">${chrome.i18n.getMessage('steampageButtonBulk')}</div>
    </a>
    `

    return htmlToElement(template)
}


export function renderStatusIcon(id) {
    let template = /*html*/`
        <span id="openws-${id}" class="openws-status-icon">
            <div class="subscribeIcon openws-suscribeicon-status" style="background-image: none">
                <span class="loader"></span>
            </div>
        </span>
    `

    return htmlToElement(template)
}