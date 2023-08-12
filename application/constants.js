export const URL_INFO = "https://43093.zetalink.ru/info/mod/"
export const URL_DOWNLOAD = "https://43093.zetalink.ru/download/steam/"
export const URL_DIRECT_DOWNLOAD = "https://43093.zetalink.ru/download/"
export const URL_BATCH_STATUS = "https://43093.zetalink.ru/condition/mod/"
export const BATCH_LIMIT = 50
export const RETRY_TIMEOUT_MS = 2000
export const STORE_ITEMS_LIMIT = 100000
export const STORE_DOWNLOAD_KEY = "download"
export const STORE_HISTORY_KEY = "history"
export const INFO_CONDITION_READY_TO_DOWNLOAD = 0
export const INFO_CONDITION_PARTIAL = 1
export const INFO_CONDITION_DOWNLOADING = 2

export const DOWNLOAD_ERROR_NOT_FOUND = 2

export const DOWNLOAD_BUTTON_STATE_DEFAULT = 0
export const DOWNLOAD_BUTTON_STATE_BUSY = 1
export const DOWNLOAD_BUTTON_STATE_ERROR = 2

export const DOWNLOAD_BUTTON_STRING_DEFAULT = "Загрузить"
export const DOWNLOAD_BUTTON_STRING_BUSY = "Ожидайте"
export const DOWNLOAD_BUTTON_STRING_ERROR = "Ошибка"

export const DOWNLOAD_ALERT_NOT_FOUND = "К сожалению не удалось найти эту модификацию"
export const DOWNLOAD_ALERT_ERROR = "Возникла непредвиденная ошибка"

export const DOWNLOAD_PROCESS_STEP_NEW = 0
export const DOWNLOAD_PROCESS_STEP_INFO = 1
export const DOWNLOAD_PROCESS_STEP_WAIT = 2
export const DOWNLOAD_PROCESS_STEP_READY = 3
export const DOWNLOAD_PROCESS_STEP_FILE = 4
export const DOWNLOAD_PROCESS_STEP_MANUALLY = 5

export const COMMAND_DOWNLOAD = "download"
export const COMMAND_CHECK = "check"
export const COMMAND_CHECK_RESPONSE = "check_response"
export const COMMAND_UPDATE_DATA_REQUEST = "update_data_request"
export const COMMAND_UPDATE_DATA_RESPONSE = "update_data_response"
export const COMMAND_REMOVE_DOWNLOAD = "remove_download"
export const COMMAND_REPEAT_DOWNLOAD = "repeat_download"

export const HINT_SERVER_ERROR = "Попытка связатся с сервером или считать результат закончилась неудачей. Перезагрузите страницу и попробуйте еще раз через некоторое время."
export const HINT_FILE_NOT_READY = "Модификация не готова к быстрой загрузке, скачивание модификации может занять некоторое время."
export const HINT_FILE_READY = "Модификация готова к быстрой загрузке."