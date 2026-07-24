import { APP_CONFIG } from '../config.js';
import { LocalStorageProvider } from './local-storage-provider.js';
import { ApiStorageProvider } from './api-storage-provider.js';

/** מפעל ספקי אחסון — הנקודה היחידה שבה נבחר המימוש. */
export function createStorageProvider() {
  return APP_CONFIG.storageProvider === 'api'
    ? new ApiStorageProvider(APP_CONFIG.apiBaseUrl)
    : new LocalStorageProvider(APP_CONFIG.storageKeys.state);
}
