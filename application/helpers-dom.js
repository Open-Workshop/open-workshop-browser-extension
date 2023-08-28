import { renderStatusIcon } from "./helpers-render.js"

export function domWorkshopHome () {
    let root = document.querySelector('.workshop_home_content')

    if (!root) return []

    let items = document.querySelectorAll('.workshop_item_link')

    if (!items.length) return []

    let ids = []

    for (let item of items) {
        let id = item.getAttribute('data-publishedfileid')
        let container = item.querySelector('.workshop_item_row')

        if (!container) {
            container = item
        }

        container.appendChild(renderStatusIcon(id))

        ids.push(id)
    }

    return ids
}

export function domWorkshopBrowse () {
    let root = document.querySelector('.workshopBrowseItems')
    
    if (!root) return []

    let items = document.querySelectorAll('.workshopItem')

    if (!items.length) return []

    let ids = []

    for (let item of items) {
        let link = item.querySelector('a.ugc')

        if (link) {
            let id = link.getAttribute('data-publishedfileid')
            link.appendChild(renderStatusIcon(id))
            ids.push(id)
        }
    }

    return ids
}
