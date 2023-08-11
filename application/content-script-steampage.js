const src = chrome.runtime.getURL('steampage.js')

;(async () => {
  let contentScript = await import(src)
  contentScript.main()

  if (document.readyState != 'complete') {
    addEventListener('load', () => {
      contentScript.domLoad()
    })
  } else {
    contentScript.domLoad()
  }
})()
