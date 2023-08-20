export const URL_INFO = '/info/mod/'
export const URL_DOWNLOAD = '/download/steam/'
export const URL_DIRECT_DOWNLOAD = '/download/'
export const URL_BATCH_STATUS = '/condition/mod/'
export const URL_QUEUE_SIZE = '/info/queue/size'
export const OFFSCREEN_BLOB_PATH = '/offscreen-blob.html'
export const BATCH_LIMIT = 50
export const RETRY_TIMEOUT_MS = 2000
export const STORE_ITEMS_LIMIT = 100000

export const STORE_DOWNLOAD_KEY = 'download'
export const STORE_HISTORY_KEY = 'history'
export const STORE_API_URL_KEY = 'apiurl'
export const STORE_QUEUE_SIZE_KEY = 'queuesize'

export const INFO_CONDITION_READY_TO_DOWNLOAD = 0
export const INFO_CONDITION_PARTIAL = 1
export const INFO_CONDITION_DOWNLOADING = 2
export const INFO_CONDITION_QUEUE = 3

export const DOWNLOAD_ERROR_NOT_FOUND = 2
export const DOWNLOAD_BUTTON_STATE_DEFAULT = 0
export const DOWNLOAD_BUTTON_STATE_BUSY = 1
export const DOWNLOAD_BUTTON_STATE_ERROR = 2

export const DOWNLOAD_PROCESS_STEP_NEW = 0
export const DOWNLOAD_PROCESS_STEP_INFO = 1
export const DOWNLOAD_PROCESS_STEP_WAIT = 2
export const DOWNLOAD_PROCESS_STEP_READY = 3
export const DOWNLOAD_PROCESS_STEP_FILE = 4
export const DOWNLOAD_PROCESS_STEP_MANUALLY = 5

export const COMMAND_DOWNLOAD = 'download'
export const COMMAND_CHECK = 'check'
export const COMMAND_CHECK_RESPONSE = 'check_response'
export const COMMAND_UPDATE_DATA_REQUEST = 'update_data_request'
export const COMMAND_UPDATE_DATA_RESPONSE = 'update_data_response'
export const COMMAND_REMOVE_DOWNLOAD = 'remove_download'
export const COMMAND_REPEAT_DOWNLOAD = 'repeat_download'
export const COMMAND_DONWLOAD_PROGRESS_UPDATE = 'download_progress_update'
export const COMMAND_UPLOAD_FILE = 'upload_file'
export const COMMAND_BLOB_REQUEST = 'blob_request'
export const COMMAND_BLOB_RESPONSE = 'blob_response'
export const COMMAND_UPDATE_API_URL = 'api_url_update'
export const COMMAND_UPDATE_QUEUE_SIZE_REQUEST = 'queue_size_update_request'
export const COMMAND_UPDATE_QUEUE_SIZE_RESPONSE = 'queue_size_update_response'