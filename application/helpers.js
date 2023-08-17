export function htmlToElement (html) {
    var template = document.createElement('template')
    html = html.trim()
    template.innerHTML = html
    return template.content.firstChild
}

export function replace_i18n (obj, tag) {
    var msg = tag.replace(/__MSG_(\w+)__/g, function (match, v1) {
        return v1 ? chrome.i18n.getMessage(v1) : ''
    })

    if (msg != tag) obj.innerHTML = msg
}

export function localizeHtmlPage () {
    // Localize using __MSG_***__ data tags
    var data = document.querySelectorAll('[data-localize]')

    for (var i in data)
        if (data.hasOwnProperty(i)) {
            var obj = data[i]
            var tag = obj.getAttribute('data-localize').toString()

            replace_i18n(obj, tag)
        }

    // Localize everything else by replacing all __MSG_***__ tags
    var page = document.getElementsByTagName('html')

    for (var j = 0; j < page.length; j++) {
        var obj = page[j]
        var tag = obj.innerHTML.toString()

        replace_i18n(obj, tag)
    }
}

export function formatBytes (bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

export function extractContentDispositionFilename (contentDisposition) {
    let filename = ''
    let filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
    let matches = filenameRegex.exec(contentDisposition)

    if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '')
    }

    return filename
}

export function timeout (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function isValidUrl (urlString) {
    try {
        return Boolean(new URL(urlString))
    } catch (e) {
        return false
    }
}

export function isValidDownloadMime(mime) {
    let valid = ['application/zip', 'application/x-zip-compressed']

    return valid.indexOf(mime) != -1
}